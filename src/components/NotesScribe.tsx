import { cn } from "@/utils/utils";
import { Button } from "./ui/button";
import { MicrophoneIcon } from "@/utils/icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../style/index.css";
import { ContainerRefProvider, useContainerRef } from "@/hooks/useContainerRef";
import { useEffect, useRef, useState } from "react";
import useSegmentedRecording from "@/hooks/useSegmentedRecorder";
import { useTimer } from "@/hooks/useTimer";
import { API } from "@/utils/api";
import { uploadScribeFile } from "@/utils/upload-utils";
import { ScribeFileType } from "@/types";
import { poller } from "@/utils/response-utils";
import { usePath } from "raviger";

export type NotesScribeProps = {
  className?: string;
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
};

export function NotesScribe(props: NotesScribeProps) {
  const { className, setMessage } = props;

  const container = useRef<HTMLDivElement>(null);
  const containerRef = useContainerRef();
  const timer = useTimer();
  const path = usePath();
  const [isRecording, setIsRecording] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const {
    startRecording,
    stopRecording,
    resetRecording,
    audioBlobs,
    setAudioBlobs,
  } = useSegmentedRecording();

  const facilityId = path?.includes("/facility/")
    ? path.split("/facility/")[1].split("/")[0]
    : undefined;
  const encounterId = path?.includes("/encounter/")
    ? path.split("/encounter/")[1].split("/")[0]
    : undefined;

  useEffect(() => {
    if (container.current) {
      containerRef.current = container.current;
    }
  }, [container, containerRef]);

  const handleSubmitRecording = async () => {
    if (!audioBlobs.length) return;
    setIsSubmitting(true);
    try {
      const scribeInstance = await API.scribe.create({
        status: "CREATED",
        form_data: [
          {
            title: "",
            description: "",
            fields: [
              {
                id: "transcription",
                friendlyName: "transcription",
                humanValue: "",
                type: "text",
                current: null,
              },
            ],
          },
        ],
        requested_in_facility_id: facilityId || "",
        requested_in_encounter_id: encounterId || "",
      });

      await Promise.all(
        audioBlobs.map((blob) =>
          uploadScribeFile(
            blob,
            scribeInstance.external_id,
            ScribeFileType.AUDIO,
          ),
        ),
      );

      await API.scribe.update(scribeInstance.external_id, {
        status: "READY",
        requested_in_facility_id: facilityId || "",
        requested_in_encounter_id: encounterId || "",
        transcript: null,
      });

      const transcript = await poller(scribeInstance.external_id, "transcript");
      if (transcript) {
        setMessage(transcript);
      }

      resetRecording();
      setAudioBlobs([]);
    } catch (error) {
      console.error("Failed to process NotesScribe recording", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
      timer.stop();
      setIsRecording(false);
      await handleSubmitRecording();
      return;
    }

    resetRecording();
    setAudioBlobs([]);
    await startRecording();
    timer.start();
    setIsRecording(true);
  };

  return (
    <div className="scribe-container relative" ref={container}>
      {isRecording && (
        <div className="absolute -top-12 left-1/2 z-10 -translate-x-1/2 rounded-md bg-neutral-900 px-3 py-1.5 text-xs font-medium text-white shadow-sm">
          {timer.time}
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
        type="button"
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <MicrophoneIcon className="size-8 fill-current text-white" />
        )}
      </Button>
    </div>
  );
}

const queryClient = new QueryClient();

export default function NotesScribeProvider(props: NotesScribeProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <ContainerRefProvider>
        <NotesScribe {...props} />
      </ContainerRefProvider>
    </QueryClientProvider>
  );
}
