import { ENCOUNTER_PRIORITY } from "../constants";
import { Structure } from ".";
import { z } from "zod";

const ENCOUNTER_STATUS = [
  "planned",
  "in_progress",
  "on_hold",
  "discharged",
  "completed",
  "cancelled",
  "discontinued",
  "entered_in_error",
  "unknown",
] as const;

const ENCOUNTER_CLASS = [
  "imp", // Inpatient (IP)
  "amb", // Ambulatory (OP)
  "obsenc", // Observation Room
  "emer", // Emergency
  "vr", // Virtual
  "hh", // Home Health
] as const;

const ADMIT_SOURCE = [
  "hosp_trans",
  "emd",
  "outp",
  "born",
  "gp",
  "mp",
  "nursing",
  "psych",
  "rehab",
  "other",
] as const;

const DEIT_PREFERENCE = [
  "vegetarian",
  "diary_free",
  "nut_free",
  "gluten_free",
  "vegan",
  "halal",
  "kosher",
  "none",
] as const;

const DISCHARGE_DISPOSITION = [
  "home",
  "alt_home",
  "other_hcf",
  "hosp",
  "long",
  "aadvice",
  "exp",
  "psy",
  "rehab",
  "snf",
  "oth",
] as const;

type Encounter = {
  status: (typeof ENCOUNTER_STATUS)[number];
  encounter_class: (typeof ENCOUNTER_CLASS)[number];
  priority: (typeof ENCOUNTER_PRIORITY)[number];
  external_identifier?: string;
  hospitalization?: {
    re_admission: boolean;
    admit_source: (typeof ADMIT_SOURCE)[number];
    diet_preference?: (typeof DEIT_PREFERENCE)[number];
    discharge_disposition?: (typeof DISCHARGE_DISPOSITION)[number];
  };
};

const toolStructure = z.object({
  encounter_status: z.enum(ENCOUNTER_STATUS),
  encounter_class: z
    .enum(ENCOUNTER_CLASS)
    .describe(
      `Class of the encounter : "imp" (Inpatient (IP)) | "amb" (Ambulatory (OP)) | "obsenc" (Observation Room) | "emer" (Emergency) | "vr" (Virtual) | "hh" (Home Health)`,
    ),
  encounter_priority: z.enum(ENCOUNTER_PRIORITY),
  external_identifier: z.string().optional().describe("ip/op/obs/emr number"),
  readmission: z
    .boolean()
    .describe(
      `This will only be applicable if encounter_class is "imp", "absenc", or "emer"`,
    ),
  admit_source: z
    .enum(ADMIT_SOURCE)
    .describe(
      `Admission source out of : "hosp_trans" (Hospital Transfer) | "emd" (Emergency Department) | "outp" (Outpatient Department) | "born" (Born) | "gp" (General Practitioner) | "mp" (Medical Practitioner) | "nursing" (Nursing Home) | "psych" (Psychiatric Hospital) | "rehab" (Rehabilitation Facility) | "other" (Other). This will only be applicable if encounter_class is "imp", "absenc", or "emer"`,
    ),
  diet_preference: z
    .enum(DEIT_PREFERENCE)
    .optional()
    .describe(
      `This will only be applicable if encounter_class is "imp", "absenc", or "emer"`,
    ),
  discharge_disposition: z
    .enum(DISCHARGE_DISPOSITION)
    .optional()
    .describe(
      `Only applicable if status is "completed" and if encounter_class is "imp", "absenc", or "emer". Choose from "home" (Home) | "alt_home" (Alternate Home) | "other_hcf" (Other Healthcare Facility) | "hosp" (Hospice) | "long" (Long Term Care) | "aadvice" (Left Against Advice) | "exp" (Expired) | "psy" (Psychiatric Hospital) | "rehab" (Rehabilitation) | "snf" (Skilled Nursing Facility) | "oth" (Other)`,
    ),
});

export const encounterStructure: Structure<Encounter, typeof toolStructure> = {
  name: "Encounter",
  description: "Structure for an encounter",
  toolStructure,
  deserialize: async (data) => {
    return {
      data: {
        status: data.encounter_status,
        encounter_class: data.encounter_class,
        priority: data.encounter_priority,
        external_identifier: data.external_identifier,
        hospitalization: ["imp", "absenc", "emer"].includes(
          data.encounter_class,
        )
          ? {
              re_admission: data.readmission,
              admit_source: data.admit_source,
              diet_preference: data.diet_preference,
              discharge_disposition: data.discharge_disposition,
            }
          : undefined,
      },
    };
  },
  toPrompt: (data) => {
    return `
    Encounter Status: ${data.status}
    Encounter Class: ${data.encounter_class}
    Encounter Priority: ${data.priority}
    External Identifier: ${data.external_identifier || ""}
    ${
      ["imp", "absenc", "emer"].includes(data.encounter_class) &&
      data.hospitalization
        ? `      
        Hospitalization Details:
        Re-admission: ${data.hospitalization.re_admission ? "Yes" : "No"}
        Admit Source: ${data.hospitalization.admit_source}
        Diet Preference: ${data.hospitalization.diet_preference || ""}
        Discharge Disposition: ${data.hospitalization.discharge_disposition || ""}`
        : ""
    }
    `;
  },
};
