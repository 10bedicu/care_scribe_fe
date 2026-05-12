import { cn } from "@/utils/utils";
import { Button } from "./ui/button";
import { MicrophoneIcon } from "@/utils/icons";
import { ReloadIcon } from "@radix-ui/react-icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../style/index.css";
import { ContainerRefProvider, useContainerRef } from "@/hooks/useContainerRef";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTimer } from "@/hooks/useTimer";
import useSegmentedRecording from "@/hooks/useSegmentedRecorder";
import { usePath } from "raviger";
import { useQuota } from "@/hooks/useQuota";
import { API } from "@/utils/api";
import { ScribeFileType } from "@/types";
import { uploadScribeFile } from "@/utils/upload-utils";
import { poller } from "@/utils/response-utils";
import TncDialog from "./TncDialog";
import { toast } from "sonner";
import { Toaster } from "./ui/sonner";
import { useControlState } from "@/hooks/useControlState";

export type NotesScribeProps = {
  className?: string;
};

type NotesScribeStatus = "IDLE" | "RECORDING" | "UPLOADING" | "TRANSCRIBING";

export function NotesScribe(props: NotesScribeProps) {
  const { className } = props;
  const [message, setMessage] = useControlState("noteMessage", "");

  const container = useRef<HTMLDivElement>(null);
  const containerRef = useContainerRef();
  const timer = useTimer();
  const messageBeforeRecording = useRef("");
  const path = usePath();
  const [showTnc, setShowTnc] = useState(false);
  const [status, setStatus] = useState<NotesScribeStatus>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const isAbortedRef = useRef(false);

  const facilityId = path?.includes("/facility/")
    ? path.split("/facility/")[1].split("/")[0]
    : undefined;

  const encounterId = path?.includes("/encounter/")
    ? path.split("/encounter/")[1].split("/")[0]
    : undefined;

  const quota = useQuota(facilityId);
  const SCRIBE_ENABLED = !!quota.quotas?.length;

  const {
    startRecording: startSegmentedRecording,
    stopRecording: stopSegmentedRecording,
    resetRecording,
    audioBlobs,
  } = useSegmentedRecording();

  const isRecording = status === "RECORDING";
  const isBusy = status === "UPLOADING" || status === "TRANSCRIBING";

  useEffect(() => {
    if (container.current) {
      containerRef.current = container.current;
    }
  }, [container, containerRef]);

  useEffect(() => {
    return () => {
      isAbortedRef.current = true;
    };
  }, []);

  const runTranscription = async (blobs: Blob[]) => {
    if (!blobs.length) {
      setStatus("IDLE");
      return;
    }
    isAbortedRef.current = false;
    setError(null);

    try {
      const scribe = await API.scribe.create({
        status: "CREATED",
        transcript_only: true,
        requested_in_facility_id: facilityId || "",
        requested_in_encounter_id: encounterId || "",
      });

      await Promise.all(
        blobs.map((blob) =>
          uploadScribeFile(blob, scribe.external_id, ScribeFileType.AUDIO),
        ),
      );

      if (isAbortedRef.current) return;

      await API.scribe.update(scribe.external_id, {
        status: "READY",
        transcript_only: true,
        requested_in_facility_id: facilityId || "",
        requested_in_encounter_id: encounterId || "",
      });

      setStatus("TRANSCRIBING");
      const transcript = await poller(
        scribe.external_id,
        "transcript",
        isAbortedRef,
      );

      if (isAbortedRef.current || !transcript) return;

      const prefix = messageBeforeRecording.current;
      setMessage(prefix ? `${prefix} ${transcript}` : transcript);
    } catch (err) {
      console.error("Failed to transcribe note", err);
      if (!isAbortedRef.current) {
        setError("Failed to transcribe recording.");
        toast.error("Failed to transcribe recording.");
      }
    } finally {
      resetRecording();
      setStatus("IDLE");
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      timer.stop();
      timer.reset();
      stopSegmentedRecording();
      setStatus("UPLOADING");
      // Give the recorder a tick to flush its final dataavailable event.
      setTimeout(() => {
        runTranscription(audioBlobs);
      }, 250);
      return;
    }

    if (isBusy) return;

    if (!quota.tncAccepted) {
      setShowTnc(true);
      return;
    }

    try {
      setError(null);
      messageBeforeRecording.current = message;
      resetRecording();
      await startSegmentedRecording();
      setStatus("RECORDING");
      timer.start();
    } catch (err) {
      console.error("Failed to start recording", err);
      setError("Microphone access denied.");
      setStatus("IDLE");
    }
  };

  if (!SCRIBE_ENABLED) return null;

  const busyLabel =
    status === "UPLOADING"
      ? "Uploading…"
      : status === "TRANSCRIBING"
        ? "Transcribing…"
        : null;

  return (
    <div className="scribe-container relative" ref={container}>
      {isRecording && (
        <div className="absolute -top-12 left-1/2 z-10 -translate-x-1/2 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
          {timer.time}
        </div>
      )}
      {busyLabel && (
        <div className="absolute -top-12 left-1/2 z-10 -translate-x-1/2 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
          {busyLabel}
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
        disabled={isBusy}
        type="button"
      >
        {isBusy ? (
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
