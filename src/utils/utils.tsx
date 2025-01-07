import dayjs from "dayjs";
import {
  FormQuestion,
  ScribeAIResponse,
  ScribeField,
  ScribeFieldSuggestion,
} from "../types";
import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { STRUCTURED_INPUT_PROMPTS } from "./prompts";

export const getQuestionInputs: (formState: any) => ScribeField[] = (
  formState: any,
) => {
  const formElement = document;
  const questions = [
    ...formElement.querySelectorAll("[data-question-id]"),
  ] as HTMLInputElement[];

  return questions
    .map((ele) => {
      const questionId = ele.getAttribute("data-question-id");
      const question = findQuestion(formState, questionId || "");

      if (!question) throw Error("No Question Found");
      let customPrompt;
      let customExample;
      let options;
      switch (question.type) {
        case "structured": {
          const structuredType = question?.structured_type;

          if (!structuredType) throw Error("No structured type");

          if (Object.keys(STRUCTURED_INPUT_PROMPTS).includes(structuredType)) {
            const mapping =
              STRUCTURED_INPUT_PROMPTS[
                structuredType as keyof typeof STRUCTURED_INPUT_PROMPTS
              ];
            customPrompt = mapping.prompt;
            customExample = mapping.example;
          }
          break;
        }
        case "choice": {
          options = question.answer_option;
          break;
        }

        default:
          break;
      }

      const currentValue = formState
        .find((qn: any) =>
          qn.responses.some(
            (response: any) => response.question_id === questionId,
          ),
        )
        ?.responses.find((response: any) => response.question_id === questionId)
        ?.values?.[0]?.value;

      return {
        type: question.type,
        fieldElement: ele,
        label: question?.text,
        options,
        value: JSON.stringify(currentValue || null),
        customPrompt,
        customExample: JSON.stringify(customExample),
      } as ScribeField;
    })
    .filter((i) => !!i);
};

export const getFieldsToReview = (
  aiResponse: ScribeAIResponse,
  scrapedFields: ScribeField[],
) => {
  return scrapedFields
    .map((f, i) => ({ ...f, newValue: aiResponse[i] }))
    .filter((f) => f.newValue);
};

export const renderFieldValue = (
  field: ScribeFieldSuggestion,
  useNewValue?: boolean,
) => {
  const val = useNewValue ? field.newValue : field.value;
  if (field.type === "structured") {
    try {
      const parsedValue = JSON.parse(val as string);
      if (Array.isArray(parsedValue)) {
        return (
          <ul className="list-disc pl-5">
            {parsedValue.map((item, index) => (
              <li key={index}>
                {typeof item === "object" && item !== null ? (
                  <ul className="list-disc pl-5">
                    {Object.entries(item).map(([key, value]) => (
                      <li key={key}>
                        <span className="font-semibold">{key}:</span>{" "}
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
      } else if (typeof parsedValue === "object" && parsedValue !== null) {
        return (
          <ul className="list-disc pl-5">
            {Object.entries(parsedValue).map(([key, value]) => (
              <li key={key}>
                <span className="font-semibold">{key}:</span>{" "}
                {typeof value === "string" || typeof value === "number"
                  ? String(value)
                  : "..."}
              </li>
            ))}
          </ul>
        );
      }
    } catch (e) {
      // If parsing fails, treat as a regular string
    }

    return (
      <span>
        {typeof val === "string" &&
        dayjs(val.replace(/^"(.*)"$/, "$1")).isValid()
          ? dayjs(val.replace(/^"(.*)"$/, "$1")).format("MMMM D, YYYY h:mm A")
          : String(val)}
      </span>
    );
  }
  if (!["string", "number"].includes(typeof field.value)) return "...";
  return field.options
    ? field.options.find((o) => String(o.value) === String(val))?.text
    : (val as string | number);
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
  formState?: any,
  setFormState?: any,
) => {
  const val = (useNewValue ? field.newValue : field.value) as string;
  const element = field.fieldElement as HTMLElement;

  const qId = element.getAttribute("data-question-id");
  const formQuestionnaire = formState.map((qn: any) => ({
    ...qn,
    responses: qn.responses.map((response: any) =>
      response.question_id === qId
        ? {
            ...response,
            values: response.values.length
              ? response.values.map((v: any, i: number) =>
                  i === 0 ? { ...v, value: JSON.parse(val) } : v,
                )
              : [{ value: JSON.parse(val) }],
          }
        : response,
    ),
  }));
  setFormState(formQuestionnaire);
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function isFormQuestion(value: unknown): value is FormQuestion {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    typeof (value as { id: unknown }).id === "string"
  );
}

export function findQuestion(
  form: unknown,
  questionId: string,
): FormQuestion | undefined {
  // If array, search each element
  if (Array.isArray(form)) {
    for (const element of form) {
      const result = findQuestion(element, questionId);
      if (result !== undefined) {
        return result;
      }
    }
    return undefined;
  }

  if (form !== null && typeof form === "object") {
    if (isFormQuestion(form) && form.id === questionId) {
      return form;
    }

    // Otherwise, search all properties of this object
    for (const key in form) {
      // Must ensure it's an own property
      if (Object.prototype.hasOwnProperty.call(form, key)) {
        const value = (form as Record<string, unknown>)[key];
        const result = findQuestion(value, questionId);
        if (result !== undefined) {
          return result;
        }
      }
    }
  }

  return undefined;
}
