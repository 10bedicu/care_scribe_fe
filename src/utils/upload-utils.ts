import { ScribeFileType } from "@/types";
import { API } from "./api";

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const safeParseJson = (value: string): unknown => {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const uploadFile = (
  url: string,
  file: File | FormData,
  headers: Record<string, string>,
  onLoad: (xhr: XMLHttpRequest) => void,
  onError: (error?: string) => void,
) => {
  const xhr = new XMLHttpRequest();
  xhr.open("PUT", url);

  Object.entries(headers).forEach(([key, value]) => {
    xhr.setRequestHeader(key, value);
  });

  xhr.onload = () => {
    onLoad(xhr);
    if (400 <= xhr.status && xhr.status <= 499) {
      const error = safeParseJson(xhr.responseText ?? "");
      if (isRecord(error)) {
        Object.values(error).forEach((msg) => {
          onError(typeof msg === "string" ? msg : "An error occurred.");
        });
        return;
      }
      onError(typeof error === "string" ? error : "An error occurred");
    }
  };

  xhr.onerror = () => {
    window.alert("Network Failure. Please check your internet connectivity.");
    onError();
  };
  xhr.send(file);
};

export default uploadFile;

// Uploads a scribe audio blob. Returns the response of the upload.
export const uploadScribeFile = async (
  blob: Blob,
  scribeInstanceId: string,
  type: ScribeFileType,
) => {
  const category = type === ScribeFileType.AUDIO ? "AUDIO" : "UNSPECIFIED";
  const extension = blob.type.split("/")[1]?.split(";")?.[0];

  if (!extension) {
    throw new Error(
      "Could not determine file extension. Got mime type: " + blob.type,
    );
  }

  const name = `file.${extension}`;
  const filename = Date.now().toString();

  let length: number | undefined;
  if (type === ScribeFileType.AUDIO) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    try {
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
      length = Number(audioBuffer.duration.toFixed(2));
    } finally {
      await audioContext.close();
    }
  }

  const data = await API.scribe.createFileUpload({
    original_name: name,
    file_type: type,
    name: filename,
    associating_id: scribeInstanceId,
    file_category: category,
    mime_type: blob.type?.split(";")?.[0],
    length,
  });

  await new Promise<void>((resolve, reject) => {
    const url = data.signed_url;
    const internalName = data.internal_name;
    if (!url || !internalName) {
      reject(Error("Missing upload metadata"));
      return;
    }
    const newFile = new File([blob], internalName, { type: blob.type });

    const headers = {
      "Content-type": newFile.type.split(";")[0],
      "Content-disposition": "inline",
    };

    uploadFile(
      url,
      newFile,
      headers,
      (xhr: XMLHttpRequest) => (xhr.status === 200 ? resolve() : reject()),
      (e) => reject(Error(e)),
    );
  });

  return await API.scribe.editFileUpload(
    data.id,
    type === ScribeFileType.AUDIO ? "SCRIBE_AUDIO" : "SCRIBE_DOCUMENT",
    scribeInstanceId,
    { upload_completed: true },
  );
};
