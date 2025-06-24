import { Structure } from ".";
import { z } from "zod";
import { Code } from "@/types";
import { getCodeFromQuery, isoDateTime } from "../utils";
import dedent from "dedent-js";

const CLINICAL_STATUS = ["active", "inactive", "resolved"] as const;

const CATEGORY = ["food", "medication", "environment", "biologic"] as const;

const CRITICALITY = ["low", "high", "unable-to-assess"] as const;

const VERIFICATION_STATUS = [
  "unconfirmed",
  "presumed",
  "confirmed",
  "refuted",
  "entered-in-error",
] as const;

interface AllergyIntolerance {
  code: Code;
  clinical_status: (typeof CLINICAL_STATUS)[number];
  category: (typeof CATEGORY)[number];
  criticality: (typeof CRITICALITY)[number];
  verification_status: (typeof VERIFICATION_STATUS)[number];
  last_occurrence?: string;
  note?: string;
}

const toolStructure = z.array(
  z.object({
    allergy: z.string(),
    clinical_status: z.enum(CLINICAL_STATUS),
    category: z.enum(CATEGORY).optional(),
    criticality: z.enum(CRITICALITY).optional(),
    verification_status: z.enum(VERIFICATION_STATUS).optional(),
    last_occurrence: isoDateTime.optional().describe("ISO format"),
    note: z.string().optional(),
  }),
);

export const allergyIntoleranceStructure: Structure<
  AllergyIntolerance[],
  typeof toolStructure
> = {
  name: "AllergyIntolerance",
  description: "Structure for allergy intolerance",
  toolStructure,
  deserialize: async (data, currentData) => {
    const errors: string[] = [];
    const d = data.map(async (allergyIntolerance) => {
      const code = await getCodeFromQuery(
        allergyIntolerance.allergy,
        "system-allergy-code",
      );
      if (!code) {
        errors.push(
          `Copilot could not find an allergy that matches with ${allergyIntolerance.allergy}. Please enter manually.`,
        );
        return undefined;
      }
      const allergyIntoleranceData: AllergyIntolerance = {
        code,
        clinical_status: allergyIntolerance.clinical_status,
        category: allergyIntolerance.category || "medication",
        criticality: allergyIntolerance.criticality || "low",
        verification_status:
          allergyIntolerance.verification_status || "confirmed",
        last_occurrence: allergyIntolerance.last_occurrence,
        note: allergyIntolerance.note,
      };
      return allergyIntoleranceData;
    });
    const allergies = (await Promise.all(d)).filter(
      (s) => !!s,
    ) as AllergyIntolerance[];
    // remove any duplicates
    const currentCodes = new Set(currentData?.map((s) => s.code.code));
    const merged = [
      ...(currentData || []),
      ...allergies.filter((s) => !currentCodes.has(s.code.code)),
    ];
    return {
      data: merged,
      errors,
    };
  },
  toPrompt: (data) => {
    return data
      .map(
        (allergyIntolerance, i) =>
          dedent`
        ### Allergy Intolerance ${i + 1}: 
        - Name: ${allergyIntolerance.code.display}
        - Clinical Status: ${allergyIntolerance.clinical_status}, 
        - Category: ${allergyIntolerance.category},
        - Criticality: ${allergyIntolerance.criticality},
        - Verification Status: ${allergyIntolerance.verification_status},
        - Last Occurrence: ${allergyIntolerance.last_occurrence || "N/A"},
        ${allergyIntolerance.note ? `- Note: ${allergyIntolerance.note}` : ""}
        `,
      )
      .join("\n");
  },
};
