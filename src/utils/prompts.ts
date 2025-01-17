import { ScribePromptMap } from "@/types";
import dayjs from "dayjs";

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

export const STRUCTURED_INPUT_PROMPTS = {
    "encounter": {
        prompt: `An array of only one object of the following schema. Everything in brackets is for your information and is not part of the schema. : {
            status: "planned" | "in_progress" | "on_hold" | "discharged" | "completed" | "cancelled" | "discontinued" | "entered_in_error" | "unknown",
            encounter_class : "imp" (Inpatient (IP)) | "amb" (Ambulatory (OP)) | "obsenc" (Observation Room) | "emer" (Emergency) | "vr" (Virtual) | "hh" (Home Health),'
            priority: "ASAP" | "callback_results" | "callback_for_scheduling" | "elective" | "emergency" | "preop" | "as_needed" | "routine" | "rush_reporting" | "stat" | "timing_critical" | "use_as_directed" | "urgent";
            external_identifier (ip/op/obs/emr number)?: string;
            
            (This will only be applicable if encounter_class is "imp", "absenc", or "emer")
            hospitalization?: {
                re_admission: boolean;
                admit_source: "hosp_trans" (Hospital Transfer) | "emd" (Emergency Department) | "outp" (Outpatient Department) | "born" (Born) | "gp" (General Practitioner) | "mp" (Medical Practitioner) | "nursing" (Nursing Home) | "psych" (Psychiatric Hospital) | "rehab" (Rehabilitation Facility) | "other" (Other);
                diet_preference?: "vegetarian" (Vegetarian) | "diary_free" (Dairy Free) | "nut_free" (Nut Free) | "gluten_free" (Gluten Free) | "vegan" (Vegan) | "halal" (Halal) | "kosher" (Kosher) | "none" (None);
                
                (only applicable if status is "completed")
                discharge_disposition?: "home" (Home) | "alt_home" (Alternate Home) | "other_hcf" (Other Healthcare Facility) | "hosp" (Hospice) | "long" (Long Term Care) | "aadvice" (Left Against Advice) | "exp" (Expired) | "psy" (Psychiatric Hospital) | "rehab" (Rehabilitation) | "snf" (Skilled Nursing Facility) | "oth" (Other);
            };
            
            ...other data that is READ ONLY
        }. Make sure to only update the existing data of the user and not remove or update any data that was not explicitly told to be updated. Return ONLY the original data with requested updates.`,
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
        prompt: `An array of objects of the following type: {
          status: ${MEDICATION_REQUEST_STATUS.join(" | ")},
          intent?: ${MEDICATION_REQUEST_INTENT.join(" | ")},
          category: "inpatient" | "outpatient" | "community" | "discharge",
          priority: "stat" | "urgent" | "asap" | "routine",
          do_not_perform: false;
          medication? : {
            code_search_query: string,
            code_search_type: "system-medication",
            primary: true
          };
          authored_on?: ${new Date().toISOString()},
          dosage_instruction: [{
            sequence?: number;
            text?: string;
            additional_instruction?:[{
                code_search_query: string,
                code_search_type: "system-additional-instruction",
            }];
            patient_instruction?: string;
            
            timing?: {
              repeat?: {
                (
                 		•	Two times a day means frequency is 2 and period is 1 day and period_unit is “d”.
                        •	Three times a day means frequency is 3 and period is 1 day and period_unit is “d”.
                        •	Four times a day means frequency is 4 and period is 1 day and period_unit is “d”.
                        •	Every morning means frequency is 1 and period is 1 day and period_unit is “d”.
                        •	Every afternoon means frequency is 1 and period is 1 day and period_unit is “d”.
                        •	Every day means frequency is 1 and period is 1 day and period_unit is “d”.
                        •	Every other day means frequency is 1 and period is 2 days and period_unit is “d”.
                        •	Every hour means frequency is 24 and period is 1 day and period_unit is “d”.
                        •	Every 2 hours means frequency is 12 and period is 1 day and period_unit is “d”.
                        •	Every 3 hours means frequency is 8 and period is 1 day and period_unit is “d”.
                        •	Every 4 hours means frequency is 6 and period is 1 day and period_unit is “d”.
                        •	Every 6 hours means frequency is 4 and period is 1 day and period_unit is “d”.
                        •	Every 8 hours means frequency is 3 and period is 1 day and period_unit is “d”.
                        •	At bedtime means frequency is 1 and period is 1 day and period_unit is “d”.
                        •	Weekly means frequency is 1 and period is 1 week and period_unit is “wk”.
                        •	Monthly means frequency is 1 and period is 1 month and period_unit is “mo”.
                        •	Immediately means frequency is 1 and period is 1 second and period_unit is “s”.
                )
                frequency?: number;
                period: number; // number of units (ex. 12 days would mean 12 with unit "d");
                period_unit: "s" | "min" | "h" | "d" | "wk" | "mo" | "a";
                bounds_duration?: {
                (
                    For medicine duration of
                    •	10 days -> the bounds_duration.value will be 10 and bounds_duration.unit will be “d”.
                    •	2 weeks -> the bounds_duration.value will be 2 and bounds_duration.unit will be “wk”.
                    •	3 months -> the bounds_duration.value will be 3 and bounds_duration.unit will be “mo”.
                    •	1 year -> the bounds_duration.value will be 1 and bounds_duration.unit will be “a”.
                    ... and so on.
                )
                    value: number;
                    unit: ${BOUNDS_DURATION_UNITS.join(" | ")};
                };
              };
            };
            /**
             * True if it is a PRN medication
             */
            as_needed_boolean: boolean;
            /**
             * If it is a PRN medication (as_needed_boolean is true), the indicator.
             */
            as_needed_for?: {
                code_search_query: string,
                code_search_type: "system-as-needed-reason",
            };
            site?: {
                code_search_query: string,
                code_search_type: "system-body-site",
            };
            route?: {
                code_search_query: string,
                code_search_type: "system-route",
            };
            method?: {
                code_search_query: string,
                code_search_type: "system-administration-method",
            };
            /**
             * One of \`dose_quantity\` or \`dose_range\` must be present.
             * \`type\` is optional and defaults to \`ordered\`.
             *
             * - If \`type\` is \`ordered\`, \`dose_quantity\` must be present.
             * - If \`type\` is \`calculated\`, \`dose_range\` must be present. This is used for titrated medications.
             */
            dose_and_rate?: {
                type: "ordered" | "calculated";
                dose_range?: {
                    low: DosageQuantity;
                    high: DosageQuantity;
                };
                dose_range?: DoseRange;
            };
            max_dose_per_period?: {
              low: DosageQuantity;
              high: DosageQuantity;
            };
          }];
          note?: string
        }
        
        DosageQuantity {
          value?: number;
          unit?: "mg" | "g" | "ml" | "drop(s)" | "ampule(s)" | "tsp" | "mcg" | "unit(s)"
        }
        
        Update existing data, delete existing data or append to the existing list as per the will of the user. NOTE: Make sure not to discard existing data until explicitly said so. Current date is ${new Date().toLocaleDateString()}`,
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
                                unit: "mg"
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
                                unit: "mg"
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
        prompt: `An array of objects of the following type {
          status: ${MEDICATION_STATEMENT_STATUS.join(" | ")},
          dosage_text?: string,
          information_source?: "patient" | "user" | "related_person"
          medication?: {
            code_search_type: "system-medication",
            code_search_query: string,
            primary: true
          },
          note?: string,
          reason?: string,
          effective_period?: {
            start: ISO date string,
            end: ISO date string
          }
        }. Update existing data, delete existing data or append to the existing list as per the will of the user. Current date is ${new Date().toLocaleDateString()}`,
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
        prompt: `An array of objects of the following type {
          code: {
                code_search_type: "system-condition-code",
                code_search_query: string,
                primary: true
            },
          clinical_status: "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved",
          verification_status: "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted" | "entered-in-error",
          severity?: "severe" | "moderate" | "mild",
          onset?: {
            onset_datetime: YYYY-MM-DD string
          },
          recorded_date?: datestring;
          note?: string
        }. Update existing data, delete existing data or append to the existing list as per the will of the user. Current date is ${new Date().toLocaleDateString()} Default onset_datetime to today unless otherwise specified`,
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
        prompt: `An array of objects of the following type: {
          code: {
                code_search_type: "system-condition-code",
                code_search_query: string,
                primary: true
            },
          clinical_status: "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved",
          verification_status: "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted" | "entered-in-error",
          onset?: {
            onset_datetime: YYYY-MM-DD string
          },
          recorded_date?: datestring;
          note?: string
        }. Update existing data, delete existing data or append to the existing list as per the will of the user. Current date is ${new Date().toLocaleDateString()} Default onset_datetime to today unless otherwise specified`,
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
        prompt: `An array of objects of the following type: {
          code: {
            code_search_type: "system-allergy-code",
            code_search_query:  string,
            primary: true
            },
          clinical_status?: "active" | "inactive" | "resolved",
          category?: "food" | "medication" | "environment" | "biologic",
          criticality?: "low" | "high" | "unable-to-assess",
          verification_status?: "unconfirmed" | "presumed" | "confirmed" | "refuted" | "entered-in-error"
          last_occurrence?: YYYY-MM-DD string,
          note?: string
        }. Update existing data, delete existing data or append to the existing list as per the will of the user. Current date is ${new Date().toLocaleDateString()}`,
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
        prompt: `An object of the following type : {
            reason_for_visit: string
        }. Update the existing data on the will of the user.`,
        example: {
            reason_for_visit: "No change in condition"
        }
    }
}


export const SCRIBE_PROMPT_MAP: ScribePromptMap = {
    ...ARBITRARY_INPUT_PROMPTS,
};