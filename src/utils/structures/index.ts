import { z, ZodTypeAny } from "zod";
import { encounterStructure } from "./encounter";
import { symptomsStructure } from "./symptoms";
import { medicationRequestStructure } from "./medicationRequest";
import { medicationStatementStructure } from "./medicationStatement.tsx";
import { diagnosisStructure } from "./diagnosis";
import { allergyIntoleranceStructure } from "./allergyIntolerance";
import { timeOfDeathStructure } from "./timeOfDeath";
import { serviceRequestStructure } from "./serviceRequest";
import { ReactNode } from "react";
import { ScribeMeta } from "@/types.ts";

export interface Structure<S, T extends ZodTypeAny> {
  name: string;
  description: string;
  toolStructure: T;
  deserialize: (
    data: z.infer<T>,
    currentData: S,
    meta: ScribeMeta,
  ) => Promise<{
    data: S;
    errors?: string[];
  }>;
  toPrompt: (data: S) => ReactNode;
}

export const arbitraryStructures = {
  string: z.string(),
  integer: z.number().int(),
  decimal: z.number(),
  boolean: z.boolean(),
  date: z.string(),
  time: z.string(),
  dateTime: z.string(),
};

export const arbitraryStructure = (
  type: keyof typeof arbitraryStructures,
  description?: string,
) => {
  const structure = arbitraryStructures[type];

  const defaultDescriptions = {
    integer: "An whole integer",
    decimal: "A decimal value",
    date: "YYYY-MM-DD format",
    time: "HH:mm format",
    dateTime: "YYYY-MM-DDTHH:mm format",
  };

  const desc =
    description ||
    defaultDescriptions[type as keyof typeof defaultDescriptions];

  if (!structure) throw new Error(`Unknown structure type: ${type}`);
  return desc ? structure.describe(desc) : structure;
};

export const noNullStrings = (string: string | undefined | null) => {
  if (
    !string ||
    string.toLowerCase() === "null" ||
    string.toLowerCase() === "undefined" ||
    string.toLowerCase() === "none"
  )
    return undefined;
  return string;
};

const STRUCTURES = {
  encounter: encounterStructure,
  symptom: symptomsStructure,
  medication_request: medicationRequestStructure,
  medication_statement: medicationStatementStructure,
  diagnosis: diagnosisStructure,
  allergy_intolerance: allergyIntoleranceStructure,
  time_of_death: timeOfDeathStructure,
  service_request: serviceRequestStructure,
};

export function enumDescription<T extends readonly string[]>(enu: T) {
  return z.string().describe(`ENUM VALUE -- ONLY USE: ${enu.join(" | ")}`);
}

export function validateEnumDescription<T extends readonly string[]>(
  value: string | undefined | null,
  enu: T,
): T[number] | undefined {
  if (!value || !enu.includes(value as T[number])) {
    return undefined;
  }
  return value;
}

export default STRUCTURES;
