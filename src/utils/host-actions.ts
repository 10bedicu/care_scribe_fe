import dayjs from "dayjs";
import {
  FormQuestion,
  HostActionDescriptor,
  HostActionResult,
  HostInvoke,
  ScribeDeseriliazedValue,
  ScribeField,
  ScribeFieldSuggestion,
  ScribeQuestionnaire,
} from "@/types";
import STRUCTURES from "./structures";

/**
 * Adapter between Scribe and care_fe's host actions. care_fe no longer hands
 * plugins the raw questionnaire state: Scribe reads the open forms through
 * `questionnaire.forms.list` and writes each answer through
 * `questionnaire.response.set`, which the host validates.
 */
export const LIST_FORMS_ACTION = "questionnaire.forms.list";
export const SET_RESPONSE_ACTION = "questionnaire.response.set";

// Clinical lists the host merges row by row instead of replacing.
const MERGED_STRUCTURED_TYPES = ["diagnosis", "symptom", "allergy_intolerance"];

interface HostQuestion {
  id: string;
  link_id: string;
  text: string;
  type: string;
  description?: string;
  group_path?: string[];
  row_path?: number[];
  structured_type?: string;
  values?: unknown[];
  note?: string;
  required: boolean;
  options?: string[];
  answer_value_set?: { slug?: string; external_id?: string };
  unit?: FormQuestion["unit"];
  repeats?: boolean;
  ancestors_enabled: boolean;
}

interface HostForm {
  questionnaire_id: string;
  title: string;
  questions: HostQuestion[];
}

export function supportsFormActions(actions?: HostActionDescriptor[]) {
  const ids = new Set(actions?.map((action) => action.id));
  return ids.has(LIST_FORMS_ACTION) && ids.has(SET_RESPONSE_ACTION);
}

function fieldId(question: HostQuestion) {
  return question.row_path?.length
    ? `${question.id}__row_${question.row_path.join("_")}`
    : question.id;
}

/** Host answers in the shapes Scribe prompts with and compares against. */
function toScribeValue(question: HostQuestion): ScribeDeseriliazedValue {
  const values = question.values ?? [];
  if (question.type === "structured") {
    return (values.length ? values : null) as ScribeDeseriliazedValue;
  }
  const convert = (value: unknown): unknown => {
    if (value instanceof Date) {
      return question.type === "date"
        ? dayjs(value).format("YYYY-MM-DD")
        : dayjs(value).format("YYYY-MM-DDTHH:mm");
    }
    if (
      question.type === "quantity" &&
      !question.answer_value_set &&
      value &&
      typeof value === "object"
    ) {
      // The "Type" coding only matters for value-set-backed quantities.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { coding: _coding, ...rest } = value as Record<string, unknown>;
      return rest;
    }
    return value;
  };
  const converted = values
    .map(convert)
    .filter((value) => value !== null && value !== undefined);
  if (question.repeats) return converted as ScribeDeseriliazedValue;
  return (converted[0] ?? null) as ScribeDeseriliazedValue;
}

function toFormQuestion(
  question: HostQuestion,
  questionnaireId: string,
): FormQuestion {
  const rows = question.row_path ?? [];
  const isLaterRow = rows.some((row) => row > 0);
  return {
    id: fieldId(question),
    link_id: question.link_id,
    questionnaire_id: questionnaireId,
    row_path: question.row_path,
    dom_id: question.id,
    text: isLaterRow
      ? `${question.text} (entry ${rows.map((row) => row + 1).join(".")})`
      : question.text,
    description: question.description,
    type: question.type as FormQuestion["type"],
    structured_type:
      question.structured_type as FormQuestion["structured_type"],
    required: question.required,
    repeats: question.repeats,
    answer_option: question.options?.map((value) => ({ value })),
    answer_value_set:
      question.answer_value_set?.external_id ?? question.answer_value_set?.slug,
    unit: question.unit,
  };
}

/** Rebuilds the questionnaires' group nesting from each question's
 *  `group_path`, so prompts keep their section context. */
function toScribeQuestionnaire(form: HostForm): ScribeQuestionnaire {
  const root: ScribeQuestionnaire = {
    title: form.title,
    description: "",
    questions: [],
  };
  for (const question of form.questions) {
    if (!question.ancestors_enabled || question.type === "display") continue;
    if (
      question.structured_type &&
      !Object.keys(STRUCTURES).includes(question.structured_type)
    ) {
      continue;
    }
    let parent = root;
    for (const title of question.group_path ?? []) {
      const last = parent.questions[parent.questions.length - 1];
      if (last && "questions" in last && last.title === title) {
        parent = last;
        continue;
      }
      const group: ScribeQuestionnaire = {
        title,
        description: "",
        questions: [],
      };
      parent.questions.push(group);
      parent = group;
    }
    const field: ScribeField = {
      question: toFormQuestion(question, form.questionnaire_id),
      value: toScribeValue(question),
      note: question.note,
    };
    parent.questions.push(field);
  }
  return root;
}

/** The open forms as Scribe's question inputs. */
export async function readQuestionInputs(
  invoke: HostInvoke,
): Promise<ScribeQuestionnaire[]> {
  const result = await invoke(LIST_FORMS_ACTION, {});
  if (!result.ok) throw new Error(result.error);
  return (result.data as HostForm[])
    .map(toScribeQuestionnaire)
    .filter((questionnaire) => questionnaire.questions.length > 0);
}

const isBlank = (value: unknown) =>
  value === null || value === undefined || value === "";

const toArray = (value: unknown): unknown[] =>
  Array.isArray(value) ? value : isBlank(value) ? [] : [value];

/**
 * Writes a reviewed field back to the form: its suggestion when
 * `useNewValue`, otherwise the value it had before Scribe ran.
 */
export async function writeFieldValue(
  invoke: HostInvoke,
  field: Pick<
    ScribeFieldSuggestion,
    "question" | "value" | "note" | "newValue" | "newNote"
  >,
  useNewValue: boolean,
): Promise<HostActionResult> {
  const { question } = field;
  const value = useNewValue ? field.newValue : field.value;
  // Reverting clears a note Scribe added where there was none.
  const note = useNewValue
    ? field.newNote
    : (field.note ?? (field.newNote ? "" : undefined));
  if (!question.link_id) return { ok: false, error: "Unknown question" };

  let values: unknown[];
  let pruneUnsaved = false;
  if (question.structured_type) {
    // Rows cross a JSON-validated boundary: drop `undefined` keys.
    const rows = JSON.parse(JSON.stringify(toArray(value))) as Record<
      string,
      unknown
    >[];
    if (MERGED_STRUCTURED_TYPES.includes(question.structured_type)) {
      // The host merges these lists and validates every row it is sent, so
      // send only rows Scribe added. Reverting resends the rows that were
      // unsaved before and drops the rest of the unsaved ones; saved
      // records are never touched.
      if (useNewValue) {
        const previous = new Set(
          toArray(field.value).map((row) => JSON.stringify(row)),
        );
        values = rows.filter((row) => !previous.has(JSON.stringify(row)));
      } else {
        values = rows.filter((row) => !row.id);
        pruneUnsaved = true;
      }
    } else {
      values = rows;
    }
  } else if (question.type === "quantity") {
    values = toArray(value).filter(
      (entry) =>
        !!entry &&
        typeof entry === "object" &&
        !isBlank((entry as { value?: unknown }).value),
    );
  } else {
    values = toArray(value);
  }

  return invoke(SET_RESPONSE_ACTION, {
    questionnaire_id: question.questionnaire_id,
    link_id: question.link_id,
    ...(question.row_path?.length ? { row_path: question.row_path } : {}),
    values,
    ...(note !== null && note !== undefined ? { note } : {}),
    ...(pruneUnsaved ? { prune_unsaved: true } : {}),
  });
}

function flattenFields(questionnaires: ScribeQuestionnaire[]): ScribeField[] {
  return questionnaires.flatMap((questionnaire) =>
    questionnaire.questions.flatMap((item) =>
      "questions" in item ? flattenFields([item]) : [item],
    ),
  );
}

/**
 * Puts every field Scribe changed back to its value in `snapshot`, a read
 * taken before Scribe wrote anything. Fields that no longer exist, or that
 * the host refuses to write, are left as they are.
 */
export async function restoreSnapshot(
  invoke: HostInvoke,
  snapshot: ScribeQuestionnaire[],
) {
  const current = new Map(
    flattenFields(await readQuestionInputs(invoke)).map((field) => [
      field.question.id,
      field,
    ]),
  );
  for (const original of flattenFields(snapshot)) {
    const now = current.get(original.question.id);
    if (
      !now ||
      (JSON.stringify(now.value) === JSON.stringify(original.value) &&
        (now.note ?? "") === (original.note ?? ""))
    ) {
      continue;
    }
    const result = await writeFieldValue(
      invoke,
      {
        question: original.question,
        value: original.value,
        note: original.note,
        newValue: now.value as ScribeFieldSuggestion["newValue"],
        newNote: now.note ?? null,
      },
      false,
    );
    if (!result.ok) {
      console.warn(`Could not restore ${original.question.text}`, result.error);
    }
  }
}
