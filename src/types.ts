export type FeatureFlag = "SCRIBE_ENABLED"; // "HCX_ENABLED" | "ABDM_ENABLED" |

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

export type ScribeModel = {
    external_id: string;
    requested_by: UserModel;
    form_data: {
        friendlyName: string;
        default: string;
        description: string;
        example: string;
        id: string;
        options?: any[];
        type: string;
    }[];
    transcript: string;
    ai_response: string;
    status:
    | "CREATED"
    | "READY"
    | "GENERATING_TRANSCRIPT"
    | "GENERATING_AI_RESPONSE"
    | "COMPLETED"
    | "FAILED";
    system_prompt?: string;
    json_prompt?: string;
};

export type ScribeStatus =
    | "FAILED"
    | "IDLE"
    | "RECORDING"
    | "UPLOADING"
    | "TRANSCRIBING"
    | "THINKING"
    | "REVIEWING"
    | "SCRIBING";

export type ScribeFieldOption = {
    value: string,
    text: string
}

export type ScribeField = {
    type: QuestionType,
    fieldElement: Element,
    label: string;
    options?: ScribeFieldOption[];
    value: string | null;
    customPrompt?: string,
    customExample?: string
}

export type ScribeAIResponse = {
    [field_number: number]: unknown
}

export type ScribePromptMap = {
    [key in QuestionType | "default"]?: { prompt: string; example: unknown };
}

export type ScribeFieldSuggestion = ScribeField & { newValue: unknown }

export type ScribeFieldReviewedSuggestion = ScribeFieldSuggestion & { suggestionIndex: number, approved?: boolean }

export type FileCategory = "UNSPECIFIED" | "XRAY" | "AUDIO" | "IDENTITY_PROOF";

export interface CreateFileRequest {
    file_type: string | number;
    file_category: FileCategory;
    name: string;
    associating_id: string;
    original_name: string;
    mime_type: string;
}

export interface CreateFileResponse {
    id: string;
    file_type: string;
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
    facility_flags?: FeatureFlag[];
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
    structured_type?: string;
    answer_option?: { value: string }[];
    text: string;
    required?: boolean;
    type: QuestionType
    [key: string]: unknown;
}