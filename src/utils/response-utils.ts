import {
  Code,
  ScribeAIResponse,
  ScribeDeseriliazedValue,
  ScribeHydratedAndRawField,
  ScribeMeta,
  ScribeModel,
  ScribeQuestionnaire,
} from "@/types";
import { getHydratedFields } from "./field-utils";
import STRUCTURES from "./structures";
import isEqual from "lodash.isequal";
import { API } from "./api";
import Fuse from "fuse.js";
import dayjs from "dayjs";
import { resolveValueSetResponse } from "./valueset-cache";

// care_fe wires every quantity question's unit picker to the
// `system-ucum-units` ValueSet (QuantityQuestion.tsx), so the unit
// system URI is always UCUM. We stamp it here instead of asking the AI
// for it.
const UCUM_SYSTEM_URI = "http://unitsofmeasure.org";

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

        // Quantity fields: care_fe wires the unit picker to the UCUM
        // value set so we hardcode `unit.system` post-AI rather than
        // round-tripping it through the model. When the question is
        // bound to an `answer_value_set` (the "Type" picker in the UI),
        // the AI's `coding` (a display string or `{display_names}`) is
        // resolved to a canonical `Code` via the same pipeline as
        // value-set choice fields. Done before the `isEqual` check
        // below so an unchanged AI suggestion isn't flagged as new.
        if (
          field.question.type === "quantity" &&
          deserializedValue !== null &&
          deserializedValue !== undefined
        ) {
          if (field.question.answer_value_set) {
            const slug = field.question.answer_value_set;
            const resolveCoding = async (q: any) => {
              if (!q || typeof q !== "object" || q.coding == null) return q;
              const resolved = await resolveValueSetResponse(
                slug,
                q.coding,
                false,
                searchByDisplay,
              );
              if (
                !resolved ||
                (Array.isArray(resolved) && resolved.length === 0)
              ) {
                // Drop the unresolvable coding silently — value+unit
                // are still useful and the user can re-pick the type.
                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { coding: _c, ...rest } = q;
                return rest;
              }
              return { ...q, coding: resolved };
            };
            deserializedValue = (
              Array.isArray(deserializedValue)
                ? await Promise.all(deserializedValue.map(resolveCoding))
                : await resolveCoding(deserializedValue)
            ) as ScribeDeseriliazedValue;
          }

          const stampUcum = (q: any) =>
            q && typeof q === "object" && q.unit && typeof q.unit === "object"
              ? {
                  ...q,
                  unit: { ...q.unit, system: UCUM_SYSTEM_URI },
                }
              : q;
          deserializedValue = (
            Array.isArray(deserializedValue)
              ? deserializedValue.map(stampUcum)
              : stampUcum(deserializedValue)
          ) as ScribeDeseriliazedValue;
          processAiResponse.successful[k] = {
            value: deserializedValue,
            note,
          };
        }

        // Value-set choice fields: resolve the model output (which may be
        // a display string for Tier 1, `{code,display_names}` for Tier 2,
        // or `{display_names}` for Tier 3) into a canonical Code via the
        // value-set expansion endpoint. See `valueset-cache.ts`.
        if (
          field.question.type === "choice" &&
          field.question.answer_value_set &&
          !field.question.structured_type &&
          deserializedValue !== null &&
          deserializedValue !== undefined
        ) {
          const resolved = await resolveValueSetResponse(
            field.question.answer_value_set,
            deserializedValue,
            !!field.question.repeats,
            searchByDisplay,
          );
          if (
            resolved === null ||
            (Array.isArray(resolved) && resolved.length === 0)
          ) {
            // Surface what the model actually searched for so the
            // clinician sees a useful "<term> not found under <Field>"
            // message instead of a raw value-set slug.
            const searchedTerms = (() => {
              const collect = (item: unknown): string[] => {
                if (typeof item === "string") return [item];
                if (item && typeof item === "object") {
                  const dn = (item as { display_names?: unknown })
                    .display_names;
                  if (Array.isArray(dn)) {
                    return dn.filter((d): d is string => typeof d === "string");
                  }
                }
                return [];
              };
              const items = Array.isArray(deserializedValue)
                ? deserializedValue
                : [deserializedValue];
              return Array.from(new Set(items.flatMap(collect))).filter(
                Boolean,
              );
            })();
            const searchedDisplay = searchedTerms.length
              ? `"${searchedTerms.join('", "')}"`
              : "Value";
            processAiResponse.failed[k] = [
              ...(processAiResponse.failed[k] || []),
              `${searchedDisplay} not found under ${field.friendlyName}`,
            ];
            return null;
          }
          deserializedValue = resolved as unknown as ScribeDeseriliazedValue;
          processAiResponse.successful[k] = {
            value: deserializedValue,
            note,
          };
        }

        // `answer_option` enum validation only applies to string-ish
        // fields. Quantity values are numbers with a unit/coding and
        // would never match a string option, so skip the check entirely.
        if (
          field.question.type !== "quantity" &&
          field.question.answer_option?.length
        ) {
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
  type: string,
) {
  try {
    if (!code) {
      throw Error(`Empty code passed to lookupCode for ${type}`);
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
    return searchByDisplay(type, display);
  }
}

/**
 * Resolve a value-set entry purely from its candidate display strings by
 * searching the value-set expansion endpoint and fuzzy-matching the top
 * results. Used as the primary path for Tier 3 (unknown system) value
 * sets and as a fallback for Tier 2 when the model-provided code can't
 * be verified.
 */
export async function searchByDisplay(
  slug: string,
  displays: string[],
): Promise<Code | null> {
  for (const d of displays) {
    if (!d) continue;
    try {
      const { results } = await API.valuesets.expand(slug, d);
      if (!results || !results.length) continue;
      const fuse = new Fuse(results, {
        keys: ["display"],
        ignoreLocation: true,
        includeScore: true,
        threshold: 0.4,
      });
      const hits = fuse.search(d);
      const best = hits[0]?.item ?? results[0];
      if (best) {
        return {
          system: best.system,
          code: best.code,
          display: best.display,
        };
      }
    } catch (err) {
      console.warn(
        `searchByDisplay failed for slug "${slug}" / display "${d}"`,
        err,
      );
    }
  }
  return null;
}
