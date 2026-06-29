import {
  Code,
  CreateFileRequest,
  CreateFileResponse,
  FacilityModel,
  FileUploadModel,
  ScribeCreateRequest,
  ScribeFileModel,
  ScribeModel,
  ScribeQuota,
  ScribeQuotaCreateRequest,
  ScribeQuotaFilter,
  UserBareMinimum,
  ValueSetDefinition,
} from "../types";

type methods = "POST" | "GET" | "PATCH" | "DELETE" | "PUT";

type options = {
  formdata?: boolean;
  external?: boolean;
  headers?: any;
  auth?: boolean;
};
const CARE_ACCESS_TOKEN_LOCAL_STORAGE_KEY = "care_access_token";

const request = async <T>(
  endpoint: string,
  method: methods = "GET",
  data: any = {},
  options: options = {},
): Promise<T> => {
  const CARE_BASE_URL = window.CARE_API_URL;

  const { formdata, external, headers, auth: isAuth } = options;

  let url = external ? endpoint : CARE_BASE_URL + endpoint;
  let payload: null | string = formdata ? data : JSON.stringify(data);

  if (method === "GET") {
    const requestParams = data
      ? `?${Object.keys(data)
          .filter((key) => data[key] !== null && data[key] !== undefined)
          .map((key) => `${key}=${data[key]}`)
          .join("&")}`
      : "";
    url += requestParams;
    payload = null;
  }

  const localToken = localStorage.getItem(CARE_ACCESS_TOKEN_LOCAL_STORAGE_KEY);

  const auth =
    isAuth === false || typeof localToken === "undefined" || localToken === null
      ? ""
      : "Bearer " + localToken;

  const response = await fetch(url, {
    method: method,
    headers: external
      ? { ...headers }
      : {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: auth,
          ...headers,
        },
    body: payload,
  });
  try {
    const txt = await response.clone().text();
    if (txt === "") {
      return {} as any;
    }
    const json = await response.clone().json();
    if (json && response.ok) {
      return json;
    } else {
      throw json;
    }
  } catch (error) {
    throw { error };
  }
};

export const API = {
  scribe: {
    list: (
      filters: {
        ordering?: string;
        status?: string;
        encounter_id?: string;
        patient?: string;
        facility?: string;
        benchmark?: boolean;
        transcript_only?: boolean;
        offset?: number;
        limit?: number;
      } = {},
    ) =>
      request<{
        next: string | null;
        previous: string | null;
        results: ScribeModel[];
        count: number;
      }>("/api/care_scribe/scribe/", "GET", filters),
    create: (req: ScribeCreateRequest) =>
      request<ScribeModel>("/api/care_scribe/scribe/", "POST", req),
    get: (scribeId: string) =>
      request<ScribeModel>(`/api/care_scribe/scribe/${scribeId}/`),
    update: (scribeId: string, data: ScribeCreateRequest) =>
      request<ScribeModel>(`/api/care_scribe/scribe/${scribeId}/`, "PUT", data),
    createFileUpload: (data: CreateFileRequest) =>
      request<CreateFileResponse>(
        "/api/care_scribe/scribe_file/",
        "POST",
        data,
      ),
    editFileUpload: (
      id: string,
      fileType: string,
      associatingId: string,
      data: Partial<FileUploadModel>,
    ) =>
      request<FileUploadModel>(
        `/api/care_scribe/scribe_file/${id}/?file_type=${fileType}&associating_id=${associatingId}`,
        "PATCH",
        data,
      ),
  },
  facilities: {
    getPermitted: (facilityId: string) =>
      request<FacilityModel>(`/api/v1/facility/${facilityId}/`),
    all: (filters: { search_text?: string; offset?: number; limit?: number }) =>
      request<{
        next: string | null;
        previous: string | null;
        results: FacilityModel[];
        count: number;
      }>(`/api/v1/getallfacilities/`, "GET", filters),
  },
  users: {
    current: () => request<UserBareMinimum>(`/api/v1/users/getcurrentuser/`),
  },
  valuesets: {
    get: (slug: string) =>
      request<ValueSetDefinition>(`/api/v1/valueset/${slug}/`),
    expand: (system: string, query: string, count: number = 10) =>
      request<{
        results: (Code & {
          designation: {
            language: string;
            use?: Code;
            value: string;
          }[];
        })[];
      }>(`/api/v1/valueset/${system}/expand/`, "POST", {
        search: query,
        count,
      }),
  },
  activityDefinitions: {
    list: (
      facilityId: string,
      filters: { title?: string; limit?: number } = {},
    ) =>
      request<{
        next: string | null;
        previous: string | null;
        results: {
          id: string;
          slug: string;
          title: string;
          classification: string;
          code: Code;
          body_site: Code | null;
        }[];
        count: number;
      }>(`/api/v1/facility/${facilityId}/activity_definition/`, "GET", filters),
  },
  facilityUsers: {
    list: (
      facilityId: string,
      filters: { search_text?: string; limit?: number } = {},
    ) =>
      request<{
        next: string | null;
        previous: string | null;
        results: UserBareMinimum[];
        count: number;
      }>(`/api/v1/facility/${facilityId}/users/`, "GET", filters),
  },
  files: {
    get: (fileId: string, fileType: string, associatingId: string) =>
      request<ScribeFileModel>(
        `/api/care_scribe/scribe_file/${fileId}/`,
        "GET",
        {
          file_type: fileType,
          associating_id: associatingId,
        },
      ),
  },
  quotas: {
    list: (filters: ScribeQuotaFilter) =>
      request<{
        next: string | null;
        previous: string | null;
        results: ScribeQuota[];
        count: number;
      }>(`/api/care_scribe/quota/`, "GET", filters),
    get: (id: string) =>
      request<ScribeQuota>(`/api/care_scribe/quota/${id}/`, "GET"),
    create: (data: ScribeQuotaCreateRequest) =>
      request<ScribeQuota>(`/api/care_scribe/quota/`, "POST", data),
    update: (id: string, data: Partial<ScribeQuotaCreateRequest>) =>
      request<ScribeQuota>(`/api/care_scribe/quota/${id}/`, "PATCH", data),
    delete: (id: string) =>
      request<void>(`/api/care_scribe/quota/${id}/`, "DELETE"),
    myQuota: (facility_id?: string) =>
      request<{
        quotas: ScribeQuota[];
        tnc: string;
        tnc_accepted: boolean;
      }>(`/api/care_scribe/quota/my-quota/`, "GET", {
        facility_id,
      }),
    acceptTnc: (facilityId: string) =>
      request<void>(`/api/care_scribe/quota/accept-tnc/`, "POST", {
        facility_id: facilityId,
      }),
  },
};
