import {
  ScribeAIResponse,
  ScribeField,
  ScribeFieldSuggestion,
  ScribeQuestionnaire,
  ValueSetSystem,
} from "../types";
import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { API } from "./api";
import { z } from "zod";

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

const getQuestions = (questions: any[], formState: any): ScribeField[] => {
  return questions
    .flatMap((question: any) => {
      if (question.type === "group") {
        return getQuestions(question.questions, formState);
      }
      return [
        {
          question,
          fieldElement: document.querySelector(
            `[data-question-id="${question.id}"]`,
          ),
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
        },
      ];
    })
    .filter((f) => !!f.fieldElement) as ScribeField[];
};

export const getFieldsToReview = (
  aiResponse: ScribeAIResponse,
  scrapedFields: ScribeQuestionnaire[],
) => {
  return scrapedFields
    .flatMap((qn) =>
      qn.questions.map((field) => ({
        ...field,
        id: constructFieldId(qn.title, field.question.text),
      })),
    )
    .map((f) => ({ ...f, newValue: aiResponse[f.id] }))
    .filter((f) => f.newValue);
};

export const renderCamelCase = (str: string) => {
  // replace all underscores with spaces
  return str.replace(/_/g, " ");
};

export const renderFieldValue = (
  field: {
    value: ScribeField["value"];
    newValue?: ScribeFieldSuggestion["newValue"];
  },
  useNewValue?: boolean,
) => {
  const val = useNewValue ? field.newValue : field.value;
  if (Array.isArray(val)) {
    return (
      <ul className="list-disc pl-5">
        {val.map((item, index) => (
          <li key={index}>
            {typeof item === "object" && item !== null ? (
              <ul className="list-disc pl-5">
                {Object.entries(item).map(([key, value]) => (
                  <li key={key}>
                    <span className="font-semibold">
                      {renderCamelCase(key)}:
                    </span>{" "}
                    {typeof value === "string" || typeof value === "number"
                      ? String(value)
                      : "..."}
                  </li>
                ))}
              </ul>
            ) : (
              String(item)
            )}
          </li>
        ))}
      </ul>
    );
  } else if (typeof val === "object" && val !== null) {
    return (
      <ul className="list-disc pl-5">
        {Object.entries(val).map(([key, value]) => (
          <li key={key}>
            <span className="font-semibold">{renderCamelCase(key)}:</span>{" "}
            {typeof value === "string" || typeof value === "number"
              ? String(value)
              : "..."}
          </li>
        ))}
      </ul>
    );
  }
  return <span>{String(val)}</span>;
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
  const element = field.fieldElement as HTMLElement;

  const qId = element.getAttribute("data-question-id");

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
                : val.map((v: any) => ({
                    type: field.question.structured_type || typeof v,
                    value: v,
                  })),
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

export const isoDateTime = z
  .string()
  .describe(`ISO format, e.g. "2023-10-01T12:00:00Z"`);

export const constructFieldId = (
  questionnaire_name: string,
  field_name: string,
) =>
  (questionnaire_name + "__" + field_name)
    .replace(/\s+/g, "_")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
