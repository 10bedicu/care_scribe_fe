import { Structure } from ".";
import { z } from "zod";
import { Code } from "@/types";
import { getCodeFromQuery, isoDateTime } from "../utils";
import { t } from "i18next";

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

const SEVERITY = ["severe", "moderate", "mild"] as const;

interface Symptom {
  code: Code;
  clinical_status: (typeof CLINICAL_STATUS)[number];
  verification_status: (typeof VERIFICATION_STATUS)[number];
  severity: (typeof SEVERITY)[number];
  onset: { onset_datetime: string };
}

const toolStructure = z.array(
  z.object({
    symptom: z.string(),
    clinical_status: z.enum(CLINICAL_STATUS),
    verification_status: z.enum(VERIFICATION_STATUS),
    severity: z.enum(SEVERITY),
    onset_datetime: isoDateTime,
    recorded_datetime: isoDateTime.optional(),
    note: z.string().optional(),
  }),
);

export const symptomsStructure: Structure<Symptom[], typeof toolStructure> = {
  name: "Symptoms",
  description: "Structure for symptoms",
  toolStructure,
  deserialize: async (data) => {
    const errors: string[] = [];
    const d = data
      .map(async (symptom) => {
        const code = await getCodeFromQuery(
          symptom.symptom,
          "system-condition-code",
        );
        if (!code) {
          errors.push(
            t("scribe_no_match", {
              valueType: "symptom",
              query: symptom.symptom,
            }),
          );
          return undefined;
        }
        const symptomData: Symptom = {
          code,
          clinical_status: symptom.clinical_status,
          verification_status: symptom.verification_status,
          severity: symptom.severity,
          onset: {
            onset_datetime: symptom.onset_datetime,
          },
        };
        return symptomData;
      })
      .filter((s) => !!s);
    return { data: (await Promise.all(d)) as Symptom[], errors };
  },
  toPrompt: (data) => {
    return data
      .map(
        (symptom, i) =>
          `
        ### Symptom ${i + 1}: 
        Symptom: ${symptom.code.display}
        Clinical Status: ${symptom.clinical_status}, 
        Verification Status: ${symptom.verification_status}, 
        Severity: ${symptom.severity}, 
        Onset: ${symptom.onset.onset_datetime}`,
      )
      .join("\n");
  },
};
