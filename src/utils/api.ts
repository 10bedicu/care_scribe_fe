import {
  CreateFileRequest,
  CreateFileResponse,
  FacilityModel,
  FileUploadModel,
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

const CARE_BASE_URL = import.meta.env.VITE_CARE_API_URL || "";
const CARE_ACCESS_TOKEN_LOCAL_STORAGE_KEY = "care_access_token";

const request = async <T extends unknown>(
  endpoint: string,
  method: methods = "GET",
  data: any = {},
  options: options = {},
): Promise<T> => {
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
    create: (req: Partial<ScribeModel>) =>
      request<ScribeModel>("/api/care_scribe/scribe/", "POST", req),
    get: (scribeId: string) =>
      request<ScribeModel>(`/api/care_scribe/scribe/${scribeId}/`),
    update: (scribeId: string, data: Partial<ScribeModel>) =>
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
    current: () => request<UserModel>(`/api/v1/users/getcurrentuser/`)
  }
};
