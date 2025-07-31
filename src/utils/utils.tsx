import {
  ScribeAIResponse,
  ScribeField,
  ScribeFieldSuggestion,
  ScribeFileType,
  ScribeHydratedAndRawField,
  ScribeHydratedField,
  ScribeHydratedQuestionnaire,
  ScribeQuestionnaire,
  VALUESET_SYSTEM_NAMES,
} from "../types";
import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { API } from "./api";
import { z } from "zod";
import STRUCTURES, {
  arbitraryStructure,
  arbitraryStructures,
} from "./structures";
import zodToJsonSchema from "zod-to-json-schema";
import Fuse from "fuse.js";
import uploadFile from "./uploadFile";
import isEqual from "lodash.isequal";

export const getQuestionInputs: (
  formState: any,
  headless?: boolean,
) => ScribeQuestionnaire[] = (formState: any, headless?: boolean) => {
  return formState
    .map((qn: any) => ({
      title: qn.questionnaire.title,
      description: qn.questionnaire.description,
      questions: getQuestions(qn.questionnaire.questions, formState, headless),
    }))
    .filter((qn: ScribeQuestionnaire) => qn.questions.length > 0);
};

const getQuestions = (
  questions: any[],
  formState: any,
  headless?: boolean,
): (ScribeField | ScribeQuestionnaire)[] => {
  return questions
    .map((question: any) => {
      if (question.type === "group") {
        return {
          title: question.text,
          description: question.description,
          questions: question.questions
            ? getQuestions(question.questions, formState, headless)
            : [],
        };
      }
      return {
        question,
        value:
          formState
            .find((qn: any) =>
              qn.responses.some(
                (response: any) => response.question_id === question.id,
              ),
            )
            ?.responses.find(
              (response: any) => response.question_id === question.id,
            )?.values?.[0]?.value || null,
        note: formState
          .find((qn: any) =>
            qn.responses.some(
              (response: any) => response.question_id === question.id,
            ),
          )
          ?.responses.find(
            (response: any) => response.question_id === question.id,
          )?.note,
      };
    })
    .filter((f) => ("question" in f ? true : f.questions.length > 0));
};
export function getHydratedFields(
  questionnaires: ScribeQuestionnaire[],
  stripRawData?: true,
): ScribeHydratedQuestionnaire<ScribeHydratedField>[];
export function getHydratedFields(
  questionnaires: ScribeQuestionnaire[],
  stripRawData?: false,
): ScribeHydratedQuestionnaire<ScribeHydratedAndRawField>[];
export function getHydratedFields(
  questionnaires: ScribeQuestionnaire[],
  stripRawData?: boolean,
):
  | ScribeHydratedQuestionnaire<ScribeHydratedField>[]
  | ScribeHydratedQuestionnaire<ScribeHydratedAndRawField>[] {
  return questionnaires
    .map((questionnaire) => {
      const fields = questionnaire.questions;
      if (!fields || !fields.length) return null;

      type ReturnField = typeof stripRawData extends true
        ? ScribeHydratedField
        : ScribeHydratedAndRawField;

      const constructHydratedField = (
        field: ScribeField | ScribeQuestionnaire,
        parentIds: string[] = [],
      ): ReturnField | ScribeHydratedQuestionnaire<ReturnField> | null => {
        if ("questions" in field) {
          // If the field is a questionnaire, recursively construct its fields
          const newParentIds = [...parentIds, field.title || "Untitled Group"];
          return {
            title: field.title || "Untitled Group",
            description: field.description || "",
            fields: field.questions
              .map((q) => constructHydratedField(q, newParentIds))
              .filter((f) => f !== null),
          };
        }
        // If the field is a regular field, construct it normally

        const structuredType = field.question.structured_type;

        if (
          structuredType &&
          !Object.keys(STRUCTURES).includes(structuredType)
        ) {
          return null;
        }

        const fieldType = Object.keys(arbitraryStructures).includes(
          field.question.type,
        )
          ? field.question.type
          : "string";

        const nonQsParents = parentIds.slice(1, parentIds.length);
        let enumDescription = undefined;
        if (field.question.answer_option?.length) {
          enumDescription =
            "ENUM TYPE -- ONLY CHOOSE FROM: " +
            field.question.answer_option.map((opt) => opt.value).join(" | ");
        }

        let structure =
          structuredType && Object.keys(STRUCTURES).includes(structuredType)
            ? STRUCTURES[structuredType as keyof typeof STRUCTURES]
                .toolStructure
            : arbitraryStructure(
                fieldType as keyof typeof arbitraryStructures,
                !field.question.repeats ? enumDescription : undefined,
              );

        // const humanValue =
        //   structuredType && Object.keys(STRUCTURES).includes(structuredType)
        //     ? STRUCTURES[structuredType as keyof typeof STRUCTURES].toPrompt(
        //         field.question.structured_type === "encounter"
        //           ? (field.value as any)[0]
        //           : field.value,
        //       )
        //     : (field.value as string);

        if (field.question.repeats) {
          structure = z.array(structure) as z.ZodArray<any>;
          if (enumDescription) {
            structure = structure.describe(enumDescription) as z.ZodArray<any>;
          }
        }

        const description = `${field.question.text}${nonQsParents.length ? ` (${nonQsParents.join(" -> ")})` : ""}${field.question.description ? `: ${field.question.description}` : ""}`;

        if (!structuredType) {
          structure = z
            .object({
              value: structure.nullable(),
              note: z.string().nullable(),
            })
            .describe(description) as any;
        } else {
          structure = structure.describe(description) as any;
        }

        return {
          friendlyName: field.question.text || "Unlabled Field",
          current: field.value,
          humanValue: "",
          id: field.question.id,
          type: field.question.type,
          structuredType: field.question.structured_type || undefined,
          schema: structure
            ? zodToJsonSchema(structure, {
                strictUnions: true,
                $refStrategy: "none",
                target: "openApi3",
              })
            : undefined,
          ...(!stripRawData ? field : {}),
        } as ReturnField;
      };

      const toReturn = {
        title: questionnaire.title || "Untitled Questionnaire",
        description: questionnaire.description || "",
        fields: fields
          .map((field) =>
            constructHydratedField(field, [
              questionnaire.title || "Untitled Questionnaire",
            ]),
          )
          .filter((f) => f !== null),
      };
      return toReturn;
    })
    .filter((q) => q !== null);
}

export const getFieldsToReview = (
  aiResponse: ScribeAIResponse,
  scrapedFields: ScribeQuestionnaire[],
): ScribeFieldSuggestion[] => {
  const hydratedFields = getHydratedFields(scrapedFields, false);

  const flattenFields = (
    fields: (
      | ScribeHydratedAndRawField
      | ScribeHydratedQuestionnaire<ScribeHydratedAndRawField>
    )[],
  ): ScribeHydratedAndRawField[] =>
    fields.flatMap((field) =>
      "id" in field ? [field] : flattenFields(field.fields),
    );

  return hydratedFields
    .flatMap((qn) => flattenFields(qn.fields))
    .map((field) => {
      const id = field.id;
      return {
        ...field,
        newValue: aiResponse[id]?.value,
        newNote: aiResponse[id]?.note,
      };
    })
    .filter((f) => f.id && f.newValue !== undefined && f.newValue !== null);
};

export const renderCamelCase = (str: string) => {
  // replace all underscores with spaces
  return str.replace(/_/g, " ");
};

export const renderFieldValue = (
  values: {
    value: unknown;
    newValue?: unknown;
    structure?: (typeof STRUCTURES)[keyof typeof STRUCTURES];
  },
  useNewValue?: boolean,
) => {
  const val = useNewValue ? values.newValue : values.value;

  let humanValue = val;
  if (values.structure) {
    humanValue = values.structure.toPrompt(val as any);
  } else {
    // convert from snake case to human readable text
    humanValue =
      (typeof val === "string"
        ? renderCamelCase(val)
        : Array.isArray(val)
          ? val.map(renderCamelCase).join(", ")
          : JSON.stringify(val)
      )?.toLocaleLowerCase() || "";
  }

  // replace all lines that start with ### to bold text
  if (typeof humanValue === "string") {
    humanValue = humanValue.replace(/### (.*)/g, "<strong>$1</strong>");
  }

  return String(humanValue);
};

export const sleep = async (seconds: number) => {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, seconds);
  });
};

export const updateFieldValue = (
  field: ScribeFieldSuggestion,
  useNewValue?: boolean,
  setFormState?: any,
) => {
  const val = (useNewValue ? field.newValue : field.value) as any;
  const note = useNewValue ? field.newNote : field.note;
  const element = document.getElementById(
    "question-" + field.question.id,
  ) as HTMLElement;

  if (!element) {
    console.warn("Element not found for field:", field.question.id);
    return;
  }

  const qId = field.question.id;

  setFormState((formState: any) =>
    formState.map((qn: any) => ({
      ...qn,
      responses: qn.responses.map((response: any) =>
        response.question_id === qId
          ? {
              ...response,
              values: !field.question.repeats
                ? response.values.length
                  ? response.values.map((v: any, i: number) =>
                      i === 0
                        ? {
                            ...v,
                            value: val,
                          }
                        : v,
                    )
                  : [
                      {
                        type: field.question.structured_type || typeof val,
                        value: val,
                      },
                    ]
                : val
                  ? val.map((v: any) => ({
                      type: field.question.structured_type || typeof v,
                      value: v,
                    }))
                  : [],
              note,
            }
          : response,
      ),
    })),
  );
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function debounce<T extends unknown[], U>(
  callback: (...args: T) => PromiseLike<U> | U,
  wait: number,
) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: T): Promise<U> => {
    clearTimeout(timer);
    return new Promise((resolve) => {
      timer = setTimeout(() => resolve(callback(...args)), wait);
    });
  };
}

export async function getCodeFromQuery(
  query: string,
  type: keyof typeof VALUESET_SYSTEM_NAMES,
) {
  const valuesets = await API.valuesets.expand(type, query);
  const validCode = valuesets.results[0];

  if (!validCode) {
    return null;
  }

  return {
    system: validCode.system,
    code: validCode.code,
    display: validCode.display,
  };
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
      const result = fuse.search(d);
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

// Uploads a scribe audio blob. Returns the response of the upload.
export const uploadScribeFile = async (
  blob: Blob,
  scribeInstanceId: string,
  type: ScribeFileType,
) => {
  const category = type === ScribeFileType.AUDIO ? "AUDIO" : "UNSPECIFIED";
  const extension = blob?.type?.split("/")?.[1].split(";")?.[0];
  const name = "file" + (extension ? `.${extension}` : "");
  const filename = Date.now().toString();

  let length = undefined;
  if (type === ScribeFileType.AUDIO) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    length = Number(audioBuffer.duration.toFixed(2));
  }

  const data = await API.scribe.createFileUpload({
    original_name: name,
    file_type: type,
    name: filename,
    associating_id: scribeInstanceId,
    file_category: category,
    mime_type: blob?.type?.split(";")?.[0],
    length,
  });

  await new Promise<void>((resolve, reject) => {
    const url = data?.signed_url;
    const internal_name = data?.internal_name;
    const f = blob;
    if (f === undefined) {
      reject(Error("No file to upload"));
      return;
    }
    const newFile = new File([f], `${internal_name}`, { type: f.type });
    const headers = {
      "Content-type": newFile?.type?.split(";")?.[0],
      "Content-disposition": "inline",
    };

    uploadFile(
      url || "",
      newFile,
      "PUT",
      headers,
      (xhr: XMLHttpRequest) => (xhr.status === 200 ? resolve() : reject()),
      null,
      reject,
    );
  });

  return await API.scribe.editFileUpload(
    data.id,
    type === ScribeFileType.AUDIO ? "SCRIBE_AUDIO" : "SCRIBE_DOCUMENT",
    scribeInstanceId,
    { upload_completed: true },
  );
};

export const cleanAIResponse = async (
  aiResponse: ScribeAIResponse,
  questionnaire: ScribeQuestionnaire[],
) => {
  const processAiResponse = {
    successful: {} as ScribeAIResponse,
    failed: {} as Record<string, string[]>,
  };
  const hfields = getHydratedFields(questionnaire, false);
  // run type validations
  const changedData = (
    (await Promise.all(
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
        if (!field) return [k, null];

        const structure = field.structuredType
          ? STRUCTURES[field.structuredType as keyof typeof STRUCTURES]
          : null;

        if (v === null || v === undefined) {
          return [k, null];
        }
        let deserializedValue: any = v;
        let note: string | undefined;

        if (structure) {
          const deserialized = await structure.deserialize(
            v as any,
            field.current as any,
          );
          deserializedValue = deserialized.data as any;
          processAiResponse.successful[k] = deserializedValue as any;
          processAiResponse.failed[k] = deserialized.errors || [];
        } else {
          deserializedValue = (v as any).value;
          note = (v as any).note;
          processAiResponse.successful[k] = v as any;
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
            ? validOptions[0]
            : validOptions;
        }

        // weird case where the note is not null, but "null" (a string)
        if (
          note &&
          (note.toLowerCase() === "null" ||
            note?.toLowerCase() === "undefined" ||
            note?.toLowerCase() === "none")
        ) {
          note = undefined;
        }

        if (isEqual(deserializedValue, field.current)) {
          return [k, null];
        }

        if (
          field.question.structured_type &&
          field.question.structured_type !== "encounter"
        ) {
          const validation = structure?.toolStructure.safeParse(v);
          if (!validation?.success) {
            console.error("Validation error", v, validation?.error);
            return [k, null];
          }
        }
        return [
          k,
          {
            value: deserializedValue,
            note,
          },
        ];
      }),
    )) as Array<[string, { value: any; note?: string } | null]>
  )
    .filter(
      ([, output]) => output?.value !== null && output?.value !== undefined,
    )
    .map(([k, v]) => ({ [k as string]: v }))
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
