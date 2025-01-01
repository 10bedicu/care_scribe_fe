import { ScribePromptMap } from "@/types";
import dayjs from "dayjs";

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

const ARBITRARY_INPUT_PROMPTS: ScribePromptMap = {
    default: {
        prompt: "A normal string value",
        example: "A value",
    },
    number: {
        prompt: "An integer value",
        example: "42",
    },
    date: {
        prompt: "A date value",
        example: "2003-12-21",
    },
    checkbox: {
        prompt: "A true or false value",
        example: "true",
    },
    "datetime-local": {
        prompt: `A date time value in ISO format. Current timestamp is ${dayjs(new Date()).format("YYYY-MM-DDTHH:mm")}`,
        example: "2003-12-21T23:10",
    },
}

const CUI_INPUT_PROMPTS: ScribePromptMap = {
    "cui-date": {
        prompt: `A date time value in ISO format. Current timestamp is ${dayjs(new Date()).format("YYYY-MM-DDTHH:mm")}`,
        example: "2003-12-21T23:10",
    },
    "cui-datetime": {
        prompt: `A date in ISO format, minus 5 hour 30 minutes. Current time for your reference is ${new Date().toISOString()}`,
        example: new Date().toISOString(),
    },
    "cui-multi-select": {
        prompt: `An array of normal string values`,
        example: ["an", "example"],
    },
    "cui-checkbox": {
        prompt: "A true or false value",
        example: "true",
    },
}

export const STRUCTURED_INPUT_PROMPTS = {
    "qn-medication-request": {
        name: "Medication Request",
        prompt: `An array of objects of the following type: {
          status?: "active" | "on-hold" | "ended" | "stopped" | "completed" | "cancelled" | "entered-in-error" | "draft" | "unknown",
          intent?: "proposal" | "plan" | "order" | "original_order" | "reflex_order" | "filler_order" | "instance_order",
          category?:  "inpatient" | "outpatient" | "community" | "discharge",
          priority?: "stat" | "urgent" | "asap" | "routine"
          do_not_perform?: boolean;
          medication? : CodeType;
          authored_on?: ISO time string,
          dosage_instruction: {
            sequence?: number;
            text?: string;
            additional_instruction?: {
              system: string;
              code: string;
              display?: string;
            }[];
            patient_instruction?: string;
            timing?: {
              repeat?: {
                frequency?: number;
                period: number; // number of units (ex. 12 days would mean 12 with unit "d")
                period_unit: "s" | "min" | "h" | "d" | "wk" | "mo" | "a";
              };
            };
            /**
             * True if it is a PRN medication
             */
            as_needed_boolean?: boolean;
            /**
             * If it is a PRN medication (as_needed_boolean is true), the indicator.
             */
            as_needed_for?: CodeType;
            site?: CodeType;
            route?: CodeType;
            method?: CodeType;
            /**
             * One of \`dose_quantity\` or \`dose_range\` must be present.
             * \`type\` is optional and defaults to \`ordered\`.
             *
             * - If \`type\` is \`ordered\`, \`dose_quantity\` must be present.
             * - If \`type\` is \`calculated\`, \`dose_range\` must be present. This is used for titrated medications.
             */
            dose_and_rate?: (
              | {
                  type?: "ordered";
                  dose_quantity?: DosageQuantity;
                  dose_range?: undefined;
                }
              | {
                  type: "calculated";
                  dose_range?: {
                    low: DosageQuantity;
                    high: DosageQuantity;
                  };
                  dose_quantity?: undefined;
                }
            )[];
            max_dose_per_period?: {
              low: DosageQuantity;
              high: DosageQuantity;
            };
          }[];
          note?: string
        }. 
        
        DosageQuantity {
          value?: number;
          unit?: "mg" | "g" | "ml" | "drop(s)" | "ampule(s)" | "tsp" | "mcg" | "unit(s)"
        }

        CodeType {
          code: string,
          display: string,
          system: "http://snomed.info/sct"
        }
        
        Update existing data, delete existing data or append to the existing list as per the will of the user. Current date is ${new Date().toLocaleDateString()}`,
        example: [
            {
                status: "active",
                intent: "original_order",
                category: "inpatient",
                priority: "urgent",
                do_not_perform: false,
                medication: {
                    code: "1214771000202109",
                    display:
                        "Ciprofloxacin and fluocinolone only product in otic dose form",
                    system: "http://snomed.info/sct",
                },
                authored_on: "2024-12-29T22:16:45.404Z",
                dosage_instruction: [
                    {
                        dose_and_rate: [
                            {
                                type: "ordered",
                                dose_quantity: {
                                    unit: "g",
                                    value: 11,
                                },
                            },
                        ],
                        route: {
                            code: "58831000052108",
                            display: "Subretinal route",
                            system: "http://snomed.info/sct",
                        },
                        method: {
                            code: "1231460007",
                            display: "Dialysis system",
                            system: "http://snomed.info/sct",
                        },
                        site: {
                            code: "16217661000119109",
                            display: "Structure of right deltoid muscle",
                            system: "http://snomed.info/sct",
                        },
                        as_needed_boolean: true,
                        timing: {
                            repeat: {
                                frequency: 1,
                                period: 1,
                                period_unit: "d",
                            },
                        },
                        additional_instruction: [
                            {
                                code: "421984009",
                                display: "Until finished",
                                system: "http://snomed.info/sct",
                            },
                        ],
                        as_needed_for: {
                            code: "972604701000119104",
                            display:
                                "Acquired arteriovenous malformation of vascular structure of gastrointestinal tract",
                            system: "http://snomed.info/sct",
                        },
                    },
                ],
            },
        ]
    },
    "qn-medication-statement": {
        name: "Medication Statement",
        prompt: `An array of objects of the following type: {
          status?: ${MEDICATION_STATEMENT_STATUS.join(" | ")},
          dosage_text?: string,
          information_source?: "patient" | "user" | "related_person"
          medication?: {
            code: string,
            display: string,
            system: "http://snomed.info/sct"
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
                    code: "1213681000202103",
                    display: "Cabotegravir only product in oral dose form",
                    system: "http://snomed.info/sct",
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
    "qn-symptoms": {
        name: "Symptoms",
        prompt: `An array of objects of the following type: {
          code?: {"code" : string, "display" : string, "system" : "http://snomed.info/sct"},
          clinical_status?: "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved",
          verification_status?: "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted" | "entered-in-error",
          severity?: "severe" | "moderate" | "mild",
          onset?: {
            onset_datetime: YYYY-MM-DD string
          },
          note?: string
        }. Update existing data, delete existing data or append to the existing list as per the will of the user. Current date is ${new Date().toLocaleDateString()}`,
        example: [
            {
                code: {
                    code: "972900701000119109",
                    display: "Venous ulcer of toe of left foot",
                    system: "http://snomed.info/sct",
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
    "qn-diagnoses": {
        name: "Diagnoses",
        prompt: `An array of objects of the following type: {
          code?: {"code" : string, "display" : string, "system" : "http://snomed.info/sct"},
          clinical_status?: "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved",
          verification_status?: "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted" | "entered-in-error",
          onset?: {
            onset_datetime: YYYY-MM-DD string
          },
          note?: string
        }. Update existing data, delete existing data or append to the existing list as per the will of the user. Current date is ${new Date().toLocaleDateString()}`,
        example: [
            {
                code: {
                    code: "972900701000119109",
                    display: "Venous ulcer of toe of left foot",
                    system: "http://snomed.info/sct",
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
    "qn-allergies": {
        name: "Allergies",
        prompt: `An array of objects of the following type: {
          code: {
            code: string,
            display: string,
            system: "http://snomed.info/sct"
          },
          clinical_status?: "active" | "inactive" | "resolved",
          category?: "food" | "medication" | "environment" | "biologic",
          criticality?: "low" | "high" | "unable-to-assess",
          verification?: "unconfirmed" | "presumed" | "confirmed" | "refuted" | "entered-in-error"
          last_occurrence?: YYYY-MM-DD string,
          note?: string
        }. Update existing data, delete existing data or append to the existing list as per the will of the user. Current date is ${new Date().toLocaleDateString()}`,
        example: [
            {
                code: {
                    code: "842825221000119100",
                    display: "Anifrolumab",
                    system: "http://snomed.info/sct",
                },
                clinical_status: "inactive",
                category: "environment",
                criticality: "high",
                last_occurrence: "2024-12-11",
                note: "212",
            },
        ]
    }
}


export const SCRIBE_PROMPT_MAP: ScribePromptMap = {
    ...ARBITRARY_INPUT_PROMPTS,
    ...CUI_INPUT_PROMPTS,
};