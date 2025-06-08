import {
  CodeSearchQuery,
  ScribeAIResponse,
  ScribeField,
  ScribeFieldSuggestion,
  ScribeQuestionnaire,
} from "../types";
import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { API } from "./api";

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
    .flatMap((qn) => qn.questions)
    .map((f, i) => ({ ...f, newValue: aiResponse[i] }))
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
): Promise<{ transformed: T; noMatches: CodeSearchQuery[] }> {
  const noMatches: CodeSearchQuery[] = [];
  const transformed = await transformObjectAsync(
    obj,
    async (codeSearchQuery) => {
      const valuesets = await API.valuesets.expand(
        codeSearchQuery.code_search_type,
        codeSearchQuery.code_search_query,
      );
      const validCode = valuesets.results[0];

      if (!validCode) {
        noMatches.push(codeSearchQuery);
        return "CODE_NOT_FOUND";
      }

      return {
        system: validCode.system,
        code: validCode.code,
        display: validCode.display,
      };
    },
  );
  return { transformed, noMatches };
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
