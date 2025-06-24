import { Structure } from ".";
import { z } from "zod";
import { Code } from "@/types";
import { getCodeFromQuery, isoDateTime } from "../utils";
import dedent from "dedent-js";

const CLINICAL_STATUS = [
  "active",
  "recurrence",
  "relapse",
  "inactive",
  "remission",
  "resolved",
] as const;

const VERIFICATION_STATUS = [
  "unconfirmed",
  "provisional",
  "differential",
  "confirmed",
  "refuted",
  "entered-in-error",
] as const;

const CATEGORY = ["encounter_diagnosis", "chronic_condition"] as const;

interface Diagnosis {
  code: Code;
  clinical_status: (typeof CLINICAL_STATUS)[number];
  verification_status: (typeof VERIFICATION_STATUS)[number];
  onset: { onset_datetime: string };
  recorded_date: string;
  note?: string;
  category: (typeof CATEGORY)[number];
}

const toolStructure = z.array(
  z.object({
    diagnosis: z.string(),
    clinical_status: z.enum(CLINICAL_STATUS),
    verification_status: z.enum(VERIFICATION_STATUS),
    onset_datetime: isoDateTime,
    recorded_datetime: isoDateTime.optional(),
    note: z.string().optional(),
    category: z
      .enum(CATEGORY)
      .describe("Is this a chronic condition or normal encounter diagnosis?")
      .default("encounter_diagnosis"),
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
        const code = await getCodeFromQuery(
          diagnosis.diagnosis,
          "system-condition-code",
        );
        if (!code) {
          errors.push(
            `Copilot could not find a diagnosis that matches with ${diagnosis.diagnosis}. Please enter manually.`,
          );
          return undefined;
        }
        const diagnosisData: Diagnosis = {
          code,
          clinical_status: diagnosis.clinical_status,
          verification_status: diagnosis.verification_status,
          onset: {
            onset_datetime: diagnosis.onset_datetime,
          },
          recorded_date:
            diagnosis.recorded_datetime || new Date().toISOString(),
          note: diagnosis.note,
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
        - Diagnosis: ${diagnosis.code.display}
        - Clinical Status: ${diagnosis.clinical_status}, 
        - Verification Status: ${diagnosis.verification_status}, 
        - Onset: ${diagnosis.onset.onset_datetime}
        - Category: ${diagnosis.category}
        ${diagnosis.recorded_date ? `- Recorded Date: ${diagnosis.recorded_date}` : ""}
        ${diagnosis.note ? `- Note: ${diagnosis.note}` : ""}
        `,
        )
        .join("\n");
    },
  };
