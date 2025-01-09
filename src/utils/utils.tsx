import {
  CodeSearchQuery,
  FormQuestion,
  ScribeAIResponse,
  ScribeField,
  ScribeFieldSuggestion,
} from "../types";
import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { API } from "./api";

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

      const currentValue = formState
        .find((qn: any) =>
          qn.responses.some(
            (response: any) => response.question_id === questionId,
          ),
        )
        ?.responses.find((response: any) => response.question_id === questionId)
        ?.values?.[0]?.value;

      return {
        question,
        fieldElement: ele,
        value: JSON.stringify(currentValue || null),
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
  let parsedValue;
  try {
    parsedValue = JSON.parse(val as string); // Support edge cases where scribe does not return JSON
  } catch (error) {
    parsedValue = val;
  }
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
  return <span>{String(parsedValue)}</span>;
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
  let val = (useNewValue ? field.newValue : field.value) as any;
  try {
    val = JSON.parse(val);
  } catch (error) {}
  const element = field.fieldElement as HTMLElement;

  const qId = element.getAttribute("data-question-id");

  // just incase scribe does not include previous data
  if (qId === "encounter") {
    val = [
      {
        ...JSON.parse(field.value as any)[0],
        ...val[0],
      },
    ];
  }

  const formQuestionnaire = formState.map((qn: any) => ({
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
    "text" in value &&
    typeof (value as { id: unknown }).id === "string" &&
    typeof (value as { text: unknown }).text === "string"
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

/**
 * A type guard to check if the given value is a CodeSearchQuery object.
 */
function isCodeSearchQuery(value: any): value is CodeSearchQuery {
  return (
    value &&
    typeof value === "object" &&
    "code_search_type" in value &&
    "code_search_query" in value
  );
}

/**
 * Recursively transforms an object by finding CodeSearchQuery objects and
 * replacing them using the provided async transform function.
 */
async function transformObjectAsync<T>(
  input: T,
  transformFn: (codeSearchQuery: CodeSearchQuery) => Promise<any>,
): Promise<T> {
  // If it's an array, transform each element.
  if (Array.isArray(input)) {
    const transformedArray = await Promise.all(
      input.map(async (item) => transformObjectAsync(item, transformFn)),
    );
    return transformedArray as unknown as T;
  }

  // If it's a non-null object, examine its properties.
  if (input !== null && typeof input === "object") {
    // Check if it's a CodeSearchQuery; if so, transform it.
    if (isCodeSearchQuery(input)) {
      // Transform and return the result of the transform function.
      return (await transformFn(input)) as T;
    } else {
      // Otherwise, recurse through each property of the object.
      const output: Record<string, any> = { ...input };
      const keys = Object.keys(output);

      for (const key of keys) {
        output[key] = await transformObjectAsync(output[key], transformFn);
      }
      return output as T;
    }
  }

  // If it's a primitive (string, number, boolean, null, undefined), just return as-is.
  return input;
}

export async function replaceCodeSearchQueriesInObjectAsync<T>(
  obj: T,
): Promise<T> {
  return transformObjectAsync(obj, async (codeSearchQuery) => {
    const valuesets = await API.valuesets.expand(
      codeSearchQuery.code_search_type,
      codeSearchQuery.code_search_query,
    );
    const validCode = valuesets.results[0];

    if (!validCode) {
      return undefined;
    }

    return {
      system: validCode.system,
      code: validCode.code,
      display: validCode.display,
    };
  });
}
