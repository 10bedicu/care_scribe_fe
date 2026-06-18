import { noNullStrings, Structure, validateEnumDescription } from ".";
import { z } from "zod";
import { Code, UserBareMinimum } from "@/types";
import { site } from "./code";
import { lookupCode } from "../response-utils";
import { API } from "../api";
import Fuse from "fuse.js";

export const SERVICE_REQUEST_PRIORITY = [
  "routine",
  "urgent",
  "asap",
  "stat",
] as const;

export type ServiceRequestPriority = (typeof SERVICE_REQUEST_PRIORITY)[number];

export type ServiceRequestSpec = {
  title: string;
  status: "active";
  intent: "order";
  priority: ServiceRequestPriority;
  category: string;
  do_not_perform: boolean;
  note: string | null;
  code: Code;
  body_site: Code | null;
  occurance: string | null;
  patient_instruction: string | null;
  requester: UserBareMinimum;
};

export type ServiceRequest = {
  service_request: ServiceRequestSpec;
  activity_definition: string;
  encounter: string;
};

const toolStructure = z.array(
  z.object({
    service: z
      .string()
      .describe(
        'The name of the service / activity being requested (e.g. "Urinalysis", "Chest X-Ray", "CBC"). This will be matched against the facility\'s configured activity definitions.',
      ),
    priority: z
      .enum(SERVICE_REQUEST_PRIORITY)
      .nullable()
      .describe(
        `Priority of the service request: "routine" (Routine) | "urgent" (Urgent) | "asap" (As Soon As Possible) | "stat" (Immediate / Stat). If not explicitly stated, leave as null and "routine" will be used.`,
      ),
    patient_instruction: z
      .string()
      .nullable()
      .describe(
        "Instructions intended for the patient regarding the service request (e.g. fasting, preparation steps).",
      ),
    note: z
      .string()
      .nullable()
      .describe(
        "Clinical note for the service request, intended for the performer or for clinical reference. Do not duplicate patient_instruction here.",
      ),
    body_site: site()
      .nullable()
      .describe(
        "The anatomical body site that the service request targets. Only fill if a specific anatomical site is explicitly mentioned, otherwise leave null and the activity definition's default body site will be used.",
      ),
    requester: z
      .string()
      .nullable()
      .describe(
        "Name (or partial name / username) of the user who is requesting this service. If not explicitly stated, leave as null and the current user will be used.",
      ),
  }),
);

export const serviceRequestStructure: Structure<
  ServiceRequest[],
  typeof toolStructure
> = {
  name: "Service Request",
  description:
    "Structure for a service request (e.g. lab order, imaging request, procedure)",
  toolStructure,
  deserialize: async (data, currentData, meta) => {
    const errors: string[] = [];

    const parsed = data.map(async (sr) => {
      if (!meta.facilityId) {
        errors.push(
          `Cannot create service request "${sr.service}" without a facility context.`,
        );
        return undefined;
      }

      // Look up the activity definition by service name.
      const { results } = await API.activityDefinitions.list(meta.facilityId, {
        title: sr.service,
        limit: 10,
      });

      if (!results.length) {
        errors.push(
          `Could not find a service that matches with "${sr.service}". Please enter manually.`,
        );
        return undefined;
      }

      // Fuzzy match the title to pick the best activity definition.
      const fuse = new Fuse(results, {
        keys: ["title"],
        ignoreLocation: true,
        includeScore: true,
        threshold: 0.4,
      });
      const matched = fuse.search(sr.service)[0]?.item || results[0];

      let bodySite: Code | null = matched.body_site ?? null;
      if (sr.body_site) {
        const code = await lookupCode(
          sr.body_site.code,
          sr.body_site.display_names,
          "system-body-site",
        );
        if (code) {
          bodySite = code;
        } else {
          errors.push(
            `Could not find a body site that matches with ${sr.body_site.display_names[0]}. Please enter manually.`,
          );
        }
      }

      // Resolve requester via facility users search; fall back to current user.
      let requester: UserBareMinimum = meta.currentUser;
      const requesterQuery = noNullStrings(sr.requester);
      if (requesterQuery) {
        try {
          const { results: users } = await API.facilityUsers.list(
            meta.facilityId,
            { search_text: requesterQuery, limit: 10 },
          );
          if (users.length) {
            const userFuse = new Fuse(users, {
              keys: ["first_name", "last_name", "username", "email"],
              ignoreLocation: true,
              includeScore: true,
              threshold: 0.4,
            });
            requester = userFuse.search(requesterQuery)[0]?.item || users[0];
          }
        } catch {
          // Ignore lookup failures and fall back to current user.
        }
      }

      const serviceRequest: ServiceRequest = {
        service_request: {
          title: matched.title,
          status: "active",
          intent: "order",
          priority:
            validateEnumDescription(sr.priority, SERVICE_REQUEST_PRIORITY) ||
            "routine",
          category: matched.classification,
          do_not_perform: false,
          note: noNullStrings(sr.note) || null,
          code: matched.code,
          body_site: bodySite,
          occurance: null,
          patient_instruction: noNullStrings(sr.patient_instruction) || null,
          requester,
        },
        activity_definition: matched.slug,
        encounter: meta.encounterId,
      };

      return serviceRequest;
    });

    const serviceRequests = (await Promise.all(parsed)).filter(
      (s) => !!s,
    ) as ServiceRequest[];

    // remove duplicates by activity_definition slug.
    const currentSlugs = new Set(
      currentData?.map((s) => s.activity_definition),
    );
    const merged = [
      ...(currentData || []),
      ...serviceRequests.filter(
        (s) => !currentSlugs.has(s.activity_definition),
      ),
    ];

    return {
      data: merged,
      errors,
    };
  },
  toPrompt: (data) => {
    const humanize = (str: string) => (
      <span className="capitalize">{str.replace(/_/g, " ")}</span>
    );
    return (
      <div className="mt-2 flex w-full flex-col gap-2">
        {data.map((entry, i) => {
          const sr = entry.service_request;
          return (
            <div
              key={i}
              className="w-full rounded-lg border border-black/5 bg-black/5 p-2 font-normal"
            >
              <div className="flex flex-wrap items-center gap-x-1 text-base font-semibold">
                {sr.title}
                <span className="rounded-xl bg-white/10 px-2 py-1 text-[10px] italic">
                  SNOMED: {sr.code.code}
                </span>
              </div>
              <div className="text-xs opacity-70">
                {humanize(sr.category)} &middot; Priority:{" "}
                {humanize(sr.priority)}
              </div>
              {sr.body_site && (
                <div className="flex flex-wrap items-center gap-x-1 text-sm">
                  Body Site: {sr.body_site.display}
                  <span className="rounded-xl bg-white/10 px-2 py-1 text-[10px] italic">
                    SNOMED: {sr.body_site.code}
                  </span>
                </div>
              )}
              {sr.patient_instruction && (
                <div className="mt-1 whitespace-pre-wrap opacity-90">
                  Patient Instruction: {sr.patient_instruction}
                </div>
              )}
              {sr.note && (
                <div className="mt-1 whitespace-pre-wrap italic opacity-80">
                  Note: {sr.note}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  },
};
