import { ScribePromptMap, ValueSetSystem } from "@/types";
import dayjs from "dayjs";
import z from "zod"

export const BOUNDS_DURATION_UNITS = [
    // TODO: Are these smaller units required?
    // "ms",
    // "s,
    // "min",
    "h",
    "d",
    "wk",
    "mo",
    "a",
] as const;

const MEDICATION_STATEMENT_STATUS = [
    "active",
    "on_hold",
    "completed",
    "stopped",
    "unknown",
    "entered_in_error",
    "not_taken",
    "intended",
] as const;

export const MEDICATION_REQUEST_INTENT = [
    "proposal",
    "plan",
    "order",
    "original_order",
    "reflex_order",
    "filler_order",
    "instance_order",
] as const;

export const MEDICATION_REQUEST_STATUS = [
    "active",
    "on-hold",
    "ended",
    "stopped",
    "completed",
    "cancelled",
    "entered_in_error",
    "draft",
    "unknown",
] as const;

export const ENCOUNTER_PRIORITY = [
    "ASAP",
    "callback_results",
    "callback_for_scheduling",
    "elective",
    "emergency",
    "preop",
    "as_needed",
    "routine",
    "rush_reporting",
    "stat",
    "timing_critical",
    "use_as_directed",
    "urgent",
] as const;

export const DOSAGE_UNITS_CODES: { code: string, display: string, system: string }[] = [
    {
        code: "mg",
        display: "Milligram",
        system: "http://unitsofmeasure.org",
    },
    {
        code: "g",
        display: "Gram",
        system: "http://unitsofmeasure.org",
    },
    {
        code: "mL",
        display: "Milliliter",
        system: "http://unitsofmeasure.org",
    },
    {
        code: "[drp]",
        display: "Drop",
        system: "http://unitsofmeasure.org",
    },
    {
        code: "{tbl}",
        display: "Tablets",
        system: "http://unitsofmeasure.org",
    },
];

const ARBITRARY_INPUT_PROMPTS: ScribePromptMap = {
    default: {
        prompt: "A normal string value JSON encoded",
        example: "A value"
    },
    integer: {
        prompt: "An integer value JSON encoded",
        example: 42,
    },
    date: {
        prompt: `A date value JSON encoded. Current date : ${dayjs(new Date()).format("YYYY-MM-DD")}`,
        example: "2003-12-21",
    },
    boolean: {
        prompt: "A true or false value JSON encoded",
        example: true,
    },
    dateTime: {
        prompt: `A date time value in ISO format. Current timestamp is ${dayjs(new Date()).format("YYYY-MM-DDTHH:mm")}`,
        example: "2003-12-21T23:10",
    },
}

export const SCRIBE_REPEAT_PROMPT_MAP: ScribePromptMap = {
    default: {
        prompt: "An array of strings JSON encoded",
        example: ["A value"]
    },
    integer: {
        prompt: "An array of integers JSON encoded",
        example: [42],
    },
    date: {
        prompt: `An array of date values JSON encoded. Current date : ${dayjs(new Date()).format("YYYY-MM-DD")}`,
        example: ["2003-12-21"],
    },
    boolean: {
        prompt: "An array of true or false values JSON encoded",
        example: [true],
    },
}

const code = z.object({
    code: z.string(),
    display: z.string(),
    system: z.string()
})

const codeQuery = (type: ValueSetSystem, primary?: boolean) => z.object({
    code_search_query: z.string().describe("The query"),
    code_search_type: z.literal(type).describe("This field must not be changed"),
    ...(primary ? { primary: z.literal(true).describe("This field must always be true") } : {})
})

const codeStructure = (isRes: boolean | undefined, type: ValueSetSystem, primary?: boolean) => isRes ? z.union([code, codeQuery(type, primary)]) : codeQuery(type, primary)

const doseQuantity = z.object({
    value: z.number(),
    unit: z.object({
        code: z.enum(DOSAGE_UNITS_CODES.map(c => c.code) as [string]),
        display: z.enum(DOSAGE_UNITS_CODES.map(c => c.display) as [string]),
        system: z.literal("http://unitsofmeasure.org").describe("Do not change this value")
    })
})

const doseRange = z.object({
    low: doseQuantity,
    high: doseQuantity
})

const isoDateTime = z.string().regex(
    /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[\+\-]\d{2}:\d{2})?)?$/,
    "Invalid ISO date format"
);

const withFallback = <T>(schema: z.ZodType<T>, fallback: T) =>
    z.preprocess(
        (value) => {
            const parseResult = schema.safeParse(value);
            if (parseResult.success) return value;
            return fallback;
        },
        z.custom(() => true)
    );

export const STRUCTURED_INPUT_PROMPTS = {
    "encounter": {
        prompt: () => z.object({
            status: z.enum(["planned", "in_progress", "on_hold", "discharged", "completed", "cancelled", "discontinued", "entered_in_error", "unknown"]).describe("Status of the encounter"),
            encounter_class: z.enum(["imp", "amb", "obsenc", "emer", "vr", "hh"]).describe(`Class of the encounter : "imp" (Inpatient (IP)) | "amb" (Ambulatory (OP)) | "obsenc" (Observation Room) | "emer" (Emergency) | "vr" (Virtual) | "hh" (Home Health)`),
            priority: z.enum(ENCOUNTER_PRIORITY).describe("Priority of the encounter"),
            external_identifier: z.string().optional().describe("ip/op/obs/emr number"),
            hospitalization: z.object({
                re_admission: z.boolean().describe("Encounter is a readmission"),
                admit_source: z.enum(["hosp_trans"
                    , "emd"
                    , "outp"
                    , "born"
                    , "gp"
                    , "mp"
                    , "nursing"
                    , "psych"
                    , "rehab"
                    , "other"]).describe(`Admission source out of : "hosp_trans" (Hospital Transfer) | "emd" (Emergency Department) | "outp" (Outpatient Department) | "born" (Born) | "gp" (General Practitioner) | "mp" (Medical Practitioner) | "nursing" (Nursing Home) | "psych" (Psychiatric Hospital) | "rehab" (Rehabilitation Facility) | "other" (Other)`),
                diet_preference: z.enum(["vegetarian"
                    , "diary_free"
                    , "nut_free"
                    , "gluten_free"
                    , "vegan"
                    , "halal"
                    , "kosher"
                    , "none"]).optional().describe("Dietary preference of the patient"),
                discharge_disposition: z.enum(["home"
                    , "alt_home"
                    , "other_hcf"
                    , "hosp"
                    , "long"
                    , "aadvice"
                    , "exp"
                    , "psy"
                    , "rehab"
                    , "snf"
                    , "oth"]).optional().describe(`Only applicable if status is "completed". Choose from "home" (Home) | "alt_home" (Alternate Home) | "other_hcf" (Other Healthcare Facility) | "hosp" (Hospice) | "long" (Long Term Care) | "aadvice" (Left Against Advice) | "exp" (Expired) | "psy" (Psychiatric Hospital) | "rehab" (Rehabilitation) | "snf" (Skilled Nursing Facility) | "oth" (Other)`)
            }).optional().describe(`This will only be applicable if encounter_class is "imp", "absenc", or "emer"`)
        }),
        example: [{
            status: "in_progress",
            encounter_class: "imp",
            priority: "callback_for_scheduling",
            external_identifier: "1212",
            hospitalization: {
                re_admission: true,
                admit_source: "outp",
                discharge_disposition: "home",
                diet_preference: "nut_free"
            },
            "...other_data": "keep other data as is"
        }],
    },
    "medication_request": {
        prompt: (isRes?: boolean) => z.array(z.object({
            status: z.enum(MEDICATION_REQUEST_STATUS).describe("Status of the medication"),
            intent: z.enum(MEDICATION_REQUEST_INTENT).optional().describe("Intent of the medication request"),
            category: z.enum(["inpatient", "outpatient", "community", "discharge"]).describe("Category of the medication request"),
            priority: z.enum(["stat", "urgent", "asap", "routine"]).describe("Priority of the medication request"),
            do_not_perform: z.literal(false).describe("Do not update this value"),
            medication: codeStructure(isRes, "system-medication", true),
            authored_on: withFallback(isoDateTime.default(new Date().toISOString()).describe("When was this medication request authored? In ISO datetime"), new Date().toISOString()),
            dosage_instruction: z.array(z.object({
                sequence: z.number().optional(),
                text: z.string().optional(),
                additional_instruction: z.array(codeStructure(isRes, "system-additional-instruction")).optional(),
                patient_instruction: z.string().optional(),
                timing: z.object({
                    repeat: z.object({
                        frequency: z.number().optional(),
                        period: z.number().describe("number of units (ex. 12 days would mean 12 with unit 'd')"),
                        period_unit: z.enum(["s", "min", "h", "d", "wk", "mo", "a"]),
                        bounds_duration: z.object({
                            value: z.number(),
                            unit: z.enum(BOUNDS_DURATION_UNITS)
                        }).optional().describe(`
                            For medicine duration of
                                •	10 days -> the bounds_duration.value will be 10 and bounds_duration.unit will be “d”.
                                •	2 weeks -> the bounds_duration.value will be 2 and bounds_duration.unit will be “wk”.
                                •	3 months -> the bounds_duration.value will be 3 and bounds_duration.unit will be “mo”.
                                •	1 year -> the bounds_duration.value will be 1 and bounds_duration.unit will be “a”.
                                ... and so on.
                            `)

                    }).optional().describe(`
                        •	Two times a day means frequency is 2 and period is 1 and period_unit is “d”.
                        •	Three times a day means frequency is 3 and period is 1 and period_unit is “d”.
                        •	Four times a day means frequency is 4 and period is 1 and period_unit is “d”.
                        •	Every morning means frequency is 1 and period is 1 and period_unit is “d”.
                        •	Every afternoon means frequency is 1 and period is 1 and period_unit is “d”.
                        •	Every day means frequency is 1 and period is 1 and period_unit is “d”.
                        •	Every other day means frequency is 1 and period is 2 and period_unit is “d”.
                        •	Every hour means frequency is 24 and period is 1 and period_unit is “d”.
                        •	Every 2 hours means frequency is 12 and period is 1 and period_unit is “d”.
                        •	Every 3 hours means frequency is 8 and period is 1 and period_unit is “d”.
                        •	Every 4 hours means frequency is 6 and period is 1 and period_unit is “d”.
                        •	Every 6 hours means frequency is 4 and period is 1 and period_unit is “d”.
                        •	Every 8 hours means frequency is 3 and period is 1 and period_unit is “d”.
                        •	At bedtime means frequency is 1 and period is 1 and period_unit is “d”.
                        •	Weekly means frequency is 1 and period is 1 and period_unit is “wk”.
                        •	Monthly means frequency is 1 and period is 1 and period_unit is “mo”.
                        •	Immediately means frequency is 1 and period is 1 and period_unit is “s”.
                        `)
                }).optional(),
                as_needed_boolean: withFallback(z.boolean().describe("True if the prescription is PRN, else false. Do not ommit this.").default(false), false),
                as_needed_for: codeStructure(isRes, "system-as-needed-reason").optional().describe("If it is a PRN medication (as_needed_boolean is true), the indicator"),
                site: codeStructure(isRes, "system-body-site").optional().describe("The site the medication should be administered at"),
                route: codeStructure(isRes, "system-route").optional().describe("The route of the medicine"),
                method: codeStructure(isRes, "system-administration-method").optional().describe("The method in which the medicine should be administered"),
                dose_and_rate: z.object({
                    type: z.enum(["ordered", "calculated"]),
                    dosage_quantity: doseQuantity.optional(),
                    dose_range: doseRange.optional(),
                }).optional().describe(`
                One of \`dose_quantity\` or \`dose_range\` must be present.
                \`type\` is optional and defaults to \`ordered\`.
             
                - If \`type\` is \`ordered\`, \`dose_quantity\` must be present.
                - If \`type\` is \`calculated\`, \`dose_range\` must be present. This is used for titrated medications.
                `),
                max_dose_per_period: doseRange.optional()
            })),
            note: z.string().optional().describe("Additional Notes")
        })),
        example: [
            {
                status: "active",
                intent: "order",
                category: "inpatient",
                priority: "urgent",
                do_not_perform: false,
                medication: {
                    code_search_type: "system-medication",
                    code_search_query: "Senna 15 mg oral tablet",
                    primary: true
                },
                authored_on: new Date().toLocaleDateString(),
                dosage_instruction: [
                    {
                        dose_and_rate: {
                            type: "ordered",
                            dose_quantity: {
                                value: 1,
                                unit: {
                                    code: "mg",
                                    display: "Milligram",
                                    system: "http://unitsofmeasure.org"
                                }
                            }
                        },
                        route: {
                            code_search_type: "system-route",
                            code_search_query: "Sublabial route",
                        },
                        method: {
                            code_search_type: "system-administration-method",
                            code_search_query: "Dialysis System",
                        },
                        site: {
                            code_search_type: "system-body-site",
                            code_search_query: "Structure of left deltoid muscle",
                        },
                        timing: {
                            repeat: {
                                frequency: 1,
                                period: 1,
                                period_unit: "d",
                                bounds_duration: {
                                    value: 12,
                                    unit: "wk"
                                }
                            }
                        },
                        additional_instruction: [
                            {
                                code_search_type: "system-additional-instruction",
                                code_search_query: "Then Discontinue",
                            }
                        ]
                    },

                ]
            },
            {
                status: "active",
                intent: "order",
                category: "inpatient",
                priority: "urgent",
                do_not_perform: false,
                medication: {
                    code_search_type: "system-medication",
                    code_search_query: "Zinc 50 mg oral capsule",
                    primary: true
                },
                authored_on: new Date().toLocaleDateString(),
                dosage_instruction: [
                    {
                        dose_and_rate: {
                            type: "ordered",
                            dose_quantity: {
                                value: 21,
                                unit: {
                                    code: "mg",
                                    display: "Milligram",
                                    system: "http://unitsofmeasure.org"
                                }
                            }
                        },
                        as_needed_boolean: true,
                        as_needed_for: {
                            code_search_type: "system-as-needed-reason",
                            code_search_query: "Chronic nontraumatic intracranial subdural haematoma",
                        },
                        additional_instruction: [
                            {
                                code_search_type: "system-additional-instruction",
                                code_search_query: "Until symptoms improve",
                            }
                        ],
                        route: {
                            code_search_type: "system-route",
                            code_search_query: "Sublabial route",
                        },
                        method: {
                            code_search_type: "system-administration-method",
                            code_search_query: "Dialysis System",
                        },
                        site: {
                            code_search_type: "system-body-site",
                            code_search_query: "Structure of left deltoid muscle",
                        },
                    }
                ]
            }
        ]
    },
    "medication_statement": {
        prompt: (isRes?: boolean) => z.array(z.object({
            status: z.enum(MEDICATION_STATEMENT_STATUS).describe("Status of the medication"),
            dosage_text: z.string().optional().describe("Text to support the dosage"),
            information_source: z.string().optional().describe("The information source of the medication"),
            medication: codeStructure(isRes, "system-medication", true),
            note: z.string().optional().describe("Additional notes on the medication"),
            reason: z.string().optional().describe("Reason for medication"),
            effective_period: z.object({
                start: isoDateTime.describe("ISO date"),
                end: isoDateTime.describe("ISO date")
            }).optional().describe("Medication effective period")
        })),
        example: [
            {
                status: "completed",
                dosage_text: "10 ml",
                information_source: "patient",
                medication: {
                    code_search_type: "system-medication",
                    code_search_query: "Senna 15 mg oral tablet",
                    primary: true
                },
                note: "a note",
                reason: "patient was feeling dizzy",
                effective_period: {
                    start: "2024-12-12T18:30:00.000Z",
                    end: "2025-01-07T18:30:00.000Z",
                },
            },
        ]
    },
    "symptom": {
        prompt: (isRes?: boolean) => z.array(z.object({
            code: codeStructure(isRes, "system-condition-code", true),
            clinical_status: z.enum(["active", "recurrence", "relapse", "inactive", "remission", "resolved"]).describe("Clinical Status of the symptom"),
            verification_status: z.enum(["unconfirmed", "provisional", "differential", "confirmed", "refuted", "entered-in-error"]).describe("Verification status of the symptom"),
            severity: z.enum(["severe", "moderate", "mild"]).optional().describe("Severity of the symptom"),
            onset: withFallback(z.object({ onset_datetime: isoDateTime }).default({ onset_datetime: new Date().toISOString() }).describe("Onset date of the symptom in ISO format"), { onset_datetime: new Date().toISOString() }),
            recorded_date: isoDateTime.optional().describe("Date the symptom was recorded in ISO format"),
            note: z.string().optional().describe("Additional notes")
        })),
        example: [
            {
                code: {
                    code_search_type: "system-condition-code",
                    code_search_query: "Venous ulcer of toe of left foot",
                    primary: true
                },
                clinical_status: "recurrence",
                verification_status: "provisional",
                severity: "severe",
                onset: {
                    onset_datetime: "2024-12-03",
                },
                note: "Note here",
            },
        ]
    },
    "diagnosis": {
        prompt: (isRes?: boolean) => z.array(z.object({
            code: codeStructure(isRes, "system-condition-code", true),
            clinical_status: z.enum(["active", "recurrence", "relapse", "inactive", "remission", "resolved"]).describe("Clincal Status of the diagnosis"),
            verification_status: z.enum(["unconfirmed", "provisional", "differential", "confirmed", "refuted", "entered-in-error"]).describe("Verification Status of the diagnosis"),
            onset: withFallback(z.object({ onset_datetime: isoDateTime }).default({ onset_datetime: new Date().toISOString() }).describe("Onset date of the symptom in ISO format"), { onset_datetime: new Date().toISOString() }),
            recorded_date: isoDateTime.optional().describe("Date the diagnosis was recorded. In ISO format"),
            note: z.string().optional().describe("Additional notes")
        })),
        example: [
            {
                code: {
                    code_search_type: "system-condition-code",
                    code_search_query: "Venous ulcer of toe of left foot",
                    primary: true
                },
                clinical_status: "recurrence",
                verification_status: "provisional",
                onset: {
                    onset_datetime: "2024-12-03",
                },
                note: "Note here",
            },
        ]
    },
    "allergy_intolerance": {
        prompt: (isRes?: boolean) => z.array(z.object({
            code: codeStructure(isRes, "system-allergy-code", true),
            clinical_status: z.enum(["active", "inactive", "resolved"]).optional().describe("Clincal status of the allergy"),
            category: z.enum(["food", "medication", "environment", "biologic"]).optional().describe("Category of the allergy"),
            criticality: z.enum(["low", "high", "unable-to-assess"]).optional().describe("How critical is the allergy"),
            verification_status: z.enum(["unconfirmed", "presumed", "confirmed", "refuted", "entered-in-error"]).optional().describe("Verification Status of the allergy"),
            last_occurence: isoDateTime.optional().describe("The last occurance of the allergy In ISO format"),
            note: z.string().optional().describe("Additional Notes")
        })),
        example: [
            {
                code: {
                    code_search_type: "system-allergy-code",
                    code_search_query: "Anifrolumab",
                    primary: true
                },
                clinical_status: "inactive",
                category: "environment",
                criticality: "high",
                last_occurrence: "2024-12-11",
                note: "212",
            },
        ]
    },
    "follow_up_appointment": {
        prompt: () => z.object({
            reason_for_visit: z.string().describe("The reason for the appointment")
        }),
        example: {
            reason_for_visit: "No change in condition"
        }
    }
}


export const SCRIBE_PROMPT_MAP: ScribePromptMap = {
    ...ARBITRARY_INPUT_PROMPTS,
};