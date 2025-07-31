import STRUCTURES from "./utils/structures";
import { JsonSchema7AnyType } from "zod-to-json-schema";

export type FeatureFlag =
  | "SCRIBE_ENABLED"
  | "SCRIBE_OCR_ENABLED"
  | "SCRIBE_ADMIN";

export type UserBareMinimum = {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  user_type: unknown;
  last_login: string | undefined;
  read_profile_picture_url?: string;
  external_id: string;
};

export type GenderType = "Male" | "Female" | "Transgender";

export const SCRIBE_STATUS = [
  "CREATED",
  "READY",
  "GENERATING_TRANSCRIPT",
  "GENERATING_AI_RESPONSE",
  "COMPLETED",
  "REFUSED",
  "FAILED",
] as const;

export type UserModel = UserBareMinimum & {
  external_id: string;
  local_body?: number;
  district?: number;
  state?: number;
  video_connect_link: string;
  phone_number?: string;
  alt_phone_number?: string;
  gender?: GenderType;
  read_profile_picture_url?: string;
  date_of_birth: Date | null | string;
  is_superuser?: boolean;
  verified?: boolean;
  home_facility?: string;
  qualification?: string;
  doctor_experience_commenced_on?: string;
  doctor_medical_council_registration?: string;
  weekly_working_hours?: string | null;
  user_flags?: FeatureFlag[];
};

export type ScribeHydratedField = {
  friendlyName: string;
  humanValue: string;
  description?: string;
  id: string;
  options?: (string | number)[];
  type: string;
  structuredType?: keyof typeof STRUCTURES;
  current: unknown;
  schema?: JsonSchema7AnyType;
};

export type ScribeHydratedAndRawField = ScribeHydratedField & ScribeField;

export type ScribeHydratedQuestionnaire<T extends ScribeHydratedField> = {
  title: string;
  description: string;
  fields: (T | ScribeHydratedQuestionnaire<T>)[];
};

export type ScribeModel = {
  external_id: string;
  requested_by: UserModel;
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
  ai_response: {
    __scribe__transcription: string;
    [key: string]: unknown;
  } | null;
  status: (typeof SCRIBE_STATUS)[number];
  realtime_token: string | null;
  prompt?: string;
  meta: {
    provider?: string;
    iterations?: {
      transcription_time?: number;
      completion_output_tokens?: number;
      completion_input_tokens?: number;
      completion_cached_tokens?: number;
      completion_time?: number;
      completion_id?: string;
      prompt?: string;
      function?: Record<string, unknown>;
      output?: {
        [key: string]: unknown;
      };
    }[];
    processed_ai_response?: {
      successful: ScribeAIResponse;
      failed: {
        [field_id: string]: string[];
      };
    };
    chat_model?: string;
    audio_model?: string;
    error?: string;
  };
  is_feedback_positive: boolean | null;
  feedback_comments: string | null;
  created_date: string;
  modified_date: string;
  audio: ScribeFileModel[];
  documents: ScribeFileModel[];
};

export type ScribeCreateRequest = {
  status?: ScribeModel["status"];
  form_data?: ScribeModel["form_data"];
  requested_in_facility_id?: string;
  requested_in_encounter_id?: string;
  transcript?: ScribeModel["transcript"];
  processed_ai_response?: ScribeModel["meta"]["processed_ai_response"];
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

export type ScribeQuestionnaire = {
  title: string;
  description: string;
  questions: (ScribeField | ScribeQuestionnaire)[];
};

export type ScribeField = {
  question: FormQuestion;
  value: unknown | null;
  note?: string;
};

export type ScribeAIResponse = {
  [field_id: string]: {
    value: unknown;
    note?: string;
  };
};

export type ScribeFieldSuggestion = ScribeHydratedAndRawField & {
  newValue: unknown;
  newNote?: string;
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
  flags?: FeatureFlag[];
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
  user: UserModel;
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
  allow_ocr?: boolean;
  ordering?: string;
  offset?: number;
  limit?: number;
};
