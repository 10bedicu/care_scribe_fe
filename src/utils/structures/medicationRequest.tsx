import {
  enumDescription,
  noNullStrings,
  Structure,
  validateEnumDescription,
} from ".";
import { z } from "zod";
import { Code, UserBareMinimum } from "@/types";
import {
  BOUNDS_DURATION_UNITS,
  DOSAGE_UNITS_CODES,
  MEDICATION_REQUEST_INTENT,
  MEDICATION_REQUEST_STATUS,
  MEDICATION_REQUEST_TIMING_OPTIONS,
} from "../constants";
import dayjs from "dayjs";
import {
  clinicalDrug,
  dosageMethod,
  dosageRoute,
  indicatorReason,
  instruction,
  site,
} from "./code";
import {
  lookupCode,
  shiftUTCToLocalClockTime,
  validateTime,
} from "../response-utils";

const CATEGORY = ["inpatient", "outpatient", "community", "discharge"] as const;
const PRIORITY = ["stat", "urgent", "asap", "routine"] as const;
type PeriodUnit = "s" | "min" | "h" | "d" | "wk" | "mo" | "a";

const doseQuantity = z.object({
  value: z.number(),
  unit: enumDescription(DOSAGE_UNITS_CODES.map((c) => c.display) as [string]),
});

const doseRange = z.object({
  low: doseQuantity,
  high: doseQuantity,
});

const toolStructure = z.array(
  z
    .object({
      intent: enumDescription(MEDICATION_REQUEST_INTENT).nullable(),
      category: enumDescription(CATEGORY),
      priority: enumDescription(PRIORITY),
      medicine: clinicalDrug(),
      authored_on: z.string(),
      dosage_instructions: instruction()
        .nullable()
        .describe(
          "Specify when the medication should be taken, for how long it should be continued, or under what condition it should be stopped. Do not assume or infer this value unless it is explicitly stated.",
        ),
      dosage_duration: z
        .object({
          value: z.number(),
          unit: enumDescription(BOUNDS_DURATION_UNITS),
        })
        .nullable().describe(`
        For medicine duration of
        •	10 days -> the value will be 10 and unit will be “d”.
        •	2 weeks -> the value will be 2 and unit will be “wk”.
        •	3 months -> the value will be 3 and unit will be “mo”.
        •	1 year -> the value will be 1 and unit will be “a”.
        ... and so on.
    `),
      dosage_frequency: enumDescription(
        Object.values(MEDICATION_REQUEST_TIMING_OPTIONS).map(
          (timing) => timing.timing.code.display,
        ) as [string],
      ),
      dosage_as_needed_for: indicatorReason()
        .nullable()
        .describe(
          "Indicator: Fill only if the medication is prescribed as needed (PRN), or if an indicator is explicitly provided. Do not assume or infer this value. If no indicator is stated, leave this field blank.",
        ),
      dosage_site: site()
        .nullable()
        .describe(
          "The site the medication should be administered at. Only required if medication is PRN or as-needed. Do not assume this value unless explicitly stated.",
        ),
      dosage_route: dosageRoute()
        .nullable()
        .describe(
          "The route of administration. Only required if medication is PRN or as-needed. Do not assume this value unless explicitly stated.",
        ),
      dosage_method: dosageMethod()
        .nullable()
        .describe(
          "The method of administration. Only required if medication is PRN or as-needed. Do not assume this value unless explicitly stated.",
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
        .nullable().describe(`
        One of \`dose_quantity\` or \`dose_range\` must be present.
        \`type\` is optional and defaults to \`ordered\`.
        
        - If \`type\` is \`ordered\`, \`dose_quantity\` must be present.
        - If \`type\` is \`calculated\`, \`dose_range\` must be present. This is used for titrated medications.
    `),
      dosage_max_dose_per_period: doseRange.nullable(),
      note: z.string().nullable(),
    })
    .describe(
      "This is the medication that will be prescribed to/requested for the patient. It is not the medication that the patient is currently taking.",
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

export interface ProductKnowledgeBase {
  id: string;
  slug: string;
  product_type: unknown;
  status: unknown;
  code?: Code;
  name: string;
  names: unknown[];
  storage_guidelines: unknown[];
  definitional?: unknown;
}

interface MedicationRequest {
  status?: (typeof MEDICATION_REQUEST_STATUS)[number];
  intent?: (typeof MEDICATION_REQUEST_INTENT)[number];
  category?: (typeof CATEGORY)[number];
  priority?: (typeof PRIORITY)[number];
  do_not_perform: boolean;
  medication?: Code;
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
  requested_product?: string;
  requested_product_internal?: ProductKnowledgeBase;
  dispense_status?: unknown;
  requester: UserBareMinimum;
}

export const medicationRequestStructure: Structure<
  MedicationRequest[],
  typeof toolStructure
> = {
  name: "Medication Request",
  description: "Structure for medication requests",
  toolStructure,
  deserialize: async (data, currentData, meta) => {
    const errors: string[] = [];

    const parsed = data.map(async (medicationRequest) => {
      const code = await lookupCode(
        medicationRequest.medicine.code,
        medicationRequest.medicine.display_names,
        "system-medication",
      );
      if (!code) {
        errors.push(
          `Could not find a medication that matches with ${medicationRequest.medicine.display_names[0]}. Please enter manually.`,
        );
        return undefined;
      }
      const additionalInstructions = medicationRequest.dosage_instructions
        ? await lookupCode(
            medicationRequest.dosage_instructions.code,
            medicationRequest.dosage_instructions.display_names,
            "system-additional-instruction",
          )
        : undefined;

      const asNeededFor = medicationRequest.dosage_as_needed_for
        ? await lookupCode(
            medicationRequest.dosage_as_needed_for.code,
            medicationRequest.dosage_as_needed_for.display_names,
            "system-as-needed-reason",
          )
        : undefined;

      const site = medicationRequest.dosage_site
        ? await lookupCode(
            medicationRequest.dosage_site.code,
            medicationRequest.dosage_site.display_names,
            "system-body-site",
          )
        : undefined;

      const route = medicationRequest.dosage_route
        ? await lookupCode(
            medicationRequest.dosage_route.code,
            medicationRequest.dosage_route.display_names,
            "system-route",
          )
        : undefined;

      const method = medicationRequest.dosage_method
        ? await lookupCode(
            medicationRequest.dosage_method.code,
            medicationRequest.dosage_method.display_names,
            "system-administration-method",
          )
        : undefined;

      const authoredOn = validateTime(medicationRequest.authored_on)
        ? shiftUTCToLocalClockTime(medicationRequest.authored_on)
        : new Date().toISOString();

      const dosageTiming = Object.values(
        MEDICATION_REQUEST_TIMING_OPTIONS,
      )?.find(
        (timing) =>
          timing.timing.code.display === medicationRequest.dosage_frequency,
      );
      const medReq: MedicationRequest = {
        medication: code,
        intent:
          validateEnumDescription(
            medicationRequest.intent,
            MEDICATION_REQUEST_INTENT,
          ) || "order",
        status: "active",
        category: validateEnumDescription(medicationRequest.category, CATEGORY),
        priority: validateEnumDescription(medicationRequest.priority, PRIORITY),
        do_not_perform: false,
        authored_on: authoredOn,
        dosage_instruction: [
          {
            additional_instruction: additionalInstructions
              ? [additionalInstructions]
              : [],
            timing:
              dosageTiming && !medicationRequest.dosage_as_needed_for
                ? {
                    repeat: {
                      frequency: dosageTiming?.timing.repeat.frequency,
                      period: dosageTiming?.timing.repeat.period,
                      period_unit: dosageTiming?.timing.repeat.period_unit,
                      bounds_duration: {
                        value: medicationRequest.dosage_duration?.value || 1,
                        unit:
                          validateEnumDescription(
                            medicationRequest.dosage_duration?.unit,
                            BOUNDS_DURATION_UNITS,
                          ) || "d",
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
        note: noNullStrings(medicationRequest.note) || undefined,
        requester: meta.currentUser,
      };
      return medReq;
    });
    const newMedReq = (await Promise.all(parsed)).filter(
      (s) => !!s,
    ) as MedicationRequest[];
    // remove any duplicates
    const currentCodes = new Set(currentData?.map((s) => s.medication?.code));
    const merged = [
      ...(currentData || []),
      ...newMedReq.filter((s) => !currentCodes.has(s.medication?.code)),
    ];
    return {
      data: merged,
      errors,
    };
  },
  toPrompt: (data) => {
    return (
      <div className="mt-2 flex w-full flex-col gap-2">
        {data.map((medicationRequest, i) => (
          <div
            key={i}
            className="w-full rounded-lg border border-black/5 bg-black/5 p-2 font-normal"
          >
            <div className="flex flex-wrap items-center gap-x-1 text-base font-semibold">
              {medicationRequest.medication &&
              "display" in medicationRequest.medication
                ? medicationRequest.medication.display
                : medicationRequest.requested_product_internal
                  ? medicationRequest.requested_product_internal.code?.display
                  : "N/A"}{" "}
              <span className="text-xs font-normal capitalize opacity-70">
                {medicationRequest.intent?.replace("_", " ")}
              </span>
              <span className="rounded-xl bg-white/10 px-2 py-1 text-[10px] italic">
                SNOMED:{" "}
                {medicationRequest.medication?.code ||
                  medicationRequest.requested_product_internal?.code?.code ||
                  "N/A"}
              </span>
            </div>
            <div className="text-xs opacity-70">
              Authored On{" "}
              {dayjs(medicationRequest.authored_on).format("DD/MM/YYYY")}
            </div>
            <div>
              {medicationRequest.dosage_instruction.map((instruction, idx) => (
                <div key={idx} className="mt-1">
                  <div className="font-semibold">
                    {instruction.dose_and_rate?.dose_quantity
                      ? `${instruction.dose_and_rate.dose_quantity.value} ${instruction.dose_and_rate.dose_quantity.unit.display}`
                      : instruction.dose_and_rate?.dose_range
                        ? `${instruction.dose_and_rate.dose_range.low.value} ${instruction.dose_and_rate.dose_range.low.unit.display} -> ${instruction.dose_and_rate.dose_range.high.value} ${instruction.dose_and_rate.dose_range.high.unit.display}`
                        : ""}
                  </div>
                  {instruction.as_needed_boolean && (
                    <div className="mb-2 border-b border-b-black/10 pb-2">
                      Take as needed (PRN){" "}
                      {instruction.as_needed_for?.display
                        ? "for : " + instruction.as_needed_for.display
                        : ""}
                    </div>
                  )}
                  {instruction.timing && !instruction.as_needed_boolean && (
                    <div className="mb-2 border-b border-b-black/10 pb-2">
                      Frequency: {instruction.timing.code.code} -{" "}
                      {instruction.timing.code.display}
                      <br />
                      Duration:{" "}
                      {instruction.timing.repeat.bounds_duration.value}{" "}
                      {instruction.timing.repeat.bounds_duration.unit}
                    </div>
                  )}
                  {instruction.additional_instruction?.[0]?.display && (
                    <div className="mb-2 border-b border-b-black/10 pb-2">
                      Instructions:{" "}
                      {instruction.additional_instruction?.[0]?.display}
                    </div>
                  )}
                  {instruction.site?.display && (
                    <div className="mb-2 border-b border-b-black/10 pb-2">
                      Site: {instruction.site?.display}
                    </div>
                  )}

                  {instruction.route?.display && (
                    <div className="mb-2 border-b border-b-black/10 pb-2">
                      Route: {instruction.route?.display}
                    </div>
                  )}
                  {instruction.method?.display && (
                    <div className="mb-2 border-b border-b-black/10 pb-2">
                      Method: {instruction.method?.display}
                    </div>
                  )}
                </div>
              ))}
            </div>
            {medicationRequest.note && (
              <div className="mt-1 whitespace-pre-wrap italic opacity-80">
                Note: {medicationRequest.note}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  },
};
