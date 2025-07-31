import { noNullStrings, Structure } from ".";
import { z } from "zod";
import { Code } from "@/types";
import { lookupCode, shiftUTCToLocalClockTime } from "../utils";
import dedent from "dedent-js";
import dayjs from "dayjs";
import { finding } from "./code";

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

type Diagnosis = {
  code: Code;
  clinical_status: (typeof CLINICAL_STATUS)[number];
  verification_status: (typeof VERIFICATION_STATUS)[number];
  onset: { onset_datetime: string };
  recorded_date: string;
  note?: string;
  category: (typeof CATEGORY)[number];
};

const CATEGORY = ["encounter_diagnosis", "chronic_condition"] as const;
const toolStructure = z.array(
  z.object({
    snomed_info: finding(),
    clinical_status: z.enum(CLINICAL_STATUS).nullable(),
    verification_status: z.enum(VERIFICATION_STATUS).nullable(),
    onset_datetime: z
      .string()
      .describe(
        `The time the onset occurred in ISO format, e.g. "2023-10-01T12:00:00Z". If not explicitly specified, use today's date.`,
      ),
    note: z.string().nullable(),
    category: z
      .enum(CATEGORY)
      .describe(
        "Is this a chronic condition or normal encounter diagnosis?. If not specified, use 'encounter_diagnosis'.",
      ),
  }),
);

export const diagnosisStructure: Structure<Diagnosis[], typeof toolStructure> =
  {
    name: "Diagnosis",
    description: "Structure for diagnosis",
    toolStructure,
    deserialize: async (data, currentData) => {
      const errors: string[] = [];
      const d = data.map(async (diagnosis) => {
        const code = await lookupCode(
          diagnosis.snomed_info.code,
          diagnosis.snomed_info.display_names,
          "system-condition-code",
        );
        if (!code) {
          errors.push(
            `Could not find a diagnosis that matches with ${diagnosis.snomed_info.display_names[0]}. Please enter manually.`,
          );
          return undefined;
        }
        const diagnosisData: Diagnosis = {
          code,
          clinical_status: diagnosis.clinical_status || "active",
          verification_status: diagnosis.verification_status || "confirmed",
          onset: {
            onset_datetime: shiftUTCToLocalClockTime(diagnosis.onset_datetime),
          },
          recorded_date: new Date().toISOString(),
          note: noNullStrings(diagnosis.note) || undefined,
          category: diagnosis.category || "encounter_diagnosis",
        };
        return diagnosisData;
      });
      const diagnosis = (await Promise.all(d)).filter(
        (s) => !!s,
      ) as Diagnosis[];
      // remove any duplicates
      const currentCodes = new Set(currentData?.map((s) => s.code.code));
      const merged = [
        ...(currentData || []),
        ...diagnosis.filter((s) => !currentCodes.has(s.code.code)),
      ];
      return {
        data: merged,
        errors,
      };
    },
    toPrompt: (data) => {
      return data
        .map(
          (diagnosis, i) =>
            dedent`
        ### Diagnosis ${i + 1}: 
        - Diagnosis: ${diagnosis.code.display} (SNOMED Code: ${diagnosis.code.code})
        - Clinical Status: ${diagnosis.clinical_status}, 
        - Verification Status: ${diagnosis.verification_status}, 
        - Onset: ${dayjs(diagnosis.onset.onset_datetime).format("DD/MM/YYYY HH:mm")}
        - Category: ${diagnosis.category}
        ${diagnosis.recorded_date ? `- Recorded Date: ${diagnosis.recorded_date}` : ""}
        ${diagnosis.note ? `- Note: ${diagnosis.note}` : ""}
        `,
        )
        .join("\n");
    },
  };
