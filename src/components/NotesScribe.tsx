import { cn } from "@/utils/utils";
import { Button } from "./ui/button";
import { MicrophoneIcon } from "@/utils/icons";
import { ReloadIcon } from "@radix-ui/react-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../style/index.css";
import { ContainerRefProvider, useContainerRef } from "@/hooks/useContainerRef";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTimer } from "@/hooks/useTimer";
import {
  useLiveTranscription,
  type RecordingResult,
} from "@/hooks/useLiveTranscription";
import { usePath } from "raviger";
import { useQuota } from "@/hooks/useQuota";
import { API } from "@/utils/api";
import { ScribeFileType } from "@/types";
import TncDialog from "./TncDialog";
import { toast } from "sonner";
import { Toaster } from "./ui/sonner";
import { useControlState } from "@/hooks/useControlState";

export type NotesScribeProps = {
  className?: string;
};

export function NotesScribe(props: NotesScribeProps) {
  const { className } = props;
  const [message, setMessage] = useControlState("noteMessage", "");

  const container = useRef<HTMLDivElement>(null);
  const containerRef = useContainerRef();
  const timer = useTimer();
  const messageBeforeRecording = useRef("");
  const path = usePath();
  const [showTnc, setShowTnc] = useState(false);

  const facilityId = path?.includes("/facility/")
    ? path.split("/facility/")[1].split("/")[0]
    : undefined;

  const encounterId = path?.includes("/encounter/")
    ? path.split("/encounter/")[1].split("/")[0]
    : undefined;

  const quota = useQuota(facilityId);
  const SCRIBE_ENABLED =
    !!quota.quotas?.length &&
    quota.quotas.some((q) => q.enable_live_transcription);

  const [isStarting, setIsStarting] = useState(false);

  const { isRecording, transcript, error, startRecording, stopRecording } =
    useLiveTranscription({ facilityId, encounterId });

  useEffect(() => {
    if (container.current) {
      containerRef.current = container.current;
    }
  }, [container, containerRef]);

  // Append the live transcript to whatever was already in the message
  useEffect(() => {
    if (transcript) {
      const prefix = messageBeforeRecording.current;
      setMessage(prefix ? `${prefix} ${transcript}` : transcript);
    }
  }, [transcript, setMessage]);

  const uploadAndComplete = useCallback(async (result: RecordingResult) => {
    const { sessionId, audioBlob, audioDuration, mimeType } = result;
    const baseMimeType = mimeType.split(";")[0];
    const extension = baseMimeType.split("/")[1] || "webm";

    try {
      // Step 3a: Create file record
      const fileData = await API.scribe.createFileUpload({
        file_type: ScribeFileType.AUDIO,
        file_category: "AUDIO",
        name: `live_recording_${Date.now()}.${extension}`,
        original_name: `live_recording.${extension}`,
        associating_id: sessionId,
        mime_type: baseMimeType,
        length: audioDuration,
      });

      // Step 3b: Upload to signed URL
      const file = new File([audioBlob], fileData.internal_name, {
        type: baseMimeType,
      });
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", fileData.signed_url);
        xhr.setRequestHeader("Content-Type", baseMimeType);
        xhr.setRequestHeader("Content-Disposition", "inline");
        xhr.onload = () =>
          xhr.status === 200
            ? resolve()
            : reject(new Error(`Upload failed: ${xhr.status}`));
        xhr.onerror = () => reject(new Error("Upload network error"));
        xhr.send(file);
      });

      // Step 3c: Mark upload complete
      await API.scribe.editFileUpload(fileData.id, "SCRIBE_AUDIO", sessionId, {
        upload_completed: true,
      });
    } catch (err) {
      console.error("Failed to upload recording", err);
      toast.error("Failed to upload recording.");
    }

    // Step 4: Complete session (always attempted)
    try {
      await API.liveTranscription.complete({
        session_id: sessionId,
        transcript: result.transcript,
      });
    } catch (err) {
      console.error("Failed to complete live transcription session", err);
      toast.error("Failed to complete transcription session.");
    }
  }, []);

  const handleToggleRecording = async () => {
    if (isRecording) {
      timer.stop();
      const result = await stopRecording();
      if (result) {
        uploadAndComplete(result);
      }
      return;
    }

    if (!quota.tncAccepted) {
      setShowTnc(true);
      return;
    }

    try {
      setIsStarting(true);
      messageBeforeRecording.current = message;
      await startRecording();
      timer.start();
    } catch (err) {
      console.error("Failed to start live transcription", err);
    } finally {
      setIsStarting(false);
    }
  };

  if (!SCRIBE_ENABLED) return null;

  return (
    <div className="scribe-container relative" ref={container}>
      {isRecording && (
        <div className="absolute -top-12 left-1/2 z-10 -translate-x-1/2 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
          {timer.time}
        </div>
      )}
      {error && (
        <div className="absolute -top-12 left-1/2 z-10 -translate-x-1/2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
          {error}
        </div>
      )}
      <Button
        className={cn(
          className,
          "size-10 shrink-0",
          isRecording
            ? "animate-pulse bg-red-500 text-white hover:bg-red-500"
            : "text-white",
        )}
        onClick={handleToggleRecording}
        disabled={isStarting}
        type="button"
      >
        {isStarting ? (
          <ReloadIcon className="size-5 animate-spin text-white" />
        ) : (
          <MicrophoneIcon className="size-8 fill-current text-white" />
        )}
      </Button>
      <TncDialog
        open={showTnc}
        onOpenChange={setShowTnc}
        tnc={quota.tnc}
        onAccept={quota.acceptTnc}
      />
    </div>
  );
}

const queryClient = new QueryClient();

export default function NotesScribeProvider(props: NotesScribeProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ContainerRefProvider>
        <NotesScribe {...props} />
        {createPortal(
          <Toaster position="top-right" richColors expand theme="light" />,
          document.body,
        )}
      </ContainerRefProvider>
    </QueryClientProvider>
  );
}
