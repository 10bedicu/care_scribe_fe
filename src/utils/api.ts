import {
  Code,
  CreateFileRequest,
  CreateFileResponse,
  FacilityModel,
  FileUploadModel,
  ScribeCreateRequest,
  ScribeFileModel,
  ScribeModel,
  UserModel,
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
    list: (filters: { offset?: number; limit?: number } = {}) =>
      request<{ results: ScribeModel[]; count: number }>(
        "/api/care_scribe/scribe/",
        "GET",
        filters,
      ),
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
  },
  users: {
    current: () => request<UserModel>(`/api/v1/users/getcurrentuser/`),
  },
  valuesets: {
    expand: (system: string, query: string) =>
      request<{ results: Code[] }>(
        `/api/v1/valueset/${system}/expand/`,
        "POST",
        {
          search: query,
          count: 10,
        },
      ),
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
};
