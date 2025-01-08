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

export const STRUCTURED_INPUT_PROMPTS = {
    "encounter": {
        prompt: `An array of only one object of the following schema. Everything in brackets is for your information and is not part of the schema. : {
            status?: "planned" | "in_progress" | "on_hold" | "discharged" | "completed" | "cancelled" | "discontinued" | "entered_in_error" | "unknown",
            encounter_class? : "imp" (Inpatient (IP)) | "amb" (Ambulatory (OP)) | "obsenc" (Observation Room) | "emer" (Emergency) | "vr" (Virtual) | "hh" (Home Health),'
            priority?: "ASAP" | "callback_results" | "callback_for_scheduling" | "elective" | "emergency" | "preop" | "as_needed" | "routine" | "rush_reporting" | "stat" | "timing_critical" | "use_as_directed" | "urgent";
            external_identifier (ip/op/obs/emr number)?: string;
            
            (This will only be applicable if encounter_class is "imp", "absenc", or "emer")
            hospitalization?: {
                re_admission?: boolean;
                admit_source?: "hosp_trans" (Hospital Transfer) | "emd" (Emergency Department) | "outp" (Outpatient Department) | "born" (Born) | "gp" (General Practitioner) | "mp" (Medical Practitioner) | "nursing" (Nursing Home) | "psych" (Psychiatric Hospital) | "rehab" (Rehabilitation Facility) | "other" (Other);
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
        prompt: `An array of objects of the following type based on the SNOMED CT Code for the applicable diagnoses: {
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
    "medication_statement": {
        prompt: `An array of objects of the following type, based on the SNOMED CT Code for the applicable diagnoses {
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
    "symptom": {
        prompt: `An array of objects of the following type, based on the SNOMED CT Code for the applicable symptoms: {
          code: {"code" : string, "display" : string, "system" : "http://snomed.info/sct"},
          clinical_status: "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved",
          verification_status: "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted" | "entered-in-error",
          severity?: "severe" | "moderate" | "mild",
          onset?: {
            onset_datetime: YYYY-MM-DD string
          },
          note?: string
        }. Update existing data, delete existing data or append to the existing list as per the will of the user. Current date is ${new Date().toLocaleDateString()} Default onset_datetime to today unless otherwise specified`,
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
    "diagnosis": {
        prompt: `An array of objects of the following type, based on the SNOMED CT Code for the applicable diagnoses: {
          code: {"code" : string, "display" : string, "system" : "http://snomed.info/sct"},
          clinical_status: "active" | "recurrence" | "relapse" | "inactive" | "remission" | "resolved",
          verification_status: "unconfirmed" | "provisional" | "differential" | "confirmed" | "refuted" | "entered-in-error",
          onset: {
            onset_datetime: YYYY-MM-DD string
          },
          note?: string
        }. Update existing data, delete existing data or append to the existing list as per the will of the user. Current date is ${new Date().toLocaleDateString()} Default onset_datetime to today unless otherwise specified`,
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
    "allergy_intolerance": {
        prompt: `An array of objects of the following type based on the SNOMED CT Code for the applicable diagnoses: {
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