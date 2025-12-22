import { noNullStrings, Structure } from ".";
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

export const DIAGNOSIS_SEVERITY = ["severe", "moderate", "mild"] as const;

export type DiagnosisSeverity = (typeof DIAGNOSIS_SEVERITY)[number];

type Diagnosis = {
  code: Code;
  clinical_status: (typeof CLINICAL_STATUS)[number];
  verification_status: (typeof VERIFICATION_STATUS)[number];
  severity: DiagnosisSeverity | null;
  onset: { onset_datetime: string };
  recorded_date: string;
  note?: string;
  category: "encounter_diagnosis" | "chronic_condition";
  dirty: boolean;
};

const toolStructure = z.array(
  z.object({
    snomed_info: finding(),
    clinical_status: z.enum(CLINICAL_STATUS).nullable(),
    verification_status: z.enum(VERIFICATION_STATUS).nullable(),
    severity: z
      .enum(DIAGNOSIS_SEVERITY)
      .nullable()
      .describe("Severity of the diagnosis. Only fill if explicitly known."),
    onset_datetime: z
      .string()
      .describe(
        `The time the onset occurred in ISO format, e.g. "2023-10-01T12:00:00Z". If not explicitly specified, use today's date.`,
      ),
    note: z.string().nullable(),
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
        const onsetDateTime = validateTime(diagnosis.onset_datetime)
          ? shiftUTCToLocalClockTime(diagnosis.onset_datetime)
          : new Date().toISOString();

        const diagnosisData: Diagnosis = {
          code,
          clinical_status: diagnosis.clinical_status || "active",
          verification_status: diagnosis.verification_status || "confirmed",
          onset: {
            onset_datetime: onsetDateTime,
          },
          severity: diagnosis.severity,
          recorded_date: new Date().toISOString(),
          note: noNullStrings(diagnosis.note) || undefined,
          category: "encounter_diagnosis",
          dirty: true,
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
      return (
        <div className="mt-2 flex w-full flex-col gap-2">
          {data.map((diagnosis, i) => (
            <div
              key={i}
              className="w-full rounded-lg border border-black/5 bg-black/5 p-2 font-normal"
            >
              <div className="text-base font-semibold">
                {diagnosis.code.display}{" "}
                {diagnosis.severity && (
                  <i className="text-xs italic">{diagnosis.severity}</i>
                )}
              </div>
              <div className="text-xs opacity-70">
                Since{" "}
                {dayjs(diagnosis.onset.onset_datetime).format("DD/MM/YYYY")}
              </div>
              <div className="capitalize">
                {diagnosis.verification_status} &middot;{" "}
                {diagnosis.clinical_status}
              </div>
              {diagnosis.note && (
                <div className="mt-1 whitespace-pre-wrap italic opacity-80">
                  Note: {diagnosis.note}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    },
  };
