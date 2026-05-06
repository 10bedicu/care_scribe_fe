import { noNullStrings, Structure } from ".";
import { z } from "zod";
import { Code } from "@/types";
import { MEDICATION_STATEMENT_STATUS } from "../constants";
import dayjs from "dayjs";
import { clinicalDrug } from "./code";
import {
  lookupCode,
  shiftUTCToLocalClockTime,
  validateTime,
} from "../response-utils";

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
      information_source: z.enum(INFORMATION_SOURCE).nullable(),
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
        .describe(
          `End date/time in ISO format. 
          Do not fill if medicine still being taken or end date not known.
          e.g. "2023-10-01T12:00:00Z"`,
        )
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
    end?: string;
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

      // validate time fields
      const takeFrom = validateTime(medicationStatement.take_from);

      const takeUntil = validateTime(medicationStatement.take_until);

      const medStatement: MedicationStatement = {
        medication: code,
        status: "active",
        dosage_text: medicationStatement.dosage_instructions || undefined,
        information_source: medicationStatement.information_source || "patient",
        note: noNullStrings(medicationStatement.note) || undefined,
        reason: medicationStatement.reason || undefined,
        effective_period: takeFrom
          ? {
              start: shiftUTCToLocalClockTime(takeFrom),
              end: takeUntil ? shiftUTCToLocalClockTime(takeUntil) : undefined,
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
    return (
      <div className="mt-2 flex w-full flex-col gap-2">
        {data.map((medication, i) => (
          <div
            key={i}
            className="w-full rounded-lg border border-black/5 bg-black/5 p-2 font-normal"
          >
            <div className="flex flex-wrap items-center gap-x-1 text-base font-semibold">
              {medication.medication.display}
              <span className="text-xs font-normal opacity-70">
                {medication.status}
              </span>
              <span className="rounded-xl bg-white/10 px-2 py-1 text-[10px] italic">
                SNOMED: {medication.medication.code}
              </span>
            </div>

            {medication.effective_period && (
              <div className="text-xs opacity-70">
                Taken from{" "}
                {dayjs(medication.effective_period.start).format("DD/MM/YYYY")}{" "}
                {"->"}{" "}
                {medication.effective_period.end
                  ? dayjs(medication.effective_period.end).format("DD/MM/YYYY")
                  : "Present"}
              </div>
            )}
            {medication.dosage_text && (
              <div className="mb-2 border-b border-b-black/10 pb-2">
                Instructions: {medication.dosage_text}
              </div>
            )}
            {medication.information_source && (
              <div className="mb-2 border-b border-b-black/10 pb-2">
                Source: {medication.information_source}
              </div>
            )}
            {medication.reason && (
              <div className="mb-2 border-b border-b-black/10 pb-2">
                Reason: {medication.reason}
              </div>
            )}
            {medication.note && (
              <div className="mt-1 whitespace-pre-wrap italic opacity-80">
                Note: {medication.note}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  },
};
