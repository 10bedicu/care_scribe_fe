import { cn } from "@/utils/utils";
import { Button } from "./ui/button";
import { MicrophoneIcon } from "@/utils/icons";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "../style/index.css";
import { ContainerRefProvider, useContainerRef } from "@/hooks/useContainerRef";
import { useEffect, useRef } from "react";
import { useTimer } from "@/hooks/useTimer";
import { useLiveTranscription } from "@/hooks/useLiveTranscription";
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

  const facilityId = path?.includes("/facility/")
    ? path.split("/facility/")[1].split("/")[0]
    : undefined;

  const { isRecording, transcript, error, startRecording, stopRecording } =
    useLiveTranscription({ facilityId });

  useEffect(() => {
    if (container.current) {
      containerRef.current = container.current;
    }
  }, [container, containerRef]);

  // Update the parent message with the live transcript
  useEffect(() => {
    if (transcript) {
      setMessage(transcript);
    }
  }, [transcript, setMessage]);

  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
      timer.stop();
      return;
    }

    try {
      await startRecording();
      timer.start();
    } catch (err) {
      console.error("Failed to start live transcription", err);
    }
  };

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
        type="button"
      >
        <MicrophoneIcon className="size-8 fill-current text-white" />
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
