import { useEffect, useState } from "react";

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
}

interface UseMicrophonesResult {
  microphones: MicrophoneDevice[];
  error: string | null;
}

export function useMicrophones(dontFetch?: boolean): UseMicrophonesResult {
  const [microphones, setMicrophones] = useState<MicrophoneDevice[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dontFetch) {
      return;
    }
    const fetchMicrophones = async () => {
      try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        let mics = devices.filter((d) => d.kind === "audioinput");
        // If labels are missing, request permission and re-enumerate
        if (mics.some((d) => !d.label)) {
          try {
            await navigator.mediaDevices.getUserMedia({ audio: true });
            devices = await navigator.mediaDevices.enumerateDevices();
            mics = devices.filter((d) => d.kind === "audioinput");
          } catch {
            setError("Permission to access microphone denied.");
          }
        }
        setMicrophones(
          mics.map((d) => ({
            deviceId: d.deviceId,
            label: d.label || "Unnamed Microphone",
          })),
        );
      } catch (err) {
        console.error("Failed to get microphones:", err);
        setError("Unable to access microphone devices.");
      }
    };

    fetchMicrophones();
  }, [dontFetch]);

  return { microphones, error };
}
