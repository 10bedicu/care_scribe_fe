import { Structure } from ".";
import { z } from "zod";
import { Code } from "@/types";
import dayjs from "dayjs";
import { finding } from "./code";
import {
  lookupCode,
  shiftUTCToLocalClockTime,
  validateTime,
} from "../response-utils";

export const CLINICAL_STATUS = [
  "active",
  "recurrence",
  "relapse",
  "inactive",
  "remission",
  "resolved",
] as const;

export const VERIFICATION_STATUS = [
  "unconfirmed",
  "provisional",
  "differential",
  "confirmed",
  "refuted",
  "entered-in-error",
] as const;

export const SEVERITY = ["severe", "moderate", "mild"] as const;

type Symptom = {
  code: Code;
  clinical_status: (typeof CLINICAL_STATUS)[number];
  verification_status: (typeof VERIFICATION_STATUS)[number];
  severity: (typeof SEVERITY)[number];
  onset: { onset_datetime: string };
  category: "problem_list_item";
};

const toolStructure = z.array(
  z.object({
    snomed_info: finding(),
    clinical_status: z.enum(CLINICAL_STATUS).nullable(),
    verification_status: z.enum(VERIFICATION_STATUS).nullable(),
    severity: z.enum(SEVERITY).nullable(),
    onset_datetime: z
      .string()
      .describe(
        `Time the symptoms started. If not explicitly specified, use today's date. ISO format, e.g. "2023-10-01T12:00:00Z"`,
      ),
    note: z.string().nullable(),
  }),
);

export const symptomsStructure: Structure<Symptom[], typeof toolStructure> = {
  name: "Symptoms",
  description: "Structure for symptoms",
  toolStructure,
  deserialize: async (data, currentData) => {
    const errors: string[] = [];
    const d = data.map(async (symptom) => {
      const code = await lookupCode(
        symptom.snomed_info.code,
        symptom.snomed_info.display_names,
        "system-condition-code",
      );
      if (!code) {
        errors.push(
          `Could not find a symptom that matches with ${symptom.snomed_info.display_names}. Please enter manually.`,
        );
        return undefined;
      }
      const onsetDateTime = validateTime(symptom.onset_datetime)
        ? shiftUTCToLocalClockTime(symptom.onset_datetime)
        : new Date().toISOString();
      const symptomData: Symptom = {
        code,
        clinical_status: symptom.clinical_status || "active",
        verification_status: symptom.verification_status || "confirmed",
        severity: symptom.severity || "moderate",
        onset: {
          onset_datetime: onsetDateTime,
        },
        category: "problem_list_item",
      };
      return symptomData;
    });
    const symptoms = (await Promise.all(d)).filter((s) => !!s) as Symptom[];
    // remove any duplicates
    const currentCodes = new Set(currentData?.map((s) => s.code.code));
    const merged = [
      ...(currentData || []),
      ...symptoms.filter((s) => !currentCodes.has(s.code.code)),
    ];

    return {
      data: merged,
      errors,
    };
  },
  toPrompt: (data) => {
    return (
      <div className="mt-2 flex w-full flex-col gap-2">
        {data.map((symptom, i) => (
          <div
            key={i}
            className="w-full rounded-lg border border-black/5 bg-black/5 p-2 font-normal"
          >
            <div className="flex flex-wrap items-center gap-x-1 text-base font-semibold">
              {symptom.code.display}
              <span className="text-xs font-normal opacity-70">
                {symptom.severity}
              </span>
              <span className="rounded-xl bg-white/10 px-2 py-1 text-[10px] italic">
                SNOMED: {symptom.code.code}
              </span>
            </div>
            <div className="text-xs opacity-70">
              Since {dayjs(symptom.onset.onset_datetime).format("DD/MM/YYYY")}
            </div>
            <div className="capitalize">
              {symptom.verification_status} &middot; {symptom.clinical_status}
            </div>
          </div>
        ))}
      </div>
    );
  },
};
