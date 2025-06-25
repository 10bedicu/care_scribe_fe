import { Structure } from ".";
import { z } from "zod";
import { Code } from "@/types";
import { getCodeFromQuery } from "../utils";
import { MEDICATION_STATEMENT_STATUS } from "../constants";
import dedent from "dedent-js";

export const INFORMATION_SOURCE = [
  "patient",
  "practitioner",
  "related_person",
] as const;

const toolStructure = z.array(
  z.object({
    status: z.enum(MEDICATION_STATEMENT_STATUS),
    dosage_instructions: z.string().optional(),
    information_source: z.enum(INFORMATION_SOURCE),
    medication: z.string().describe("The medication that has been requested"),
    note: z.string().optional(),
    reason: z.string().optional(),
    take_from: z
      .string()
      .describe(`ISO format, e.g. "2023-10-01T12:00:00Z"`)
      .optional(),
    take_until: z
      .string()
      .describe(`ISO format, e.g. "2023-10-01T12:00:00Z"`)
      .optional(),
  }),
);

export interface DosageQuantity {
  value: number;
  unit: Code;
}

export interface DoseRange {
  low: DosageQuantity;
  high: DosageQuantity;
}

interface MedicationStatement {
  status: (typeof MEDICATION_STATEMENT_STATUS)[number];
  dosage_text?: string;
  information_source?: (typeof INFORMATION_SOURCE)[number];
  medication: Code;
  note?: string;
  reason?: string;
  effective_period?: {
    start: string;
    end: string;
  };
}

export const medicationStatementStructure: Structure<
  MedicationStatement[],
  typeof toolStructure
> = {
  name: "Medication Statement",
  description: "Structure for medication statements",
  toolStructure,
  deserialize: async (data, currentData) => {
    const errors: string[] = [];

    const parsed = data.map(async (medicationStatement) => {
      const code = await getCodeFromQuery(
        medicationStatement.medication,
        "system-medication",
      );

      if (!code) {
        errors.push(
          `Copilot could not find a medication that matches with ${medicationStatement.medication}. Please enter manually.`,
        );
        return undefined;
      }

      const medStatement: MedicationStatement = {
        medication: code,
        status: medicationStatement.status,
        dosage_text: medicationStatement.dosage_instructions,
        information_source: medicationStatement.information_source,
        note: medicationStatement.note,
        reason: medicationStatement.reason,
        effective_period: medicationStatement.take_from
          ? {
              start: medicationStatement.take_from,
              end: medicationStatement.take_until || new Date().toISOString(),
            }
          : undefined,
      };
      return medStatement;
    });
    const statements = (await Promise.all(parsed)).filter(
      (s) => !!s,
    ) as MedicationStatement[];
    // remove any duplicates in currentData
    const currentCodes = new Set(currentData?.map((s) => s.medication.code));
    const merged = [
      ...(currentData || []),
      ...statements.filter((s) => !currentCodes.has(s.medication.code)),
    ];
    return {
      data: merged,
      errors,
    };
  },
  toPrompt: (data) => {
    return data
      .map(
        (medicationStatement, i) =>
          dedent`
        ### Medication Statement ${i + 1}: 
        - Medication: ${medicationStatement.medication.display}
        - Status: ${medicationStatement.status}
        - Dosage Instructions: ${medicationStatement.dosage_text || "N/A"}
        - Information Source: ${medicationStatement.information_source || "N/A"}
        - Effective Period: ${medicationStatement.effective_period ? `${medicationStatement.effective_period.start} to ${medicationStatement.effective_period.end}` : "N/A"}
        ${medicationStatement.note ? `- Note: ${medicationStatement.note}` : ""}
        ${medicationStatement.reason ? `- Reason: ${medicationStatement.reason}` : ""}
      `,
      )
      .join("\n");
  },
};
