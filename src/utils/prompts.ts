import { ScribePromptMap, ValueSetSystem } from "@/types";
import dayjs from "dayjs";
import z from "zod"
import { BOUNDS_DURATION_UNITS, DOSAGE_UNITS_CODES, ENCOUNTER_PRIORITY, MEDICATION_REQUEST_INTENT, MEDICATION_REQUEST_STATUS, MEDICATION_REQUEST_TIMING_OPTIONS, MEDICATION_STATEMENT_STATUS } from "./constants";

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
            status: z.enum(["planned", "in_progress", "on_hold", "discharged", "completed", "cancelled", "discontinued", "entered_in_error", "unknown"]),
            encounter_class: z.enum(["imp", "amb", "obsenc", "emer", "vr", "hh"]).describe(`Class of the encounter : "imp" (Inpatient (IP)) | "amb" (Ambulatory (OP)) | "obsenc" (Observation Room) | "emer" (Emergency) | "vr" (Virtual) | "hh" (Home Health)`),
            priority: z.enum(ENCOUNTER_PRIORITY),
            external_identifier: z.string().optional().describe("ip/op/obs/emr number"),
            hospitalization: z.object({
                re_admission: z.boolean(),
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
                    , "none"]).optional(),
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
            status: z.enum(MEDICATION_REQUEST_STATUS),
            intent: z.enum(MEDICATION_REQUEST_INTENT).optional(),
            category: z.enum(["inpatient", "outpatient", "community", "discharge"]),
            priority: z.enum(["stat", "urgent", "asap", "routine"]),
            do_not_perform: z.literal(false).describe("Do not update this value"),
            medication: codeStructure(isRes, "system-medication", true),
            authored_on: withFallback(isoDateTime.default(new Date().toISOString()).describe("In ISO datetime"), new Date().toISOString()),
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
                        ${Object.entries(MEDICATION_REQUEST_TIMING_OPTIONS).map(([, timing]) => `•	${timing.timing.code.display} (${timing.display}) means frequency is ${timing.timing.repeat.frequency}, period is ${timing.timing.repeat.period}, period_unit is ${timing.timing.repeat.period_unit} and code is ${timing.timing.code.code}`)}
                    `),
                    code: z.object({
                        code: z.enum(Object.values(MEDICATION_REQUEST_TIMING_OPTIONS).map(timing => timing.timing.code.code) as [string]),
                        display: z.enum(Object.values(MEDICATION_REQUEST_TIMING_OPTIONS).map(timing => timing.timing.code.display) as [string]),
                        system: z.literal("http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation")
                    }),
                }).optional(),

                as_needed_boolean: withFallback(z.boolean().describe("True if the prescription is PRN, else false. Do not ommit this.").default(false), false),
                as_needed_for: codeStructure(isRes, "system-as-needed-reason").optional().describe("If it is a PRN medication (as_needed_boolean is true), the indicator"),
                site: codeStructure(isRes, "system-body-site").optional().describe("The site the medication should be administered at"),
                route: codeStructure(isRes, "system-route").optional(),
                method: codeStructure(isRes, "system-administration-method").optional(),
                dose_and_rate: z.union([z.object({
                    type: z.literal("ordered"),
                    dose_quantity: doseQuantity,
                }), z.object({
                    type: z.literal("calculated"),
                    dose_range: doseRange,
                })]).optional().describe(`
                One of \`dose_quantity\` or \`dose_range\` must be present.
                \`type\` is optional and defaults to \`ordered\`.
             
                - If \`type\` is \`ordered\`, \`dose_quantity\` must be present.
                - If \`type\` is \`calculated\`, \`dose_range\` must be present. This is used for titrated medications.
                `),
                max_dose_per_period: doseRange.optional()
            })),
            note: z.string().optional()
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
                                period_unit: "h",
                                bounds_duration: {
                                    value: 12,
                                    unit: "wk"
                                },
                            },
                            code: {
                                code: "Q1H",
                                display: "Every 1 hour",
                                system: "http://terminology.hl7.org/CodeSystem/v3-GTSAbbreviation"
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
            status: z.enum(MEDICATION_STATEMENT_STATUS),
            dosage_text: z.string().optional(),
            information_source: z.string().optional(),
            medication: codeStructure(isRes, "system-medication", true),
            note: z.string().optional(),
            reason: z.string().optional(),
            effective_period: z.object({
                start: isoDateTime.describe("ISO date"),
                end: isoDateTime.describe("ISO date")
            }).optional()
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
            clinical_status: z.enum(["active", "recurrence", "relapse", "inactive", "remission", "resolved"]),
            verification_status: z.enum(["unconfirmed", "provisional", "differential", "confirmed", "refuted", "entered-in-error"]),
            severity: z.enum(["severe", "moderate", "mild"]),
            onset: withFallback(z.object({ onset_datetime: isoDateTime }).default({ onset_datetime: new Date().toISOString() }).describe("ISO format"), { onset_datetime: new Date().toISOString() }),
            recorded_date: isoDateTime.optional().describe("ISO format"),
            note: z.string().optional()
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
            clinical_status: z.enum(["active", "recurrence", "relapse", "inactive", "remission", "resolved"]),
            verification_status: z.enum(["unconfirmed", "provisional", "differential", "confirmed", "refuted", "entered-in-error"]),
            onset: withFallback(z.object({ onset_datetime: isoDateTime }).default({ onset_datetime: new Date().toISOString() }).describe("ISO format"), { onset_datetime: new Date().toISOString() }),
            recorded_date: withFallback(isoDateTime.describe("In ISO format").default(new Date().toISOString()), new Date().toISOString()),
            note: z.string().optional()
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
            clinical_status: z.enum(["active", "inactive", "resolved"]).optional(),
            category: z.enum(["food", "medication", "environment", "biologic"]).optional(),
            criticality: z.enum(["low", "high", "unable-to-assess"]).optional(),
            verification_status: z.enum(["unconfirmed", "presumed", "confirmed", "refuted", "entered-in-error"]).optional(),
            last_occurence: isoDateTime.optional().describe("ISO format"),
            note: z.string().optional()
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
            reason_for_visit: z.string()
        }),
        example: {
            reason_for_visit: "No change in condition"
        }
    }
}


export const SCRIBE_PROMPT_MAP: ScribePromptMap = {
    ...ARBITRARY_INPUT_PROMPTS,
};