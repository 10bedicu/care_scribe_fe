import { cn } from "@/utils/utils";
import { Button } from "./ui/button";
import { MicrophoneIcon } from "@/utils/icons";
import { ReloadIcon } from "@radix-ui/react-icons";
import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from "@tanstack/react-query";
import "../style/index.css";
import { ContainerRefProvider, useContainerRef } from "@/hooks/useContainerRef";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTimer } from "@/hooks/useTimer";
import useSegmentedRecording from "@/hooks/useSegmentedRecorder";
import { usePath } from "raviger";
import { useQuota } from "@/hooks/useQuota";
import { API } from "@/utils/api";
import { ScribeFileType, ScribeModel } from "@/types";
import { uploadScribeFile } from "@/utils/upload-utils";
import { poller } from "@/utils/response-utils";
import TncDialog from "./TncDialog";
import { toast } from "sonner";
import { Toaster } from "./ui/sonner";
import Feedback from "./Feedback";
import { KeyboardShortcutKey } from "./ui/keyboard-shortcut";
import useKeyboardShortcut from "@/hooks/useKeyboardShortcut";
import { useTranslation } from "react-i18next";
import { I18NNAMESPACE } from "@/utils/constants";
import ControllerDropDownMenu from "./ControllerDropDownMenu";

export type NotesScribeProps = {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
};

type NotesScribeStatus =
  | "IDLE"
  | "RECORDING"
  | "UPLOADING"
  | "TRANSCRIBING"
  | "REVIEWING"
  | "FAILED";

export function NotesScribe(props: NotesScribeProps) {
  const { t } = useTranslation(I18NNAMESPACE);
  const path = usePath();

  const facilityId = path?.includes("/facility/")
    ? path.split("/facility/")[1].split("/")[0]
    : undefined;

  const encounterId = path?.includes("/encounter/")
    ? path.split("/encounter/")[1].split("/")[0]
    : undefined;

  const { message, setMessage } = props;
  const queryClient = useQueryClient();

  const container = useRef<HTMLDivElement>(null);
  const containerRef = useContainerRef();
  const timer = useTimer();
  const messageBeforeRecording = useRef("");
  const [showTnc, setShowTnc] = useState(false);
  const [status, setStatus] = useState<NotesScribeStatus>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const [scribe, setScribe] = useState<ScribeModel | null>(null);
  const [uploadComplete, setUploadComplete] = useState(false);
  const [proposedTranscript, setProposedTranscript] = useState<string | null>(
    null,
  );
  const [reviewModalEl, setReviewModalEl] = useState<HTMLDivElement | null>(
    null,
  );
  const isAbortedRef = useRef(false);

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
  const isReviewing = status === "REVIEWING";
  const isFailed = status === "FAILED";

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
    setProposedTranscript(null);
    setStatus("UPLOADING");

    let scribeInstance = scribe;
    let filesUploaded = uploadComplete;

    try {
      if (!scribeInstance) {
        scribeInstance = await API.scribe.create({
          status: "CREATED",
          transcript_only: true,
          requested_in_facility_id: facilityId,
          requested_in_encounter_id: encounterId,
        });
        setScribe(scribeInstance);
      }

      if (!filesUploaded) {
        await Promise.all(
          blobs.map((blob) =>
            uploadScribeFile(
              blob,
              scribeInstance!.external_id,
              ScribeFileType.AUDIO,
            ),
          ),
        );

        if (isAbortedRef.current) return;

        await API.scribe.update(scribeInstance.external_id, {
          status: "READY",
          transcript_only: true,
          requested_in_facility_id: facilityId,
          requested_in_encounter_id: encounterId,
        });
        setUploadComplete(true);
        filesUploaded = true;
      } else {
        await API.scribe.update(scribeInstance.external_id, {
          status: "READY",
          transcript_only: true,
          requested_in_facility_id: facilityId,
          requested_in_encounter_id: encounterId,
          transcript: null,
        });
      }
    } catch (err) {
      console.error("Failed to upload recording", err);
      if (!isAbortedRef.current) {
        setError(t("audio_upload_error"));
        toast.error(t("audio_upload_error"));
        setStatus("FAILED");
      }
      queryClient.invalidateQueries({ queryKey: ["scribe-history"] });
      return;
    }

    setStatus("TRANSCRIBING");
    try {
      const transcript = await poller(
        scribeInstance.external_id,
        "transcript",
        isAbortedRef,
        setScribe,
      );
      queryClient.invalidateQueries({ queryKey: ["scribe-history"] });

      if (isAbortedRef.current || !transcript) return;

      setProposedTranscript(transcript);
      setStatus("REVIEWING");
    } catch (err) {
      console.error("Failed to transcribe note", err);
      if (!isAbortedRef.current) {
        setError(t("failed_to_transcribe_recording"));
        toast.error(t("failed_to_transcribe_recording"));
        setStatus("FAILED");
      }
      queryClient.invalidateQueries({ queryKey: ["scribe-history"] });
    }
  };

  const handleRetry = () => {
    if (!audioBlobs.length) return;
    runTranscription(audioBlobs);
  };

  const handleDismissFailure = () => {
    isAbortedRef.current = true;
    setError(null);
    setScribe(null);
    setUploadComplete(false);
    setProposedTranscript(null);
    resetRecording();
    setStatus("IDLE");
  };

  const handleAcceptReview = () => {
    if (proposedTranscript !== null) {
      const prefix = messageBeforeRecording.current;
      setMessage(
        prefix ? `${prefix} ${proposedTranscript}` : proposedTranscript,
      );
    }
    closeReview();
  };

  const handleRejectReview = () => {
    closeReview();
  };

  const closeReview = () => {
    setProposedTranscript(null);
    setScribe(null);
    setUploadComplete(false);
    resetRecording();
    setStatus("IDLE");
  };

  const handleUseHistoryScribe = (historyScribe: ScribeModel) => {
    // Abort any in-progress recording or processing before switching to review.
    isAbortedRef.current = true;
    if (isRecording) {
      timer.stop();
      timer.reset();
      stopSegmentedRecording();
    }
    resetRecording();
    setUploadComplete(false);

    messageBeforeRecording.current = message;
    setError(null);
    setScribe(historyScribe);
    setProposedTranscript(historyScribe.transcript || "");
    setStatus("REVIEWING");
  };

  const handleProcessAgain = async () => {
    if (!scribe) return;
    isAbortedRef.current = false;
    setError(null);
    setProposedTranscript(null);

    try {
      await API.scribe.update(scribe.external_id, {
        status: "READY",
        transcript_only: true,
        requested_in_facility_id: facilityId,
        requested_in_encounter_id: encounterId,
        transcript: null,
      });

      setStatus("TRANSCRIBING");
      const transcript = await poller(
        scribe.external_id,
        "transcript",
        isAbortedRef,
        setScribe,
      );

      queryClient.invalidateQueries({ queryKey: ["scribe-history"] });

      if (isAbortedRef.current || !transcript) return;

      setProposedTranscript(transcript);
      setStatus("REVIEWING");
    } catch (err) {
      console.error("Failed to re-process transcription", err);
      if (!isAbortedRef.current) {
        setError(t("failed_to_transcribe_recording"));
        toast.error(t("failed_to_transcribe_recording"));
      }
      queryClient.invalidateQueries({ queryKey: ["scribe-history"] });
      setStatus("IDLE");
    }
  };

  // Blur any focused input when entering review so global shortcuts can fire.
  useEffect(() => {
    if (status !== "REVIEWING") return;
    const active = document.activeElement as HTMLElement | null;
    active?.blur?.();
  }, [status]);

  useKeyboardShortcut(["A"], () => {
    if (isReviewing) handleAcceptReview();
  });
  useKeyboardShortcut(["R"], () => {
    if (isReviewing) handleRejectReview();
  });
  useKeyboardShortcut(["P"], () => {
    if (isReviewing) handleProcessAgain();
  });

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
    if (isReviewing) return;
    if (isFailed) return;

    if (!quota.tncAccepted) {
      setShowTnc(true);
      return;
    }

    try {
      setError(null);
      messageBeforeRecording.current = message;
      resetRecording();
      setScribe(null);
      setUploadComplete(false);
      await startSegmentedRecording();
      setStatus("RECORDING");
      timer.start();
    } catch (err) {
      console.error("Failed to start recording", err);
      setError(t("microphone_access_denied"));
      setStatus("IDLE");
    }
  };

  if (!SCRIBE_ENABLED) return null;

  const busyLabel =
    status === "UPLOADING"
      ? t("uploading")
      : status === "TRANSCRIBING"
        ? t("transcribing")
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
      {error && !isFailed && (
        <div className="absolute -top-12 left-1/2 z-10 -translate-x-1/2 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
          {error}
        </div>
      )}
      {isFailed && (
        <div className="absolute bottom-full left-1/2 z-10 mb-2 flex w-46 -translate-x-1/2 flex-col items-stretch gap-1.5 rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-sm">
          <span className="text-center">
            {error || t("failed_to_transcribe_recording")}
          </span>
          <div className="flex gap-1.5">
            <button
              onClick={handleRetry}
              className="flex-1 cursor-pointer rounded bg-white px-2 py-1 text-[11px] font-semibold text-red-600 transition-colors hover:bg-neutral-100"
              type="button"
            >
              {t("retry")}
            </button>
            <button
              onClick={handleDismissFailure}
              className="cursor-pointer rounded bg-white/20 px-2 py-1 text-[11px] font-semibold text-white transition-colors hover:bg-white/30"
              type="button"
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
      <div className="flex shrink-0 items-stretch">
        <Button
          className={cn(
            "size-10 shrink-0 rounded-r-none",
            isRecording
              ? "animate-pulse bg-red-500 text-white hover:bg-red-500"
              : "text-white",
          )}
          onClick={handleToggleRecording}
          disabled={isBusy || isReviewing || isFailed}
          type="button"
        >
          {isBusy ? (
            <ReloadIcon className="size-5 animate-spin text-white" />
          ) : (
            <MicrophoneIcon className="size-8 fill-current text-white" />
          )}
        </Button>
        <ControllerDropDownMenu
          onUseScribe={handleUseHistoryScribe}
          triggerClassName={cn(
            "h-10 w-4 aspect-auto rounded-l-none border-l border-white/25 text-white shadow-sm",
            isRecording
              ? "animate-pulse bg-red-500 hover:bg-red-500 border-white/30"
              : "bg-primary-700 hover:bg-primary-700/90",
          )}
          triggerIconClassName="size-3"
          transcriptOnly
        />
      </div>
      <TncDialog
        open={showTnc}
        onOpenChange={setShowTnc}
        content={quota.tnc}
        onAccept={quota.acceptTnc}
      />
      {isReviewing &&
        proposedTranscript !== null &&
        createPortal(
          <div className="scribe-container">
            <div
              ref={setReviewModalEl}
              className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-black/50 p-6 text-white backdrop-blur-sm md:p-20"
            >
              <h2 className="text-center text-xl font-black md:text-3xl">
                {t("review_transcript")}
              </h2>
              <div className="my-4 flex w-full max-w-2xl flex-col gap-3">
                {messageBeforeRecording.current && (
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-medium tracking-wide uppercase opacity-60">
                      {t("existing_note")}
                    </span>
                    <div className="max-h-24 overflow-auto rounded-md bg-white/10 p-3 text-sm whitespace-pre-wrap">
                      {messageBeforeRecording.current}
                    </div>
                  </div>
                )}
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-medium tracking-wide uppercase opacity-60">
                    {t("transcript")}
                  </span>
                  <div className="max-h-[40vh] overflow-auto rounded-md bg-white/10 p-4 text-base leading-relaxed whitespace-pre-wrap md:text-lg">
                    {proposedTranscript}
                  </div>
                </div>
              </div>
              <div className="absolute inset-x-0 bottom-0 flex flex-col items-center justify-center gap-4 p-4 text-white">
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleRejectReview}
                    className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-lg font-semibold text-black transition-all hover:bg-neutral-100"
                  >
                    <KeyboardShortcutKey shortcut={["R"]} />
                    {t("reject")}
                  </button>
                  <button
                    onClick={handleProcessAgain}
                    className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-lg font-semibold text-black transition-all hover:bg-neutral-100"
                  >
                    <KeyboardShortcutKey shortcut={["P"]} />
                    {t("process_transcript")}
                  </button>
                  <button
                    onClick={handleAcceptReview}
                    className="bg-primary-500 hover:bg-primary-600 flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold transition-all"
                  >
                    <KeyboardShortcutKey shortcut={["A"]} />
                    {t("accept")}
                  </button>
                </div>
                {scribe && (
                  <Feedback scribe={scribe} portalContainer={reviewModalEl} />
                )}
              </div>
            </div>
          </div>,
          document.body,
        )}
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
