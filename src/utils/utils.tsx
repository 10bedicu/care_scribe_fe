import {
  ScribeAIResponse,
  ScribeField,
  ScribeFieldSuggestion,
  ScribeHydratedAndRawField,
  ScribeHydratedField,
  ScribeHydratedQuestionnaire,
  ScribeQuestionnaire,
  ValueSetSystem,
} from "../types";
import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { API } from "./api";
import { z } from "zod";
import STRUCTURES, { arbitraryStructures } from "./structures";
import zodToJsonSchema from "zod-to-json-schema";

export const getQuestionInputs: (formState: any) => ScribeQuestionnaire[] = (
  formState: any,
) => {
  return formState
    .map((qn: any) => ({
      title: qn.questionnaire.title,
      description: qn.questionnaire.description,
      questions: getQuestions(qn.questionnaire.questions, formState),
    }))
    .filter((qn: ScribeQuestionnaire) => qn.questions.length > 0);
};

const getQuestions = (
  questions: any[],
  formState: any,
): (ScribeField | ScribeQuestionnaire)[] => {
  return questions
    .map((question: any) => {
      if (question.type === "group") {
        return {
          title: question.text,
          description: question.description,
          questions: getQuestions(question.questions, formState),
        };
      }
      return {
        question,
        fieldElement: document.getElementById(
          "question-" + question.id,
        ) as Element,
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
    .filter((f) =>
      "question" in f ? !!f.fieldElement : f.questions.length > 0,
    );
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
      ): ReturnField | ScribeHydratedQuestionnaire<ReturnField> => {
        if ("questions" in field) {
          // If the field is a questionnaire, recursively construct its fields
          const newParentIds = [...parentIds, field.title || "Untitled Group"];
          return {
            title: field.title || "Untitled Group",
            description: field.description || "",
            fields: field.questions.map((q) =>
              constructHydratedField(q, newParentIds),
            ),
          };
        }
        // If the field is a regular field, construct it normally

        const id = constructFieldId([
          ...parentIds,
          field.question.text || "Unlabled Field",
        ]);

        const structuredType = field.question.structured_type;

        const fieldType = Object.keys(arbitraryStructures).includes(
          field.question.type,
        )
          ? field.question.type
          : "string";

        let structure =
          structuredType && Object.keys(STRUCTURES).includes(structuredType)
            ? STRUCTURES[structuredType as keyof typeof STRUCTURES]
                .toolStructure
            : arbitraryStructures[
                fieldType as keyof typeof arbitraryStructures
              ];

        if (field.question.repeats) {
          structure = z.array(structure) as z.ZodArray<any>;
        }

        const humanValue =
          structuredType && Object.keys(STRUCTURES).includes(structuredType)
            ? STRUCTURES[structuredType as keyof typeof STRUCTURES].toPrompt(
                field.question.structured_type === "encounter"
                  ? (field.value as any)[0]
                  : field.value,
              )
            : (field.value as string);

        if (field.question.answer_option?.length) {
          structure = z.enum(
            field.question.answer_option.map((opt) => opt.value) as [string],
          ) as any;
          if (field.question.repeats) {
            structure = z.array(structure) as z.ZodArray<any>;
          }
        }

        if (!structuredType) {
          structure = z.object({
            value: structure,
            note: z.string().optional(),
          }) as any;
        }

        return {
          friendlyName: field.question.text || "Unlabled Field",
          current: field.value,
          humanValue,
          id,
          type: field.question.type,
          structuredType: field.question.structured_type || undefined,
          schema: structure ? zodToJsonSchema(structure) : undefined,
          ...(!stripRawData ? field : {}),
        } as ReturnField;
      };

      const toReturn = {
        title: questionnaire.title || "Untitled Questionnaire",
        description: questionnaire.description || "",
        fields: fields.map((field) =>
          constructHydratedField(field, [
            questionnaire.title || "Untitled Questionnaire",
          ]),
        ),
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
    .filter((f) => f.id && f.newValue);
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
  let val = (useNewValue ? field.newValue : field.value) as any;
  const note = useNewValue ? field.newNote : field.note;
  const element = field.fieldElement as HTMLElement;

  const qId = element.id.replace("question-", "");

  // just incase scribe does not include previous data
  if (qId === "encounter") {
    val = [
      {
        ...(field.value as any)[0],
        ...val,
      },
    ];
  }

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

export async function getCodeFromQuery(query: string, type: ValueSetSystem) {
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

export const constructFieldId = (names: string[]) =>
  names
    .join("__")
    .replace(/\s+/g, "_")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
