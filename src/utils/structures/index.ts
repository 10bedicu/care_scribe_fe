import { z, ZodTypeAny } from "zod";
import { encounterStructure } from "./encounter";
import { ValueSetSystem } from "@/types";
import { symptomsStructure } from "./symptoms";
import { medicationRequestStructure } from "./medicationRequest";
import { medicationStatementStructure } from "./medicationStatement";
import { diagnosisStructure } from "./diagnosis";
import { allergyIntoleranceStructure } from "./allergyIntolerance";

export interface Structure<S, T extends ZodTypeAny> {
  name: string;
  description: string;
  toolStructure: T;
  deserialize: (
    data: z.infer<T>,
    currentData: S,
  ) => Promise<{
    data: S;
    errors?: string[];
  }>;
  toPrompt: (data: S) => string;
}

export const codeQuery = (type: ValueSetSystem, primary?: boolean) =>
  z.object({
    code_search_query: z.string().describe("The query"),
    code_search_type: z
      .literal(type)
      .describe('This field must always be "' + type + '"'),
    ...(primary
      ? { primary: z.literal(true).describe("This field must always be true") }
      : {}),
  });
export const arbitraryStructures = {
  string: z.string(),
  integer: z.number().int().describe("A whole integer"),
  decimal: z.number().describe("A decimal number"),
  boolean: z.boolean(),
  date: z.string().describe(`YYYY-MM-DD format.`),
  dateTime: z.string().describe(`YYYY-MM-DDTHH:mm format`),
};

const STRUCTURES = {
  encounter: encounterStructure,
  symptom: symptomsStructure,
  medication_request: medicationRequestStructure,
  medication_statement: medicationStatementStructure,
  diagnosis: diagnosisStructure,
  allergy_intolerance: allergyIntoleranceStructure,
};

export default STRUCTURES;
