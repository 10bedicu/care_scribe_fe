import dayjs from "dayjs";
import { ScribeAIResponse, ScribeField, ScribeFieldSuggestion } from "../types";
import clsx, { ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { STRUCTURED_INPUT_PROMPTS } from "./prompts";

const isVisible = (elem: HTMLElement, allowSubform: boolean) => {
  // Ignore fields that are hidden in the viewport
  return (
    !!(
      elem.offsetWidth ||
      elem.offsetHeight ||
      elem.getClientRects().length ||
      window.getComputedStyle(elem).visibility !== "hidden"
    ) &&
    // Intentionally ignored fields
    !elem.closest('[data-scribe-ignore="true"]') &&
    // Check if field is not in a subform
    (allowSubform ? true : !elem.closest("[data-scribe-subform]")) &&
    !elem.closest("[data-structured-input]") &&
    !elem.closest("[data-cui-datetime-input]")
  );
};

export const scrapeFields = (
  initFormElement: HTMLElement | null,
  isSubform: boolean,
  formState: any,
) => {
  const formElement =
    initFormElement ||
    (document.querySelector(`[data-scribe-form="true"]`) as HTMLElement);
  if (!formElement || !isVisible(formElement, isSubform))
    throw Error(
      'Cannot find a scribeable form. Make sure to mark forms with the "data-scribe-form" attribute',
    );
  const structuredElements = [
    ...formElement.querySelectorAll("[data-structured-input]"),
  ] as HTMLInputElement[];
  const inputElements = [
    ...formElement.querySelectorAll(
      'input:not([type="submit"]):not([role="combobox"]):not([data-scribe-structured-input="true"])',
    ),
  ].filter((ele) =>
    isVisible(ele as HTMLElement, isSubform),
  ) as HTMLInputElement[];
  const textAreaElements = [...formElement.querySelectorAll("textarea")].filter(
    (ele) => isVisible(ele as HTMLElement, isSubform),
  ) as HTMLTextAreaElement[];
  const selectElements = [...formElement.querySelectorAll(`select`)].filter(
    (ele) => isVisible(ele as HTMLElement, isSubform),
  ) as HTMLSelectElement[];
  // Care UI (Headless UI) does not use the traditional <select> field for dropdowns.
  const careUISelectElements = [
    ...formElement.querySelectorAll(`[data-cui-listbox]`),
  ].filter((ele) => isVisible(ele as HTMLElement, isSubform));
  const careUIDateElements = [
    ...formElement.querySelectorAll(`[data-cui-dateinput]`),
  ].filter((ele) => isVisible(ele as HTMLElement, isSubform));
  const careUIDateTimeElements = [
    ...formElement.querySelectorAll(`[data-cui-datetime-input]`),
  ];
  const careUICheckBoxElements = [
    ...formElement.querySelectorAll(`[data-cui-checkbox="true"]`),
  ].filter((ele) =>
    isVisible(ele as HTMLElement, isSubform),
  ) as HTMLButtonElement[];

  // temp disable subforms
  // const subFormElements = scrapeSubForms(formElement);

  const getInputType: (t: string | null) => ScribeField["type"] = (
    type: string | null,
  ) =>
    type &&
    [
      "string",
      "number",
      "date",
      "datetime-local",
      "radio",
      "checkbox",
    ].includes(type)
      ? (type as ScribeField["type"])
      : "string";

  const structuredInputs = structuredElements
    .map((ele) => {
      const inputType = ele.getAttribute("data-structured-input") as
        | keyof typeof STRUCTURED_INPUT_PROMPTS
        | null;
      if (!inputType) return;
      const mapping = STRUCTURED_INPUT_PROMPTS[inputType];
      const questionId = ele.getAttribute("data-structured-input-id");
      const currentValue = formState
        .find((qn: any) =>
          qn.responses.some(
            (response: any) => response.question_id === questionId,
          ),
        )
        ?.responses.find((response: any) => response.question_id === questionId)
        ?.values?.[0]?.value;

      return {
        type: "structured-input",
        fieldElement: ele,
        label: mapping.name,
        value: JSON.stringify(currentValue || null),
        customPrompt: mapping.prompt,
        customExample: JSON.stringify(mapping.example),
      };
    })
    .filter((i) => !!i) as ScribeField[];

  const inputs: ScribeField[] = inputElements
    .filter(
      (ele) => !["radio", "checkbox"].includes(ele.getAttribute("type") || ""),
    )
    .map((ele) => ({
      type: getInputType(ele.getAttribute("type")),
      fieldElement: ele,
      label:
        ele.labels?.[0]?.innerText ||
        (ele.previousElementSibling?.tagName === "LABEL" &&
          ele.previousElementSibling.textContent?.trim()) ||
        ele.name ||
        "",
      value: ele.value,
    }));

  const checkBoxesAndRadios: ScribeField[] = Array.from(
    new Map(
      inputElements
        .filter((ele) =>
          ["radio", "checkbox"].includes(ele.getAttribute("type") || ""),
        )
        .map((ele) => [
          ele.getAttribute("name"), // use the `name` attribute as the key
          {
            type: getInputType(ele.getAttribute("type")),
            fieldElement: ele.parentElement?.parentElement || ele,
            label:
              (
                document.querySelector(
                  `label[for=${ele.getAttribute("name")}]`,
                ) as HTMLLabelElement
              )?.innerText || "",
            options: [
              ...(document.querySelectorAll(
                `input[name=${ele.getAttribute("name")}]`,
              ) as NodeListOf<HTMLInputElement>),
            ].map((inp) => ({
              text: (
                document.querySelector(
                  `label[for="${inp.id}"]`,
                ) as HTMLLabelElement
              ).innerText,
              value: inp.value,
            })),
            value:
              [
                ...(document.querySelectorAll(
                  `input[name=${ele.getAttribute("name")}]`,
                ) as NodeListOf<HTMLInputElement>),
              ].find((radio) => radio.checked)?.value || null,
          },
        ]),
    ).values(),
  );

  const cuiCheckBoxes: ScribeField[] = careUICheckBoxElements.map((ele) => ({
    type: "cui-checkbox",
    fieldElement: ele,
    label:
      ele.labels?.[0]?.innerText ||
      (ele.previousElementSibling?.tagName === "LABEL" &&
        ele.previousElementSibling.textContent?.trim()) ||
      (ele.nextElementSibling?.tagName === "LABEL" &&
        ele.nextElementSibling.textContent?.trim()) ||
      "",
    value: ele.getAttribute("data-cui-checked") || "false",
    customPrompt: ele.getAttribute("data-scribe-prompt") || undefined,
    customExample: ele.getAttribute("data-scribe-example") || undefined,
  }));

  const textareas: ScribeField[] = textAreaElements.map((ele) => ({
    type: "string",
    fieldElement: ele,
    label:
      ele.labels?.[0]?.innerText ||
      (ele.previousElementSibling?.tagName === "LABEL" &&
        ele.previousElementSibling.textContent?.trim()) ||
      "",
    value: ele.value,
    customPrompt: ele.getAttribute("data-scribe-prompt") || undefined,
    customExample: ele.getAttribute("data-scribe-example") || undefined,
  }));

  const selects: ScribeField[] = selectElements.map((ele) => ({
    type: "select",
    fieldElement: ele,
    label:
      ele.labels?.[0]?.innerText ||
      (ele.previousElementSibling?.tagName === "LABEL" &&
        ele.previousElementSibling.textContent?.trim()) ||
      "",
    options: [...ele.querySelectorAll("option")].map((option) => ({
      value: option?.value || "",
      text: option?.innerText,
    })),
    value: ele.value,
    customPrompt: ele.getAttribute("data-scribe-prompt") || undefined,
    customExample: ele.getAttribute("data-scribe-example") || undefined,
  }));

  const cuiSelects: ScribeField[] = careUISelectElements.map((ele) => ({
    type: Array.isArray(
      JSON.parse(ele.getAttribute("data-cui-listbox-value") || `""`),
    )
      ? "cui-multi-select"
      : "cui-select",
    fieldElement: ele,
    label:
      (ele.previousElementSibling?.tagName === "LABEL" &&
        ele.previousElementSibling.textContent?.trim()) ||
      ele.id,
    options: (
      JSON.parse(ele.getAttribute("data-cui-listbox-options") || "[]") as [
        string,
        string,
      ][]
    ).map(([value, text]) => ({ text, value })),
    value: JSON.parse(ele.getAttribute("data-cui-listbox-value") || `""`),
    customPrompt: ele.getAttribute("data-scribe-prompt") || undefined,
    customExample: ele.getAttribute("data-scribe-example") || undefined,
  }));

  const cuiDateInput: ScribeField[] = careUIDateElements.map((ele) => ({
    type: "cui-date",
    fieldElement: ele,
    label:
      (
        ele.parentElement?.parentElement?.parentElement?.querySelector(
          "label",
        ) as HTMLLabelElement
      )?.innerText ||
      ele.querySelector("input[readonly]")?.id ||
      "",
    value: JSON.parse(ele.getAttribute("data-cui-dateinput-value") || `""`),
    customPrompt: ele.getAttribute("data-scribe-prompt") || undefined,
    customExample: ele.getAttribute("data-scribe-example") || undefined,
  }));

  const cuiDateTimeInput: ScribeField[] = careUIDateTimeElements.map((ele) => ({
    type: "cui-datetime",
    fieldElement: ele,
    label:
      (ele.previousElementSibling?.tagName === "LABEL" &&
        ele.previousElementSibling.textContent?.trim()) ||
      ele.id,
    value: JSON.parse(ele.getAttribute("data-injected-value") || `""`),
    customPrompt: ele.getAttribute("data-scribe-prompt") || undefined,
    customExample: ele.getAttribute("data-scribe-example") || undefined,
  }));

  // const subForms: ScribeField[] = subFormElements.map((form) => ({
  //   type: "sub-form",
  //   fieldElement: form.element,
  //   label: form.label,
  //   value: JSON.stringify(
  //     form.entries.map((row, id) => ({
  //       id,
  //       action: "NONE",
  //       fields: row.map((field) => ({ [field.label]: field.value })),
  //     })),
  //   ),
  //   customPrompt: `A complex array of objects.
  //       If there are any additions to the field, please add to the array in the following example format:
  //       ${JSON.stringify({ id: null, action: "ADD", fields: form.creator.map((field) => ({ [field.label]: field.options ? (field.type === "cui-multi-select" ? [field.options[0].value, field.options[1].value] : field.options[0].value) : SCRIBE_PROMPT_MAP[field.type]?.example })) })}.
  //       ${
  //         form.creator.filter((f) => f.options).length
  //           ? `
  //       NOTE : Refer to the following as option values for the fields. Make sure you select only the value of the option for the corresponding field.
  //       ${JSON.stringify(form.creator.filter((f) => f.options).map((f) => ({ [f.label]: f.options })))}
  //       `
  //           : ``
  //       }
  //       If a row is being added, action should be "ADD". If an existing row is being updated, action should be "UPDATE", and if the row is being deleted or removed, action should be "DELETE". If there is no action, the action should be "NONE". No other action value is allowed.`,
  //   customExample: `${JSON.stringify({ id: null, action: "ADD", fields: form.creator.map((field) => ({ [field.label]: field.options ? (field.type === "cui-multi-select" ? [field.options[0].value, field.options[1].value] : field.options[0].value) : SCRIBE_PROMPT_MAP[field.type]?.example })) })}.`,
  // }));

  //console.log(subForms[0]?.customPrompt);

  const fields = [
    ...inputs,
    ...textareas,
    ...selects,
    ...cuiSelects,
    ...checkBoxesAndRadios,
    ...cuiDateInput,
    ...cuiDateTimeInput,
    ...structuredInputs,
    ...cuiCheckBoxes,
    //...subForms,
  ];

  return fields;
};

// export const scrapeSubForms = (formElement: HTMLElement) => {
//   const subforms = [
//     ...formElement.querySelectorAll("[data-scribe-subform]"),
//   ] as HTMLElement[];
//   const subformsData = subforms.map((form) => ({
//     element: form,
//     label: form.getAttribute("data-scribe-subform") || "Sub Form",
//     entries: (
//       [
//         ...form.querySelectorAll(`[data-scribe-subform-entry="true"]`),
//       ] as HTMLElement[]
//     ).map((entry) => scrapeFields(entry, true)),
//     creator: scrapeFields(
//       form.querySelector(`[data-scribe-subform-creator="true"]`) as HTMLElement,
//       true,
//     ),
//   }));
//   return subformsData;
// };

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
  if (field.type === "sub-form") {
    return <div className="italic text-gray-200">Multiple Updates</div>;
  }
  if (field.type === "structured-input") {
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
  switch (field.type) {
    case "cui-select":
    case "cui-multi-select":
      element.setAttribute("data-cui-listbox-value", JSON.stringify(val || ""));
      break;

    case "cui-date":
      element.setAttribute(
        "data-cui-dateinput-value",
        JSON.stringify(val || ""),
      );
      break;

    case "radio":
    case "checkbox":
      const toCheck = element.querySelector(
        `input[value=${val || "__NULL__"}]`,
      ) as HTMLInputElement;
      element.querySelectorAll(`input`).forEach((e) => {
        const descriptor = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype,
          "checked",
        );

        if (descriptor?.set) {
          descriptor.set.call(e, toCheck.value === e.value);
          e.dispatchEvent(new Event("change", { bubbles: true }));
          toCheck.value === e.value && e.click();
        }
      });
      break;
    case "cui-checkbox":
      element.setAttribute("data-cui-checked", val);
      break;

    case "cui-datetime":
      element.setAttribute("data-injected-value", JSON.stringify(val));
      break;
    case "structured-input":
      //element.setAttribute("data-injected-value", val);
      const qId = element.getAttribute("data-structured-input-id");
      // Going forward, we need to remove structured inputs in favor of sub-forms.
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
      break;
    default:
      const input = field.fieldElement as
        | HTMLInputElement
        | HTMLTextAreaElement;
      // input.value = x won't do the trick as it will just update the DOM value, and not trigger the onChange for the state to update.
      const descriptor = Object.getOwnPropertyDescriptor(
        Object.getPrototypeOf(element),
        "value",
      );
      if (descriptor?.set) {
        descriptor.set.call(input, val as string);
        input.dispatchEvent(new Event("input", { bubbles: true }));
      }
  }
};

// const getSubFormValues = (value?: string) => {
//   try {
//     const values: {
//       id: null | number;
//       action: "ADD" | "UPDATE" | "DELETE" | "NONE";
//       fields: unknown;
//     }[] = JSON.parse(value || "[]");
//     return {
//       updated: values.filter((v) => v.action === "UPDATE"),
//       deleted: values.filter((v) => v.action === "DELETE"),
//       added: values.filter((v) => v.action === "ADD"),
//       all: values,
//     };
//   } catch (error) {
//     console.error("Could not parse sub form data from scribe response");
//   }
// };

export const previewFieldUpdate = (field: ScribeFieldSuggestion) => {
  switch (field.type) {
    case "sub-form":
      //console.log(field.newValue);
      // const newFields = getSubFormValues(field.newValue as string);
      //console.log(newFields);

      // TODO: Update styling to reflect changes
      // entries.forEach((entry, i) => {
      //     const updatedEntry = value.find(v => v.id === i);
      //     entry.style.background = updatedEntry?.action === 'DELETE' ? "red" : updatedEntry?.action === "UPDATE" ? "yellow" : ""
      // })
      // console.log(updatedRows, deletedRows, addedRows);

      break;
  }
};

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
