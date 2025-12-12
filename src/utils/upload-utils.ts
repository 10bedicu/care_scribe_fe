import { ScribeFileType } from "@/types";
import { Dispatch, SetStateAction } from "react";
import { API } from "./api";

export function handleUploadPercentage(
  event: ProgressEvent,
  setUploadPercent: Dispatch<SetStateAction<number>>,
) {
  if (event.lengthComputable) {
    const percentComplete = Math.round((event.loaded / event.total) * 100);
    setUploadPercent(percentComplete);
  }
}

const uploadFile = (
  url: string,
  file: File | FormData,
  reqMethod: string,
  headers: object,
  onLoad: (xhr: XMLHttpRequest) => void,
  setUploadPercent: Dispatch<SetStateAction<number>> | null,
  onError: () => void,
) => {
  const xhr = new XMLHttpRequest();
  xhr.open(reqMethod, url);

  Object.entries(headers).forEach(([key, value]) => {
    xhr.setRequestHeader(key, value);
  });

  xhr.onload = () => {
    onLoad(xhr);
    if (400 <= xhr.status && xhr.status <= 499) {
      const error = JSON.parse(xhr.responseText);
      if (typeof error === "object" && !Array.isArray(error)) {
        Object.values(error).forEach((msg) => {
          window.alert(msg || "Something went wrong!");
        });
      } else {
        window.alert(error || "Something went wrong!");
      }
    }
  };

  if (setUploadPercent != null) {
    xhr.upload.onprogress = (event: ProgressEvent) => {
      handleUploadPercentage(event, setUploadPercent);
    };
  }

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
  const extension = blob?.type?.split("/")?.[1].split(";")?.[0];
  const name = "file" + (extension ? `.${extension}` : "");
  const filename = Date.now().toString();

  let length = undefined;
  if (type === ScribeFileType.AUDIO) {
    const arrayBuffer = await blob.arrayBuffer();
    const audioContext = new AudioContext();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    length = Number(audioBuffer.duration.toFixed(2));
  }

  const data = await API.scribe.createFileUpload({
    original_name: name,
    file_type: type,
    name: filename,
    associating_id: scribeInstanceId,
    file_category: category,
    mime_type: blob?.type?.split(";")?.[0],
    length,
  });

  await new Promise<void>((resolve, reject) => {
    try {
      const url = data?.signed_url;
      const internal_name = data?.internal_name;
      const f = blob;
      if (f === undefined) {
        reject(Error("No file to upload"));
        return;
      }
      const newFile = new File([f], `${internal_name}`, { type: f.type });
      const headers = {
        "Content-type": newFile?.type?.split(";")?.[0],
        "Content-disposition": "inline",
      };

      uploadFile(
        url || "",
        newFile,
        "PUT",
        headers,
        (xhr: XMLHttpRequest) => (xhr.status === 200 ? resolve() : reject()),
        null,
        reject,
      );
    } catch (error) {
      reject(error);
    }
  });

  return await API.scribe.editFileUpload(
    data.id,
    type === ScribeFileType.AUDIO ? "SCRIBE_AUDIO" : "SCRIBE_DOCUMENT",
    scribeInstanceId,
    { upload_completed: true },
  );
};
