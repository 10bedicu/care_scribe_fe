import { Structure } from ".";
import { z } from "zod";
import { Code } from "@/types";
import { getCodeFromQuery } from "../utils";
import {
  BOUNDS_DURATION_UNITS,
  DOSAGE_UNITS_CODES,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  MEDICATION_REQUEST_TIMING_OPTIONS,
} from "../constants";

const CATEGORY = ["inpatient", "outpatient", "community", "discharge"] as const;
const PRIORITY = ["stat", "urgent", "asap", "routine"] as const;
type PeriodUnit = "s" | "min" | "h" | "d" | "wk" | "mo" | "a";

const doseQuantity = z.object({
  value: z.number(),
  unit: z.enum(DOSAGE_UNITS_CODES.map((c) => c.display) as [string]),
});

const doseRange = z.object({
  low: doseQuantity,
  high: doseQuantity,
});

const toolStructure = z.array(
  z.object({
    status: z.enum(MEDICATION_REQUEST_STATUS).default("active"),
    intent: z.enum(MEDICATION_REQUEST_INTENT).optional(),
    category: z.enum(CATEGORY).default("inpatient"),
    priority: z.enum(PRIORITY).default("stat"),
    medicine: z.string().describe("The medicine to prescribe"),
    authored_on: z.string().default(new Date().toISOString()),
    dosage_instructions: z
      .string()
      .optional()
      .describe(
        "To indicate when the medication should be taken or until when it should be taken, etc.",
      ),
    dosage_duration: z
      .object({
        value: z.number(),
        unit: z.enum(BOUNDS_DURATION_UNITS),
      })
      .optional().describe(`
        For medicine duration of
        •	10 days -> the value will be 10 and unit will be “d”.
        •	2 weeks -> the value will be 2 and unit will be “wk”.
        •	3 months -> the value will be 3 and unit will be “mo”.
        •	1 year -> the value will be 1 and unit will be “a”.
        ... and so on.
    `),
    dosage_timing_code: z.enum(
      Object.values(MEDICATION_REQUEST_TIMING_OPTIONS).map(
        (timing) => timing.timing.code.display,
      ) as [string],
    ),
    dosage_as_needed_for: z
      .string()
      .optional()
      .describe(
        "The indicator. Only required if the medication is PRN or as-needed",
      ),
    dosage_site: z
      .string()
      .optional()
      .describe(
        "The site the medication should be administered at. Only required if medication is PRN or as-needed",
      ),
    dosage_route: z
      .string()
      .optional()
      .describe(
        "The route of administration. Only required if medication is PRN or as-needed",
      ),
    dosage_method: z
      .string()
      .optional()
      .describe(
        "The method of administration. Only required if medication is PRN or as-needed",
      ),
    dosage_dose_and_rate: z
      .union([
        z.object({
          type: z.literal("ordered"),
          dose_quantity: doseQuantity,
        }),
        z.object({
          type: z.literal("calculated"),
          dose_range: doseRange,
        }),
      ])
      .optional().describe(`
        One of \`dose_quantity\` or \`dose_range\` must be present.
        \`type\` is optional and defaults to \`ordered\`.
        
        - If \`type\` is \`ordered\`, \`dose_quantity\` must be present.
        - If \`type\` is \`calculated\`, \`dose_range\` must be present. This is used for titrated medications.
    `),
    dosage_max_dose_per_period: doseRange.optional(),
    note: z.string().optional(),
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

interface MedicationRequest {
  status?: (typeof MEDICATION_REQUEST_STATUS)[number];
  intent?: (typeof MEDICATION_REQUEST_INTENT)[number];
  category?: (typeof CATEGORY)[number];
  priority?: (typeof PRIORITY)[number];
  do_not_perform: boolean;
  medication: Code;
  authored_on: string;
  dosage_instruction: [
    {
      additional_instruction?: Code[];
      timing?: {
        repeat: {
          frequency: number;
          period: number;
          period_unit: PeriodUnit;
          bounds_duration: {
            value: number;
            unit: PeriodUnit;
          };
        };
        code: Code;
      };
      as_needed_boolean: boolean;
      as_needed_for?: Code;
      site?: Code;
      route?: Code;
      method?: Code;
      dose_and_rate?: {
        type: "ordered" | "calculated";
        dose_quantity?: DosageQuantity;
        dose_range?: DoseRange;
      };
      max_dose_per_period?: DoseRange;
    },
  ];
  note?: string;
}

export const medicationRequestStructure: Structure<
  MedicationRequest[],
  typeof toolStructure
> = {
  name: "Medication Request",
  description: "Structure for medication requests",
  toolStructure,
  deserialize: async (data, currentData) => {
    const errors: string[] = [];

    const parsed = data.map(async (medicationRequest) => {
      const code = await getCodeFromQuery(
        medicationRequest.medicine,
        "system-medication",
      );
      const additionalInstructions = medicationRequest.dosage_instructions
        ? await getCodeFromQuery(
            medicationRequest.dosage_instructions,
            "system-additional-instruction",
          )
        : undefined;

      const asNeededFor = medicationRequest.dosage_as_needed_for
        ? await getCodeFromQuery(
            medicationRequest.dosage_as_needed_for,
            "system-as-needed-reason",
          )
        : undefined;

      const site = medicationRequest.dosage_site
        ? await getCodeFromQuery(
            medicationRequest.dosage_site,
            "system-body-site",
          )
        : undefined;

      const route = medicationRequest.dosage_route
        ? await getCodeFromQuery(medicationRequest.dosage_route, "system-route")
        : undefined;

      const method = medicationRequest.dosage_method
        ? await getCodeFromQuery(
            medicationRequest.dosage_method,
            "system-administration-method",
          )
        : undefined;

      if (!code) {
        errors.push(
          `Copilot could not find a medication that matches with ${medicationRequest.medicine}. Please enter manually.`,
        );
        return undefined;
      }

      const dosageTiming = Object.values(
        MEDICATION_REQUEST_TIMING_OPTIONS,
      )?.find(
        (timing) =>
          timing.timing.code.display === medicationRequest.dosage_timing_code,
      );
      const medReq: MedicationRequest = {
        medication: code,
        intent: medicationRequest.intent,
        status: medicationRequest.status,
        category: medicationRequest.category,
        priority: medicationRequest.priority,
        do_not_perform: false,
        authored_on: medicationRequest.authored_on || new Date().toISOString(),
        dosage_instruction: [
          {
            additional_instruction: additionalInstructions
              ? [additionalInstructions]
              : [],
            timing: dosageTiming
              ? {
                  repeat: {
                    frequency: dosageTiming?.timing.repeat.frequency,
                    period: dosageTiming?.timing.repeat.period,
                    period_unit: dosageTiming?.timing.repeat.period_unit,
                    bounds_duration: medicationRequest.dosage_duration || {
                      value: 1,
                      unit: "d",
                    },
                  },
                  code: dosageTiming?.timing.code,
                }
              : undefined,
            as_needed_boolean: !!medicationRequest.dosage_as_needed_for,
            as_needed_for: asNeededFor || undefined,
            site: site || undefined,
            route: route || undefined,
            method: method || undefined,
            dose_and_rate: medicationRequest.dosage_dose_and_rate
              ? {
                  type: medicationRequest.dosage_dose_and_rate.type,
                  dose_quantity:
                    medicationRequest.dosage_dose_and_rate.type === "ordered"
                      ? {
                          value:
                            medicationRequest.dosage_dose_and_rate.dose_quantity
                              .value,
                          unit: {
                            code:
                              DOSAGE_UNITS_CODES.find(
                                (c) =>
                                  c.display ===
                                  (
                                    medicationRequest.dosage_dose_and_rate as any
                                  ).dose_quantity.unit,
                              )?.code || "unknown",
                            display: (
                              medicationRequest.dosage_dose_and_rate as any
                            ).dose_quantity.unit,
                            system: "http://unitsofmeasure.org",
                          },
                        }
                      : undefined,
                  dose_range:
                    medicationRequest.dosage_dose_and_rate.type === "calculated"
                      ? {
                          low: {
                            value:
                              medicationRequest.dosage_dose_and_rate.dose_range
                                .low.value,
                            unit: {
                              code:
                                DOSAGE_UNITS_CODES.find(
                                  (c) =>
                                    c.display ===
                                    (
                                      medicationRequest.dosage_dose_and_rate as any
                                    ).dose_range.low.unit,
                                )?.code || "unknown",
                              display: (
                                medicationRequest.dosage_dose_and_rate as any
                              ).dose_range.low.unit,
                              system: "http://unitsofmeasure.org",
                            },
                          },
                          high: {
                            value:
                              medicationRequest.dosage_dose_and_rate.dose_range
                                .high.value,
                            unit: {
                              code:
                                DOSAGE_UNITS_CODES.find(
                                  (c) =>
                                    c.display ===
                                    (
                                      medicationRequest.dosage_dose_and_rate as any
                                    ).dose_range.high.unit,
                                )?.code || "unknown",
                              display: (
                                medicationRequest.dosage_dose_and_rate as any
                              ).dose_range.high.unit,
                              system: "http://unitsofmeasure.org",
                            },
                          },
                        }
                      : undefined,
                }
              : undefined,
            max_dose_per_period: medicationRequest.dosage_max_dose_per_period
              ? {
                  low: {
                    value:
                      medicationRequest.dosage_max_dose_per_period.low.value,
                    unit: {
                      code:
                        DOSAGE_UNITS_CODES.find(
                          (c) =>
                            c.display ===
                            medicationRequest.dosage_max_dose_per_period?.low
                              .unit,
                        )?.code || "unknown",
                      display:
                        medicationRequest.dosage_max_dose_per_period.low.unit,
                      system: "http://unitsofmeasure.org",
                    },
                  },
                  high: {
                    value:
                      medicationRequest.dosage_max_dose_per_period.high.value,
                    unit: {
                      code:
                        DOSAGE_UNITS_CODES.find(
                          (c) =>
                            c.display ===
                            medicationRequest.dosage_max_dose_per_period?.high
                              .unit,
                        )?.code || "unknown",
                      display:
                        medicationRequest.dosage_max_dose_per_period.high.unit,
                      system: "http://unitsofmeasure.org",
                    },
                  },
                }
              : undefined,
          },
        ],
        note: medicationRequest.note,
      };
      return medReq;
    });
    const symptoms = (await Promise.all(parsed)).filter(
      (s) => !!s,
    ) as MedicationRequest[];
    // remove any duplicates in currentData
    const newCodes = new Set(symptoms?.map((s) => s.medication.code));
    const merged = [
      ...(currentData?.filter((s) => !newCodes.has(s.medication.code)) || []),
      ...symptoms,
    ];
    return {
      data: merged,
      errors,
    };
  },
  toPrompt: (data) => {
    return data
      .map(
        (medicationRequest, i) =>
          `
        ### Medication Request ${i + 1}: 
        Medication: ${medicationRequest.medication}
        Status: ${medicationRequest.status || "active"}
        Intent: ${medicationRequest.intent || "unknown"}
        Category: ${medicationRequest.category || "inpatient"}
        Priority: ${medicationRequest.priority || "stat"}
        Authored On: ${medicationRequest.authored_on}
        Dosage Instructions: ${medicationRequest.dosage_instruction.map(
          (instruction) => {
            return `
          Additional Instruction: ${
            instruction.additional_instruction
              ?.map((inst) => inst.display)
              .join(", ") || "N/A"
          }
            Timing: ${instruction.timing ? `Frequency: ${instruction.timing.repeat.frequency}, Period: ${instruction.timing.repeat.period} ${instruction.timing.repeat.period_unit}, Bounds Duration: ${instruction.timing.repeat.bounds_duration.value} ${instruction.timing.repeat.bounds_duration.unit}` : "N/A"}
            As Needed: ${instruction.as_needed_boolean ? "Yes" : "No"}
            As Needed For: ${instruction.as_needed_for ? instruction.as_needed_for.display : "N/A"}
            Site: ${instruction.site ? instruction.site.display : "N/A"}
            Route: ${instruction.route ? instruction.route.display : "N/A"}
            Method: ${instruction.method ? instruction.method.display : "N/A"}
            Dose and Rate: ${
              instruction.dose_and_rate
                ? instruction.dose_and_rate.type === "ordered"
                  ? `Ordered: ${instruction.dose_and_rate.dose_quantity?.value} ${instruction.dose_and_rate.dose_quantity?.unit.display}`
                  : `Calculated: Low: ${instruction.dose_and_rate.dose_range?.low.value} ${instruction.dose_and_rate.dose_range?.low.unit.display}, High: ${instruction.dose_and_rate.dose_range?.high.value} ${instruction.dose_and_rate.dose_range?.high.unit.display}`
                : "N/A"
            }
            Max Dose Per Period: ${
              instruction.max_dose_per_period
                ? `Low: ${instruction.max_dose_per_period.low.value} ${instruction.max_dose_per_period.low.unit.display}, High: ${instruction.max_dose_per_period.high.value} ${instruction.max_dose_per_period.high.unit.display}`
                : "N/A"
            }
            `;
          },
        )}
        ${medicationRequest.note ? `Note: ${medicationRequest.note}` : ""}
        `,
      )
      .join("\n");
  },
};
