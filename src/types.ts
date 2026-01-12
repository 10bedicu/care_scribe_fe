import { z } from "zod";
import STRUCTURES, { arbitraryStructures } from "./utils/structures";
import { JsonSchema7AnyType } from "zod-to-json-schema";
import { cleanAIResponse } from "./utils/response-utils";

export type UserBareMinimum = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  read_profile_picture_url?: string;
  external_id: string;
  is_superuser: boolean;
};

export const SCRIBE_STATUS = [
  "CREATED",
  "READY",
  "GENERATING_TRANSCRIPT",
  "GENERATING_AI_RESPONSE",
  "COMPLETED",
  "REFUSED",
  "FAILED",
] as const;

export type ScribeHydratedField = {
  friendlyName: string;
  humanValue: string;
  description?: string;
  id: string;
  options?: (string | number)[];
  type: string;
  structuredType?: keyof typeof STRUCTURES;
  current: ScribeDeseriliazedValue | null;
  schema?: JsonSchema7AnyType;
};

export type ScribeValue =
  | z.infer<(typeof STRUCTURES)[keyof typeof STRUCTURES]["toolStructure"]>
  | {
      value:
        | (
            | z.infer<
                (typeof arbitraryStructures)[keyof typeof arbitraryStructures]
              >
            | z.infer<
                (typeof arbitraryStructures)[keyof typeof arbitraryStructures]
              >[]
          )
        | null;
      note: string | null;
    };

export type ScribeDeseriliazedValue =
  | Awaited<
      ReturnType<(typeof STRUCTURES)[keyof typeof STRUCTURES]["deserialize"]>
    >["data"]
  | z.infer<(typeof arbitraryStructures)[keyof typeof arbitraryStructures]>
  | z.infer<(typeof arbitraryStructures)[keyof typeof arbitraryStructures]>[]
  | null;

export type ScribeHydratedAndRawField = ScribeHydratedField & ScribeField;

export type ScribeHydratedQuestionnaire<T extends ScribeHydratedField> = {
  title: string;
  description: string;
  fields: (T | ScribeHydratedQuestionnaire<T>)[];
};

export type ScribeModel = {
  external_id: string;
  requested_by: UserBareMinimum;
  form_data: ScribeHydratedQuestionnaire<ScribeHydratedField>[];
  requested_in_facility: {
    id: FacilityModel["id"];
    name: FacilityModel["name"];
  } | null;
  requested_in_encounter: {
    external_id: string;
    patient: {
      external_id: string;
      name: string;
    };
  } | null;
  transcript: string | null;
  ai_response:
    | ({
        __scribe__transcription: string;
      } & {
        [key: string]: ScribeValue;
      })
    | null;
  status: (typeof SCRIBE_STATUS)[number];
  realtime_token: string | null;
  prompt?: string;
  meta: {
    processings?: ScribeProcessing[];
  };
  is_feedback_positive: boolean | null;
  feedback_comments: string | null;
  created_date: string;
  modified_date: string;
  audio: ScribeFileModel[];
  documents: ScribeFileModel[];
};

export type ScribeProcessing = {
  created_date?: string;
  provider?: string;
  thinking?: string;
  transcription_time?: number;
  completion_output_tokens?: number;
  completion_input_tokens?: number;
  completion_audio_input_tokens?: number;
  completion_image_input_tokens?: number;
  completion_text_input_tokens?: number;
  completion_cached_tokens?: number;
  completion_cached_audio_tokens?: number;
  completion_cached_image_tokens?: number;
  completion_cached_text_tokens?: number;
  completion_thinking_tokens?: number;
  completion_total_tokens?: number;
  completion_time?: number;
  completion_id?: string;
  prompt?: string;
  function?: Record<string, unknown>;
  processed_ai_response?: Awaited<ReturnType<typeof cleanAIResponse>>["meta"];
  ai_response?: ScribeModel["ai_response"];
  form_data?: ScribeModel["form_data"];
  chat_model?: string;
  audio_model?: string;
  error?: string;
};

export type ScribeCreateRequest = {
  status?: ScribeModel["status"];
  form_data?: ScribeModel["form_data"];
  requested_in_facility_id?: string;
  requested_in_encounter_id?: string;
  transcript?: ScribeModel["transcript"];
  processed_ai_response?: ScribeProcessing["processed_ai_response"];
  benchmark?: boolean;
  chat_model?: string;
  audio_model?: string;
  chat_model_temperature?: number;
  is_feedback_positive?: boolean | null;
  feedback_comments?: string | null;
};

export type ScribeStatus =
  | "FAILED"
  | "IDLE"
  | "ATTACHING"
  | "RECORDING"
  | "UPLOADING"
  | "TRANSCRIBING"
  | "THINKING"
  | "REVIEWING"
  | "SCRIBING";

export enum ScribeFileType {
  OTHER = 0,
  AUDIO = 1,
  DOCUMENT = 2,
}

export type ScribeMeta = {
  encounterId: string;
  currentUser: UserBareMinimum;
  currentTime: string;
};

export type ScribeQuestionnaire = {
  title: string;
  description: string;
  questions: (ScribeField | ScribeQuestionnaire)[];
};

export type ScribeField = {
  question: FormQuestion;
  value: ScribeDeseriliazedValue | null;
  note?: string;
};

export type ScribeAIResponse = {
  [field_id: string]: ScribeValue;
};

export type ScribeFieldSuggestion = ScribeHydratedAndRawField & {
  newValue: ScribeDeseriliazedValue;
  newNote: string | null;
};

export type ScribeFieldReviewedSuggestion = ScribeFieldSuggestion & {
  suggestionIndex: number;
  approved?: boolean;
};

export type FileCategory = "UNSPECIFIED" | "XRAY" | "AUDIO" | "IDENTITY_PROOF";

export interface CreateFileRequest {
  file_type: ScribeFileType;
  file_category: FileCategory;
  name: string;
  associating_id: string;
  original_name: string;
  mime_type: string;
  length?: number;
}

export interface CreateFileResponse {
  id: string;
  file_type: ScribeFileType;
  file_category: FileCategory;
  signed_url: string;
  internal_name: string;
}

export interface FileUploadModel {
  id?: string;
  name?: string;
  associating_id?: string;
  created_date?: string;
  upload_completed?: boolean;
  uploaded_by?: UserBareMinimum;
  file_category?: FileCategory;
  read_signed_url?: string;
  is_archived?: boolean;
  archive_reason?: string;
  extension?: string;
  archived_by?: UserBareMinimum;
  archived_datetime?: string;
}

export interface ScribeFileModel {
  id: string;
  name: string;
  upload_completed: boolean;
  read_signed_url: string;
  length: number;
  mime_type: string;
}

export interface FacilityModel {
  id?: string;
  name?: string;
  read_cover_image_url?: string;
  facility_type?: string;
  address?: string;
  features?: number[];
  location?: {
    latitude: number;
    longitude: number;
  };
  phone_number?: string;
  middleware_address?: string;
  modified_date?: string;
  created_date?: string;
  state?: number;
  district?: number;
  local_body?: number;
  ward?: number;
  pincode?: string;
  latitude?: string;
  longitude?: string;
  kasp_empanelled?: boolean;
  patient_count?: number;
  bed_count?: number;
}

export type QuestionType =
  | "group"
  | "display"
  | "boolean"
  | "decimal"
  | "integer"
  | "date"
  | "dateTime"
  | "time"
  | "string"
  | "text"
  | "url"
  | "choice"
  | "quantity"
  | "structured";

export interface FormQuestion {
  id: string;
  structured_type?: keyof typeof STRUCTURES;
  answer_option?: { value: string }[];
  description?: string;
  text: string;
  required?: boolean;
  type: QuestionType;
  repeats?: boolean;
  unit?: {
    code: string;
    system: string;
    display: string;
  };
}

export const VALUESET_SYSTEM_NAMES = {
  "system-allergy-code": "Allergy",
  "system-condition-code": "Condition",
  "system-medication": "Medication",
  "system-additional-instruction": "Additional Instruction",
  "system-administration-method": "Administration Method",
  "system-as-needed-reason": "As Needed Reason",
  "system-body-site": "Body Site",
  "system-route": "Route",
  "system-observation": "Observation",
  "system-body-site-observation": "Body Site Observation",
  "system-collection-method": "Collection Method",
  "system-ucum-units": "UCUM Units",
} as const;

export interface Code {
  system: string;
  code: string;
  display?: string;
}

export type ScribeControllerPosition =
  | "top-left"
  | "top-right"
  | "bottom-left"
  | "bottom-right";

export type ScribeQuota = {
  external_id: string;
  created_date: string;
  modified_date: string;
  user: UserBareMinimum;
  facility: FacilityModel;
  tokens: number;
  tokens_per_user: number;
  used: number;
  allow_ocr: boolean;
  tnc_hash: string | null;
  tnc_accepted_date: string | null;
};

export type ScribeQuotaCreateRequest = {
  facility_external_id?: string;
  tokens: number;
  allow_ocr: boolean;
  tokens_per_user: number;
};

export type ScribeQuotaFilter = {
  facility?: string | null;
  username?: string | null;
  facility_id?: string;
  users?: boolean;
  allow_ocr?: boolean;
  ordering?: string;
  offset?: number;
  limit?: number;
};
