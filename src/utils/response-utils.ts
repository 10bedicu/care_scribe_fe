import {
  ScribeAIResponse,
  ScribeDeseriliazedValue,
  ScribeHydratedAndRawField,
  ScribeMeta,
  ScribeModel,
  ScribeQuestionnaire,
  VALUESET_SYSTEM_NAMES,
} from "@/types";
import { getHydratedFields } from "./field-utils";
import STRUCTURES from "./structures";
import isEqual from "lodash.isequal";
import { API } from "./api";
import Fuse from "fuse.js";
import dayjs from "dayjs";

export const cleanAIResponse = async (
  aiResponse: ScribeAIResponse,
  questionnaire: ScribeQuestionnaire[],
  meta: ScribeMeta,
) => {
  const processAiResponse = {
    successful: {} as Record<
      string,
      { value: ScribeDeseriliazedValue; note: string | null }
    >,
    failed: {} as Record<string, string[]>,
  };
  const hfields = getHydratedFields(questionnaire, false);
  // run type validations
  const changedData = (
    await Promise.all(
      Object.entries(aiResponse).map(async ([k, v]) => {
        // Recursively find a field by id in nested hydrated fields
        const findFieldById = (
          fieldsArr: any[],
          id: string,
        ): ScribeHydratedAndRawField | undefined => {
          for (const field of fieldsArr) {
            if ("id" in field && field.id === id) return field;
            if ("fields" in field && Array.isArray(field.fields)) {
              const found = findFieldById(field.fields, id);
              if (found) return found;
            }
          }
          return undefined;
        };
        const field = findFieldById(hfields, k);
        if (!field) return null;

        const structure = field.structuredType
          ? STRUCTURES[field.structuredType as keyof typeof STRUCTURES]
          : null;

        if (v === null || v === undefined) {
          return null;
        }
        let deserializedValue: ScribeDeseriliazedValue = null;
        let note: string | null = null;

        if ("value" in v) {
          deserializedValue = v.value;
          note = v.note;
          processAiResponse.successful[k] = { value: deserializedValue, note };
        } else if (structure) {
          const deserialized = await structure.deserialize(
            v as any,
            field.current as any,
            meta,
          );
          deserializedValue = deserialized.data;
          processAiResponse.successful[k] = {
            value: deserializedValue,
            note: null,
          };
          processAiResponse.failed[k] = deserialized.errors || [];
        }

        if (field.question.answer_option?.length) {
          // If the field has answer options, check if the deserialized value is in the options
          const arrdeserializedValue = !Array.isArray(deserializedValue)
            ? [deserializedValue]
            : deserializedValue;

          const validOptions = [];

          for (const value of arrdeserializedValue) {
            const validOption = field.question.answer_option.find(
              (opt) =>
                String(opt.value).toLowerCase() === String(value).toLowerCase(),
            );

            if (!validOption) {
              processAiResponse.failed[k] = [
                `Value ${value} is not a valid option`,
              ];
            } else {
              validOptions.push(value);
            }
          }

          deserializedValue = !Array.isArray(deserializedValue)
            ? (validOptions[0] as ScribeDeseriliazedValue)
            : (validOptions as ScribeDeseriliazedValue);
        }

        // weird case where the note is not null, but "null" (a string)
        if (
          note &&
          (note.toLowerCase() === "null" ||
            note?.toLowerCase() === "undefined" ||
            note?.toLowerCase() === "none")
        ) {
          note = null;
        }

        if (isEqual(deserializedValue, field.current)) {
          return null;
        }

        if (
          field.question.structured_type &&
          field.question.structured_type !== "encounter"
        ) {
          const validation = structure?.toolStructure.safeParse(v);
          if (!validation?.success) {
            console.error("Validation error", v, validation?.error);
            return null;
          }
        }
        return {
          [k]: {
            value: deserializedValue,
            note,
          },
        };
      }),
    )
  )
    .filter((output) => output !== null)
    .reduce((acc, curr) => ({ ...acc, ...curr }), {});

  return {
    cleaned: changedData,
    meta: processAiResponse,
  };
};

export function shiftUTCToLocalClockTime(inputISOString: string) {
  /**
   * Shifts a UTC ISO string to the local clock time.
   * Required because the AI thinks in UTC, but we want to display the local time.
   */
  try {
    const inputDate = new Date(inputISOString);
    const tzOffsetMinutes = inputDate.getTimezoneOffset();
    const shiftedTime = new Date(
      inputDate.getTime() + tzOffsetMinutes * 60 * 1000,
    );
    return shiftedTime.toISOString();
  } catch (error) {
    console.error("Error shifting time:", error);
    return inputISOString;
  }
}

export function validateTime(
  input: string | null | undefined,
  type: "dt" | "d" | "t" = "dt",
) {
  const timeFormat =
    type === "dt"
      ? "YYYY-MM-DDTHH:mm:ssZ"
      : type === "d"
        ? "YYYY-MM-DD"
        : "HH:mm:ss";

  if (!input) {
    return null;
  }

  const date = dayjs(input, timeFormat, true);
  if (!date.isValid()) {
    return null;
  }
  return date.toISOString();
}

export async function poller(
  scribeInstanceId: string,
  type: "transcript",
  abortRef?: React.RefObject<boolean>,
  resCallback?: (res: ScribeModel) => void,
): Promise<string>;
export async function poller(
  scribeInstanceId: string,
  type: "ai_response",
  abortRef?: React.RefObject<boolean>,
  resCallback?: (res: ScribeModel) => void,
): Promise<ScribeModel["ai_response"]>;
export async function poller(
  scribeInstanceId: string,
  type: "transcript" | "ai_response",
  abortRef?: React.RefObject<boolean>,
  resCallback?: (res: ScribeModel) => void,
): Promise<string | ScribeModel["ai_response"]> {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const res = await API.scribe.get(scribeInstanceId);
        if (abortRef && abortRef.current) {
          clearInterval(interval);
          return resolve(null);
        }
        resCallback?.(res);
        const { status, transcript, ai_response } = res;
        if (status === "FAILED" || status === "REFUSED") {
          clearInterval(interval);
          return reject(new Error("Transcription failed"));
        }

        if (
          type === "transcript" &&
          ["GENERATING_AI_RESPONSE", "COMPLETED"].includes(status) &&
          transcript !== null
        ) {
          clearInterval(interval);
          return resolve(transcript);
        }

        if (
          type === "ai_response" &&
          status === "COMPLETED" &&
          ai_response !== null
        ) {
          clearInterval(interval);
          return resolve(ai_response);
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, 2000);
  });
}

export async function lookupCode(
  code: string,
  display: string[],
  type: keyof typeof VALUESET_SYSTEM_NAMES,
) {
  try {
    // verify that the code is a valid SNOMED code. i.e. it is a nummber
    if (!/^\d+$/.test(code)) {
      throw Error(`Invalid SNOMED code: ${code}`);
    }

    const results = (await API.valuesets.expand(type, code)).results;
    if (!results || !results.length) {
      throw Error(`No results found for code: ${code} of type: ${type}`);
    }
    const valueset = results[0];
    const synonyms = valueset.designation
      .map((designation) =>
        designation.use?.display?.toLowerCase() === "synonym"
          ? { name: designation.value }
          : null,
      )
      .filter((s) => s !== null);

    // Fuzzy match the display name
    const fuse = new Fuse([...synonyms, { name: valueset.display }], {
      keys: ["name"],
      ignoreLocation: true,
      includeScore: true,
      threshold: 0.4,
    });

    for (const d of display) {
      const rawResults = fuse.search(d);
      const result = rawResults.filter((r) => r.score && r.score >= 1);
      if (result.length) {
        console.log(
          "Found matching code for display: ",
          display,
          "of type: ",
          type,
          "with code: ",
          code,
          synonyms
            ? synonyms.map((s) => s.name).join(", ")
            : "No synonyms found",
          "with matching score: ",
          result[0].score,
        );
        return {
          system: valueset.system,
          code: valueset.code,
          display: valueset.display,
        };
      }
    }
    throw Error(
      `No matching code found for display: ${display} of type: ${type} with code: ${code}. ${
        synonyms ? synonyms.map((s) => s.name).join(", ") : "No synonyms found"
      }`,
    );
  } catch (error) {
    console.warn(error);
    for (const d of display) {
      const fallbackQuery = (await API.valuesets.expand(type, d)).results;
      if (
        fallbackQuery &&
        fallbackQuery.length &&
        fallbackQuery[0].display?.toLowerCase() === d.toLowerCase()
      ) {
        console.log(
          "Using fallback query for code lookup: ",
          d,
          "of type: ",
          type,
          "with code: ",
          fallbackQuery[0].code,
        );
        return {
          system: fallbackQuery[0].system,
          code: fallbackQuery[0].code,
          display: fallbackQuery[0].display,
        };
      }
    }

    return null;
  }
}
