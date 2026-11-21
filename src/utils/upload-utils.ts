import { ScribeFileType } from "@/types";
import { API } from "./api";

// Below this upload speed, the network is considered slow.
const SLOW_NETWORK_THRESHOLD_BYTES_PER_SEC = 50 * 1024; // 50 KB/s
// Minimum time between speed samples, to avoid noisy readings.
const SLOW_NETWORK_SAMPLE_INTERVAL_MS = 1000;

export function handleUploadPercentage(
  event: ProgressEvent,
  onProgress: (percent: number) => void,
) {
  if (event.lengthComputable) {
    const percentComplete = Math.round((event.loaded / event.total) * 100);
    onProgress(percentComplete);
  }
}

const uploadFile = (
  url: string,
  file: File | FormData,
  reqMethod: string,
  headers: object,
  onLoad: (xhr: XMLHttpRequest) => void,
  onProgress: ((percent: number) => void) | null,
  onError: () => void,
  onSlowNetwork?: (isSlow: boolean) => void,
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

  if (onProgress != null || onSlowNetwork != null) {
    let lastLoaded = 0;
    let lastTime = Date.now();
    xhr.upload.onprogress = (event: ProgressEvent) => {
      if (onProgress != null) {
        handleUploadPercentage(event, onProgress);
      }
      if (onSlowNetwork != null) {
        const now = Date.now();
        const elapsedMs = now - lastTime;
        if (elapsedMs >= SLOW_NETWORK_SAMPLE_INTERVAL_MS) {
          const bytesSinceLastSample = event.loaded - lastLoaded;
          const bytesPerSec = bytesSinceLastSample / (elapsedMs / 1000);
          onSlowNetwork(bytesPerSec < SLOW_NETWORK_THRESHOLD_BYTES_PER_SEC);
          lastLoaded = event.loaded;
          lastTime = now;
        }
      }
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
  onProgress?: (percent: number) => void,
  onSlowNetwork?: (isSlow: boolean) => void,
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
      onProgress ?? null,
      reject,
      onSlowNetwork,
    );
  });

  return await API.scribe.editFileUpload(
    data.id,
    type === ScribeFileType.AUDIO ? "SCRIBE_AUDIO" : "SCRIBE_DOCUMENT",
    scribeInstanceId,
    { upload_completed: true },
  );
};
