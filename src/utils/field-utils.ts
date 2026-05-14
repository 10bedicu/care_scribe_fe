import {
  ScribeDeseriliazedValue,
  ScribeField,
  ScribeFieldSuggestion,
  ScribeHydratedAndRawField,
  ScribeHydratedField,
  ScribeHydratedQuestionnaire,
  ScribeQuestionnaire,
} from "@/types";
import STRUCTURES, {
  arbitraryStructure,
  arbitraryStructures,
} from "./structures";
import { z } from "zod";
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
          questions: question.questions
            ? getQuestions(question.questions, formState)
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

        if (field.question.repeats) {
          structure = z.array(structure) as z.ZodArray<any>;
          if (enumDescription) {
            structure = structure.describe(enumDescription) as z.ZodArray<any>;
          }
        }

        const description = `${field.question.text}${field.question.unit ? ` (in ${field.question.unit.code} | ${field.question.unit.display})` : ""}${nonQsParents.length ? ` (${nonQsParents.join(" -> ")})` : ""}${field.question.description ? `: ${field.question.description}` : ""}`;

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

export const updateFieldValue = (
  field: ScribeFieldSuggestion,
  useNewValue?: boolean,
  setFormState?: any,
) => {
  const val = useNewValue ? field.newValue : field.value;
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
                : val && Array.isArray(val)
                  ? val.map((v) => ({
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

export const getFieldsToReview = (
  aiResponse: Record<
    string,
    { value: ScribeDeseriliazedValue; note: string | null }
  >,
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
