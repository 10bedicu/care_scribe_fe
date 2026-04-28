import { noNullStrings, Structure } from ".";
import { z } from "zod";
import { Code } from "@/types";
import dayjs from "dayjs";
import { allergyDisposition } from "./code";
import {
  lookupCode,
  shiftUTCToLocalClockTime,
  validateTime,
} from "../response-utils";
export const CLINICAL_STATUS = ["active", "inactive", "resolved"] as const;

export const CATEGORY = [
  "food",
  "medication",
  "environment",
  "biologic",
] as const;

export const CRITICALITY = ["low", "high", "unable-to-assess"] as const;

export const VERIFICATION_STATUS = [
  "unconfirmed",
  "presumed",
  "confirmed",
  "refuted",
  "entered-in-error",
] as const;
export interface AllergyIntolerance {
  code: Code;
  clinical_status: (typeof CLINICAL_STATUS)[number];
  category: (typeof CATEGORY)[number];
  criticality: (typeof CRITICALITY)[number];
  verification_status: (typeof VERIFICATION_STATUS)[number];
  last_occurrence?: string;
  note?: string;
}

const toolStructure = z.array(
  z.object({
    snomed_info: allergyDisposition(),
    clinical_status: z.enum(CLINICAL_STATUS).nullable(),
    category: z.enum(CATEGORY).nullable(),
    criticality: z.enum(CRITICALITY).nullable(),
    verification_status: z.enum(VERIFICATION_STATUS).nullable(),
    last_occurrence: z
      .string()
      .describe(`ISO format, e.g. "2023-10-01T12:00:00Z"`)
      .nullable(),
    note: z.string().nullable(),
  }),
);

export const allergyIntoleranceStructure: Structure<
  AllergyIntolerance[],
  typeof toolStructure
> = {
  name: "AllergyIntolerance",
  description: "Structure for allergy intolerance",
  toolStructure,
  deserialize: async (data, currentData) => {
    const errors: string[] = [];
    const d = data.map(async (allergyIntolerance) => {
      const code = await lookupCode(
        allergyIntolerance.snomed_info.code,
        allergyIntolerance.snomed_info.display_names.map(
          (d) =>
            d
              .replace(/^allergy to\s*/i, "") // removes "allergy to" from the start
              .replace(/\s*allergy$/i, ""), // removes "allergy" from the end
        ),
        "system-allergy-code",
      );
      if (!code) {
        errors.push(
          `Could not find an allergy that matches with ${allergyIntolerance.snomed_info.display_names[0]}. Please enter manually.`,
        );
        return undefined;
      }

      const lastOccurrence =
        allergyIntolerance.last_occurrence &&
        validateTime(allergyIntolerance.last_occurrence)
          ? shiftUTCToLocalClockTime(allergyIntolerance.last_occurrence)
          : undefined;

      const allergyIntoleranceData: AllergyIntolerance = {
        code,
        clinical_status: allergyIntolerance.clinical_status || "active",
        category: allergyIntolerance.category || "environment",
        criticality: allergyIntolerance.criticality || "low",
        verification_status:
          allergyIntolerance.verification_status || "confirmed",
        last_occurrence: lastOccurrence,
        note: noNullStrings(allergyIntolerance.note) || undefined,
      };
      return allergyIntoleranceData;
    });
    const allergies = (await Promise.all(d)).filter(
      (s) => !!s,
    ) as AllergyIntolerance[];
    // remove any duplicates
    const currentCodes = new Set(currentData?.map((s) => s.code.code));
    const merged = [
      ...(currentData || []),
      ...allergies.filter((s) => !currentCodes.has(s.code.code)),
    ];
    return {
      data: merged,
      errors,
    };
  },
  toPrompt: (data) => {
    return (
      <div className="mt-2 flex w-full flex-col gap-2">
        {data.map((allergy, i) => (
          <div
            key={i}
            className="w-full rounded-lg border border-black/5 bg-black/5 p-2 font-normal"
          >
            <div className="flex flex-wrap items-center gap-x-1 text-base font-semibold">
              {allergy.code.display}
              <span className="rounded-xl bg-white/10 px-2 py-1 text-[10px] italic">
                SNOMED: {allergy.code.code}
              </span>
            </div>

            <div className="text-xs opacity-70">
              Last occurrence :{" "}
              {dayjs(allergy.last_occurrence).format("DD/MM/YYYY")}
            </div>
            <div className="capitalize">
              {allergy.criticality} Criticality &middot;{" "}
              {allergy.clinical_status}
            </div>
          </div>
        ))}
      </div>
    );
  },
};
