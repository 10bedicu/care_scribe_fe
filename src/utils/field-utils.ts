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
import { buildQuantitySchema, buildValueSetSchema } from "./valueset-cache";

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
        value: (() => {
          const responseValues = formState
            .find((qn: any) =>
              qn.responses.some(
                (response: any) => response.question_id === question.id,
              ),
            )
            ?.responses.find(
              (response: any) => response.question_id === question.id,
            )?.values;
          if (!responseValues?.length) return null;
          // Value-set choice fields store the current value under `coding`.
          const isValueSetChoice =
            question.type === "choice" &&
            !!question.answer_value_set &&
            !question.structured_type;
          if (isValueSetChoice) {
            if (question.repeats) {
              return responseValues
                .map((v: any) => v.coding)
                .filter((c: any) => c);
            }
            return responseValues[0]?.coding ?? null;
          }
          // Quantity fields hold a `{ value, unit, coding? }` shape per
          // care_fe's ResponseValue. Strip the discriminator (and drop
          // `coding` only when the question isn't bound to a value set,
          // since the AI extracts coding too in that case).
          if (question.type === "quantity") {
            const keepCoding = !!question.answer_value_set;
            const stripQuantity = (v: any) => {
              if (!v) return null;
              // eslint-disable-next-line @typescript-eslint/no-unused-vars
              const { type: _t, coding, ...rest } = v;
              return keepCoding && coding ? { ...rest, coding } : rest;
            };
            if (question.repeats) {
              return responseValues
                .map(stripQuantity)
                .filter((v: any) => v !== null && v !== undefined);
            }
            return stripQuantity(responseValues[0]);
          }
          return responseValues[0]?.value ?? null;
        })(),
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
        // `answer_option` is only meaningful for string-ish enum fields;
        // for `quantity` the value is numeric with a unit/coding, so an
        // enum constraint would be nonsense.
        const useAnswerOptions =
          field.question.type !== "quantity" &&
          !!field.question.answer_option?.length;
        let enumDescription = undefined;
        if (useAnswerOptions) {
          enumDescription =
            "ENUM TYPE -- ONLY CHOOSE FROM: " +
            field.question.answer_option!.map((opt) => opt.value).join(" | ");
        }

        // Choice questions backed by a value set get a tiered schema
        // (inline enum / code+display_names / display_names) determined
        // by the cached value-set metadata. See `valueset-cache.ts`.
        const useValueSet =
          field.question.type === "choice" &&
          !!field.question.answer_value_set &&
          !structuredType;

        // Quantity questions get a `{ value, unit, coding? }` schema
        // (see `buildQuantitySchema`); when bound to a value set, the
        // `coding` (UI "Type" picker) is resolved post-AI.
        const isQuantity =
          field.question.type === "quantity" && !structuredType;

        let structure = useValueSet
          ? buildValueSetSchema(
              field.question.answer_value_set!,
              !!field.question.repeats,
            )
          : isQuantity
            ? buildQuantitySchema(field.question, !!field.question.repeats)
            : structuredType && Object.keys(STRUCTURES).includes(structuredType)
              ? STRUCTURES[structuredType as keyof typeof STRUCTURES]
                  .toolStructure
              : arbitraryStructure(
                  fieldType as keyof typeof arbitraryStructures,
                  !field.question.repeats ? enumDescription : undefined,
                );

        if (!useValueSet && !isQuantity && field.question.repeats) {
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

  // Value-set choice fields hold their value in `coding` (per care_fe's
  // ChoiceQuestion), not `value`. `val` for these is a `Code` (or
  // `Code[]` for repeats), already canonicalised by cleanAIResponse.
  const isValueSetChoice =
    field.question.type === "choice" &&
    !!field.question.answer_value_set &&
    !field.question.structured_type;

  // Quantity questions: care_fe's ResponseValue is
  // `{ type: "quantity", value: number, unit?: Code, coding?: Code }`.
  // The AI fills `{ value, unit }`; spread it into a quantity-typed
  // entry while preserving any pre-selected `coding` from the UI.
  const isQuantity = field.question.type === "quantity";
  const wrapQuantity = (existing: any, src: any) => ({
    ...(existing && typeof existing === "object" ? existing : {}),
    ...(src && typeof src === "object" ? src : {}),
    type: "quantity" as const,
  });

  setFormState((formState: any) =>
    formState.map((qn: any) => ({
      ...qn,
      responses: qn.responses.map((response: any) =>
        response.question_id === qId
          ? {
              ...response,
              values: isValueSetChoice
                ? !field.question.repeats
                  ? val
                    ? [{ type: "quantity", coding: val }]
                    : []
                  : val && Array.isArray(val)
                    ? val.map((coding) => ({ type: "quantity", coding }))
                    : []
                : isQuantity
                  ? !field.question.repeats
                    ? val && typeof val === "object"
                      ? [wrapQuantity(response.values[0], val)]
                      : []
                    : Array.isArray(val)
                      ? val.map((v, i) => wrapQuantity(response.values[i], v))
                      : []
                  : !field.question.repeats
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
