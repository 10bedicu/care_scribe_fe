import { noNullStrings, Structure } from ".";
import { z } from "zod";
import { Code } from "@/types";
import { lookupCode, shiftUTCToLocalClockTime } from "../utils";
import { MEDICATION_STATEMENT_STATUS } from "../constants";
import dedent from "dedent-js";
import dayjs from "dayjs";
import { clinicalDrug } from "./code";

export const INFORMATION_SOURCE = [
  "patient",
  "practitioner",
  "related_person",
] as const;

const toolStructure = z.array(
  z
    .object({
      dosage_instructions: z
        .string()
        .nullable()
        .describe(
          "Dosage instructions for the medication, e.g. 'Take 1 tablet daily'",
        ),
      medication: clinicalDrug().describe(
        "The medications that the patient declares they are currently taking. This is not medication that is being prescribed",
      ),
      note: z
        .string()
        .nullable()
        .describe("Additional notes regarding the medication statement"),
      reason: z
        .string()
        .nullable()
        .describe("Reason for prescribing or taking the medication"),
      take_from: z
        .string()
        .describe(`Start date/time in ISO format, e.g. "2023-10-01T12:00:00Z"`)
        .nullable(),
      take_until: z
        .string()
        .describe(`End date/time in ISO format, e.g. "2023-10-01T12:00:00Z"`)
        .nullable(),
    })
    .describe(
      "This is the medication that the patient is currently taking. It is not the medication that is being prescribed or the medication that is being requested.",
    ),
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
      const code = await lookupCode(
        medicationStatement.medication.code,
        medicationStatement.medication.display_names,
        "system-medication",
      );

      if (!code) {
        errors.push(
          `Could not find a medication that matches with ${medicationStatement.medication.display_names[0]}. Please enter manually.`,
        );
        return undefined;
      }

      const medStatement: MedicationStatement = {
        medication: code,
        status: "active",
        dosage_text: medicationStatement.dosage_instructions || undefined,
        information_source: "patient",
        note: noNullStrings(medicationStatement.note) || undefined,
        reason: medicationStatement.reason || undefined,
        effective_period: medicationStatement.take_from
          ? {
              start: medicationStatement.take_from,
              end: medicationStatement.take_until
                ? shiftUTCToLocalClockTime(medicationStatement.take_until)
                : new Date().toISOString(),
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
        - Medication: ${medicationStatement.medication.display} (SNOMED Code: ${medicationStatement.medication.code})
        - Status: ${medicationStatement.status}
        - Dosage Instructions: ${medicationStatement.dosage_text || "N/A"}
        - Information Source: ${medicationStatement.information_source || "N/A"}
        - Effective Period: ${medicationStatement.effective_period ? `${dayjs(medicationStatement.effective_period.start).format("DD/MM/YYYY")} to ${dayjs(medicationStatement.effective_period.end).format("DD/MM/YYYY")}` : "N/A"}
        ${medicationStatement.note ? `- Note: ${medicationStatement.note}` : ""}
        ${medicationStatement.reason ? `- Reason: ${medicationStatement.reason}` : ""}
      `,
      )
      .join("\n");
  },
};
