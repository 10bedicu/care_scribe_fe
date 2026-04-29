import { useEffect, useRef, useState } from "react";
import {
  ScribeAIResponse,
  ScribeFieldSuggestion,
  ScribeFileType,
  ScribeHydratedField,
  ScribeHydratedQuestionnaire,
  ScribeModel,
  ScribeQuestionnaire,
  ScribeStatus,
} from "../types";
import {
  ChevronUpIcon,
  Cross1Icon,
  CrossCircledIcon,
  ImageIcon,
} from "@radix-ui/react-icons";
import FileUpload from "./FileUpload";

import { API } from "@/utils/api";
import { Button } from "./ui/button";
import { I18NNAMESPACE } from "@/utils/constants";
import Lottie from "lottie-react";
import ScribeButton from "./ScribeButton";
import ScribeReview from "./Review";
import { Textarea } from "./ui/textarea";
import animationData from "../assets/animation.json";
import useSegmentedRecording from "@/hooks/useSegmentedRecorder";
import { useTimer } from "@/hooks/useTimer";
import { useTranslation } from "react-i18next";
import { Link, usePath } from "raviger";
import { twMerge } from "tailwind-merge";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQuota } from "@/hooks/useQuota";
import TncDialog from "./TncDialog";
import ControllerDropDownMenu from "./ControllerDropDownMenu";
import { useStorage } from "@/hooks/useStorage";
import { cleanAIResponse, poller } from "@/utils/response-utils";
import {
  getFieldsToReview,
  getHydratedFields,
  getQuestionInputs,
} from "@/utils/field-utils";
import { uploadScribeFile } from "@/utils/upload-utils";
import useAuthUser from "@/hooks/useAuthUser";
import {
  useLiveTranscription,
  type RecordingResult,
} from "@/hooks/useLiveTranscription";
import { updateFieldValue } from "@/utils/field-utils";

function MetaInformation(props: { meta: ScribeModel["meta"] }) {
  const latestProcessing =
    props.meta.processings?.[props.meta.processings.length - 1];

  const info = {
    "Audio Model": latestProcessing?.audio_model || "-",
    "Chat Model": latestProcessing?.chat_model,
    Provider: latestProcessing?.provider,
    "Input Tokens": latestProcessing?.completion_input_tokens || 0,
    "Cached Tokens": latestProcessing?.completion_cached_tokens || 0,
    "Output Tokens": latestProcessing?.completion_output_tokens || 0,
    "Transcription Time":
      (latestProcessing?.transcription_time || 0).toFixed(2) + "s",
    "Completion Time": latestProcessing?.completion_time?.toFixed(2) + "s",
  };

  return (
    <table className="mt-4 w-full text-[10px]">
      <tbody>
        {Object.entries(info).map(([key, value]) => (
          <tr key={key}>
            <td>{key}</td>
            <td>{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function Controller(props: {
  formState: unknown;
  setFormState: (formState: unknown) => void;
}) {
  const [status, setStatus] = useState<ScribeStatus>("IDLE");
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation(I18NNAMESPACE);
  const [transcript, setTranscript] = useState<string>();
  const timer = useTimer();
  const [lastTranscript, setLastTranscript] = useState<string>();
  const [instanceId, setInstanceId] = useState<string>();
  const [toReview, setToReview] = useState<ScribeFieldSuggestion[]>();
  const [openEditTranscript, setOpenEditTranscript] = useState(false);
  const [devMode] = useStorage("scribe-enable-dev-mode");
  const [controllerPosition] = useStorage("scribe-controller-position");
  const [scribe, setScribe] = useState<ScribeModel | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const path = usePath();
  const isAbortedRef = useRef(false);
  const [formStateSnapshot, setFormStateSnapshot] =
    useState<typeof props.formState>(null);
  const queryClient = useQueryClient();
  const facilityId = path?.includes("/facility/")
    ? path.split("/facility/")[1].split("/")[0]
    : undefined;

  const [currentTime] = useState(new Date().toISOString());

  const user = useAuthUser();

  const [showTnc, setShowTnc] = useState(false);

  const encounterId = path?.includes("/encounter/")
    ? path.split("/encounter/")[1].split("/")[0]
    : undefined;
  const quota = useQuota(facilityId);

  const {
    stopRecording: stopSegmentedRecording,
    resetRecording,
    audioBlobs,
    setAudioBlobs,
  } = useSegmentedRecording();

  const {
    isRecording: isLiveRecording,
    transcript: liveTranscript,
    error: liveError,
    startRecording: startLiveTranscription,
    stopRecording: stopLiveTranscription,
  } = useLiveTranscription({ facilityId, encounterId });

  // Live chunk processing refs
  const formStateRef = useRef(props.formState);
  const processedLengthRef = useRef(0);
  const chunkQueueRef = useRef<Promise<void>>(Promise.resolve());
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pendingChunks, setPendingChunks] = useState(0);

  useEffect(() => {
    formStateRef.current = props.formState;
  }, [props.formState]);

  const meta = scribe?.meta.processings?.[scribe.meta.processings.length - 1];

  useEffect(() => {
    // Fetch the audio files from the scribe instance.
    // Helpful when loading a previous scribe instance.
    if (audioBlobs.length) return;
    scribe?.audio?.map(async (af) => {
      const audioData = await fetch(af?.read_signed_url);
      const audioBlob = await audioData.blob();
      setAudioBlobs((prev) => [...prev, audioBlob]);
    });
    if (files.length) return;
    scribe?.documents?.map(async (ifile) => {
      const imageData = await fetch(ifile?.read_signed_url);
      const imageBlob = await imageData.blob();
      const imageFile = new File([imageBlob], ifile?.name, {
        type: imageBlob.type,
      });
      setFiles((prev) => [...prev, imageFile]);
    });
  }, [scribe]);

  useEffect(() => {
    return () => {
      isAbortedRef.current = true;
    };
  }, []);

  // gets the AI response and returns only the data that has changes
  const getAIResponse = async (
    scribeInstanceId: string,
    questionnaire: ScribeQuestionnaire[],
    sendProcessed: boolean = true,
  ) => {
    try {
      const hfields = getHydratedFields(questionnaire, false);
      if (!hfields || !hfields.length) {
        return;
      }
      const aiResponse = await poller(
        scribeInstanceId,
        "ai_response",
        isAbortedRef,
        setScribe,
      );
      if (!aiResponse) {
        setStatus("FAILED");
        return;
      }
      const scribeTranscription = aiResponse?.__scribe__transcription;
      if (scribeTranscription && files.length !== 0) {
        if (isAbortedRef.current) return;
        setTranscript(scribeTranscription);
      }

      const cleaned = await cleanAIResponse(
        aiResponse as ScribeAIResponse,
        questionnaire,
        { encounterId: encounterId!, currentUser: user!, currentTime },
      );

      Object.values(cleaned.meta.failed).forEach((errors) => {
        errors.forEach((error) => {
          toast.error(error);
        });
      });
      if (sendProcessed) {
        updateProcessedResponse(scribeInstanceId, cleaned.meta);
      }
      return cleaned.cleaned;
    } catch (e) {
      console.error(e);
      setStatus("FAILED");
    }
  };

  const updateProcessedResponse = async (
    scribeInstanceId: string,
    processedResponse: Awaited<ReturnType<typeof cleanAIResponse>>["meta"],
  ) => {
    try {
      await API.scribe.update(scribeInstanceId, {
        processed_ai_response: processedResponse,
      });
    } catch (e) {
      console.error(e);
      toast.error(t("scribe_error"));
    }
  };

  // gets the audio transcription
  const getTranscript = async (
    scribeInstanceId: string,
    fields?: ScribeQuestionnaire[],
  ): Promise<string> => {
    let hfields:
      | ScribeHydratedQuestionnaire<ScribeHydratedField>[]
      | undefined = undefined;
    if (fields) {
      hfields = getHydratedFields(fields, true);
    }
    try {
      await API.scribe.update(scribeInstanceId, {
        status: "READY",
        requested_in_facility_id: facilityId || "",
        requested_in_encounter_id: encounterId || "",
        form_data: hfields || undefined,
        transcript: null,
      });
      const transcript = await poller(
        scribeInstanceId,
        "transcript",
        isAbortedRef,
        setScribe,
      );
      return transcript;
    } catch {
      setStatus("FAILED");
      throw Error("Error getting transcript");
    }
  };

  // Sets up a scribe instance with the available recordings. Returns the instance ID.
  const createScribeInstance = async (
    questionnaires: ScribeQuestionnaire[],
  ) => {
    const hfields = getHydratedFields(questionnaires, true);
    const data = await API.scribe.create({
      status: "CREATED",
      form_data: hfields,
      requested_in_facility_id: facilityId || "",
      requested_in_encounter_id: encounterId || "",
    });

    try {
      await Promise.all([
        ...audioBlobs.map((blob) =>
          uploadScribeFile(blob, data?.external_id ?? "", ScribeFileType.AUDIO),
        ),
        ...files.map((file) =>
          uploadScribeFile(
            file,
            data?.external_id ?? "",
            ScribeFileType.DOCUMENT,
          ),
        ),
      ]);
    } catch (error) {
      setStatus("FAILED");
      setError(files.length > 0 ? t("upload_error") : t("audio_upload_error"));
      throw error;
    }

    return data.external_id;
  };
  // updates the transcript and fetches a new AI response
  const handleUpdateTranscript = async (updatedTranscript: string) => {
    if (updatedTranscript === lastTranscript && !files.length) return;
    if (!instanceId) throw Error("Cannot find scribe instance");
    if (formStateSnapshot) {
      props.setFormState(formStateSnapshot);
    }
    setToReview(undefined);
    setLastTranscript(updatedTranscript);
    try {
      await API.scribe.update(instanceId, {
        status: "READY",
        transcript: updatedTranscript,
        requested_in_facility_id: facilityId || "",
        requested_in_encounter_id: encounterId || "",
      });
    } catch {
      throw Error("Error updating Scribe Instance");
    }
    setStatus("THINKING");
    const fields = getQuestionInputs(formStateSnapshot);
    const aiResponse = await getAIResponse(instanceId, fields);
    if (!aiResponse) return;
    setStatus("REVIEWING");
    setToReview(getFieldsToReview(aiResponse, fields));
  };

  // Process a transcribed text chunk: create a scribe instance with current
  // form state, get AI response, and apply suggestions directly to the form
  // (no review step).
  const processTranscriptChunk = async (chunkText: string) => {
    if (isAbortedRef.current) return;
    const fields = getQuestionInputs(formStateRef.current);
    if (!fields.length) return;
    const hfields = getHydratedFields(fields, true);
    if (!hfields.length) return;

    try {
      const created = await API.scribe.create({
        status: "READY",
        form_data: hfields,
        transcript: chunkText,
        requested_in_facility_id: facilityId || "",
        requested_in_encounter_id: encounterId || "",
      });
      if (isAbortedRef.current) return;

      const aiResponse = await poller(
        created.external_id,
        "ai_response",
        isAbortedRef,
      );
      if (!aiResponse || isAbortedRef.current) return;

      const cleaned = await cleanAIResponse(
        aiResponse as ScribeAIResponse,
        fields,
        { encounterId: encounterId!, currentUser: user!, currentTime },
      );
      if (isAbortedRef.current) return;

      Object.values(cleaned.meta.failed).forEach((errors) => {
        errors.forEach((err) => toast.error(err));
      });

      const suggestions = getFieldsToReview(cleaned.cleaned, fields);
      suggestions.forEach((s) => updateFieldValue(s, true, props.setFormState));

      queryClient.invalidateQueries({ queryKey: ["scribe-history"] });
    } catch (e) {
      console.error("Failed to process transcript chunk", e);
    }
  };

  const enqueueChunk = (chunkText: string) => {
    setPendingChunks((c) => c + 1);
    chunkQueueRef.current = chunkQueueRef.current
      .then(() => processTranscriptChunk(chunkText))
      .finally(() => setPendingChunks((c) => Math.max(0, c - 1)));
    return chunkQueueRef.current;
  };

  const flushPendingChunk = (immediate = false) => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    const full = liveTranscript;
    const delta = full.slice(processedLengthRef.current).trim();
    if (!delta) return;
    processedLengthRef.current = full.length;
    if (immediate) {
      return enqueueChunk(delta);
    }
    enqueueChunk(delta);
  };

  // Watch the live transcript and process chunks once it stabilizes briefly,
  // or when sentence-ending punctuation is reached.
  useEffect(() => {
    if (status !== "RECORDING") return;
    if (!liveTranscript) return;
    const delta = liveTranscript.slice(processedLengthRef.current).trim();
    if (!delta) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const endsWithSentence = /[.!?\n]\s*$/.test(liveTranscript);
    const wait = endsWithSentence && delta.length >= 20 ? 500 : 1800;
    debounceRef.current = setTimeout(() => {
      const full = liveTranscript;
      const d = full.slice(processedLengthRef.current).trim();
      if (!d) return;
      processedLengthRef.current = full.length;
      enqueueChunk(d);
    }, wait);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [liveTranscript, status]);

  // Surface live transcription errors
  useEffect(() => {
    if (liveError) {
      toast.error(liveError);
    }
  }, [liveError]);

  // Mirror live transcript into local transcript display state
  useEffect(() => {
    if (status === "RECORDING") {
      setTranscript(liveTranscript);
    }
  }, [liveTranscript, status]);

  const uploadAndCompleteLiveSession = async (result: RecordingResult) => {
    const { sessionId, audioBlob, audioDuration, mimeType } = result;
    const baseMimeType = mimeType.split(";")[0];
    const extension = baseMimeType.split("/")[1] || "webm";

    try {
      const fileData = await API.scribe.createFileUpload({
        file_type: ScribeFileType.AUDIO,
        file_category: "AUDIO",
        name: `live_recording_${Date.now()}.${extension}`,
        original_name: `live_recording.${extension}`,
        associating_id: sessionId,
        mime_type: baseMimeType,
        length: audioDuration,
      });

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

      await API.scribe.editFileUpload(fileData.id, "SCRIBE_AUDIO", sessionId, {
        upload_completed: true,
      });
    } catch (err) {
      console.error("Failed to upload live recording", err);
    }

    try {
      await API.liveTranscription.complete({
        session_id: sessionId,
        transcript: result.transcript,
      });
    } catch (err) {
      console.error("Failed to complete live transcription session", err);
    }
  };

  const handleStartRecording = async () => {
    if (!quota.tncAccepted) {
      setShowTnc(true);
      return;
    }
    handleCancel();
    isAbortedRef.current = false;
    processedLengthRef.current = 0;
    chunkQueueRef.current = Promise.resolve();
    setPendingChunks(0);
    setTranscript("");
    setLastTranscript(undefined);

    try {
      // Snapshot the form state so cancel can restore it.
      setFormStateSnapshot(props.formState);
      await startLiveTranscription();
      timer.start();
      setStatus("RECORDING");
    } catch {
      toast.error(t("audio__permission_message"));
      setStatus("IDLE");
      setFormStateSnapshot(null);
    }
  };

  const handleStopRecording = async () => {
    setError(null);
    timer.stop();
    timer.reset();

    // Flush any pending chunk before stopping the stream.
    flushPendingChunk(true);

    let result: RecordingResult | null = null;
    try {
      result = await stopLiveTranscription();
    } catch (e) {
      console.error(e);
    }

    // Wait for queued chunk processing to complete before returning to idle.
    setStatus("THINKING");
    try {
      await chunkQueueRef.current;
    } catch (e) {
      console.error(e);
    }

    if (result) {
      const finalTranscript = result.transcript || liveTranscript;
      setLastTranscript(finalTranscript);
      setTranscript(finalTranscript);
      // Fire-and-forget: upload audio + close live session.
      uploadAndCompleteLiveSession(result).catch(console.error);
    }

    setStatus("IDLE");
    setFormStateSnapshot(null);
    processedLengthRef.current = 0;
  };

  const handleCancel = (
    status: ScribeStatus = "IDLE",
    loadSnapshot: boolean = true,
  ) => {
    isAbortedRef.current = true;
    if (formStateSnapshot && loadSnapshot) {
      props.setFormState(formStateSnapshot);
    }
    stopSegmentedRecording();
    if (isLiveRecording) {
      stopLiveTranscription().catch(console.error);
    }
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    processedLengthRef.current = 0;
    chunkQueueRef.current = Promise.resolve();
    setPendingChunks(0);
    setError(null);
    setFormStateSnapshot(null);
    timer.reset();
    setStatus(status);
    resetRecording();
    setToReview(undefined);
    setFiles([]);
    setTranscript(undefined);
    setLastTranscript(undefined);
    setScribe(null);
  };

  const handleProcessFile = async () => {
    if (!quota.tncAccepted) {
      setShowTnc(true);
      return;
    }
    setError(null);
    isAbortedRef.current = false;
    setStatus("UPLOADING");
    setError(null);
    const fields = getQuestionInputs(props.formState);
    const instanceId = scribe
      ? scribe.external_id
      : await createScribeInstance(fields);
    if (isAbortedRef.current) return;
    setInstanceId(instanceId);
    setStatus("TRANSCRIBING");
    const transcript = await getTranscript(
      instanceId,
      scribe ? fields : undefined,
    );
    if (isAbortedRef.current) return;
    setLastTranscript(transcript);
    setTranscript(transcript);
    setStatus("THINKING");
    const aiResponse = await getAIResponse(instanceId, fields);
    if (isAbortedRef.current) return;
    queryClient.invalidateQueries({ queryKey: ["scribe-history"] });
    if (!aiResponse) return;
    setStatus("REVIEWING");
    if (!formStateSnapshot) setFormStateSnapshot(props.formState);
    setToReview(getFieldsToReview(aiResponse, fields));
  };

  return (
    <>
      {/* placeholder */}
      <div className="h-10" />
      <div
        className={`fixed z-40 flex ${controllerPosition.includes("top") ? "top-5 flex-col-reverse" : "bottom-5 flex-col"} ${controllerPosition.includes("right") ? "right-5 items-end" : "left-5 items-start"} gap-4 transition-all`}
      >
        <div
          className={`${status === "IDLE" ? "max-h-0 opacity-0" : "max-h-[500px]"} w-full rounded-2xl ${status === "REVIEWING" && !(openEditTranscript || (toReview && !toReview.length)) ? "overflow-hidden" : "overflow-auto border border-neutral-300"} bg-white transition-all delay-100`}
        >
          {status === "ATTACHING" && (
            <FileUpload files={files} setFiles={setFiles} error={null} />
          )}
          {status === "RECORDING" && (
            <div className="flex w-full flex-col items-stretch gap-2 p-4 md:w-[300px]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                  </span>
                  <span className="text-sm font-semibold text-neutral-800">
                    {t("hearing")}
                  </span>
                </div>
                <div className="font-mono text-sm text-neutral-700">
                  {timer.time}
                </div>
              </div>
              <div className="max-h-40 min-h-[3rem] overflow-auto rounded-md border border-neutral-200 bg-neutral-50 p-2 text-xs text-neutral-800">
                {liveTranscript || (
                  <span className="text-neutral-400">
                    {t("copilot_thinking")}
                  </span>
                )}
              </div>
              {pendingChunks > 0 && (
                <div className="text-[10px] text-neutral-500">
                  {t("copilot_thinking")}
                </div>
              )}
            </div>
          )}
          {(openEditTranscript || !toReview?.length) &&
            status !== "RECORDING" &&
            status !== "ATTACHING" && (
              <>
                {files.length > 0 && (
                  <div className="p-4 pb-0">
                    <div className="flex max-w-[300px] flex-wrap items-center justify-center gap-2">
                      {files.map((file, index) => (
                        <Link
                          href={URL.createObjectURL(file)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="relative rounded-md shadow-md"
                          key={index}
                        >
                          <img
                            src={URL.createObjectURL(file)}
                            alt="uploaded"
                            className="h-10 w-10 rounded-md object-cover"
                          />
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
                {audioBlobs.length > 0 && (
                  <div className="px-4 pt-2">
                    <audio controls className="plain-audio w-full">
                      {audioBlobs.map((blob, index) => (
                        <source
                          key={index}
                          src={URL.createObjectURL(blob)}
                          type="audio/mpeg"
                        />
                      ))}
                    </audio>
                  </div>
                )}
              </>
            )}
          {(status === "TRANSCRIBING" ||
            status === "UPLOADING" ||
            status === "THINKING") && (
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-32">
                <Lottie animationData={animationData} loop autoPlay />
              </div>
              <div className="-translate-y-4 text-sm text-neutral-700">
                {status === "UPLOADING"
                  ? t("uploading_file")
                  : t("copilot_thinking")}
              </div>
            </div>
          )}
          {typeof lastTranscript !== "undefined" &&
            status === "REVIEWING" &&
            (openEditTranscript || (!!toReview && !toReview.length)) && (
              <div className="p-4 pt-0 md:w-[300px]">
                {!!toReview && !toReview.length && (
                  <p className="mb-4 text-sm font-bold text-red-500">
                    {t("could_not_autofill")}
                  </p>
                )}

                <div className="text-base font-semibold">
                  {t("transcript_information")}
                </div>

                <p className="mb-4 text-xs text-neutral-800">
                  {t("transcript_edit_info")}
                </p>
                <Textarea
                  name="transcript"
                  disabled={status !== "REVIEWING" || files.length > 0}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="h-20 resize-y"
                  // errorClassName="hidden"
                  placeholder="Transcript"
                />
                {typeof lastTranscript !== "undefined" &&
                  status === "REVIEWING" &&
                  devMode &&
                  scribe?.meta && <MetaInformation meta={scribe.meta} />}

                <Button
                  className="mt-4 w-full"
                  onClick={() =>
                    !files.length
                      ? transcript !== lastTranscript
                        ? !!transcript && handleUpdateTranscript(transcript)
                        : handleStopRecording()
                      : handleProcessFile()
                  }
                >
                  {t("process_transcript")}
                </Button>

                {!(toReview && !toReview.length) && (
                  <button
                    className={`absolute ${controllerPosition.includes("top") ? "-bottom-6" : "-top-6"} right-4 cursor-pointer text-xs text-neutral-100 hover:text-neutral-200`}
                    onClick={() => setOpenEditTranscript(false)}
                  >
                    {t("close")}
                  </button>
                )}
              </div>
            )}
          {status === "FAILED" && (
            <div className="flex flex-col items-center justify-between gap-4 p-4 pt-1 text-red-500">
              <div className="flex max-w-54 flex-col items-center justify-center gap-4 py-4 text-center">
                <CrossCircledIcon className="h-8 w-8" />
                {error || t("scribe_error")}
                {meta?.error && (
                  <pre className="max-h-20 w-52 overflow-auto rounded-md bg-red-100 p-2 text-xs break-words whitespace-pre-wrap text-red-500">
                    {meta?.error}
                  </pre>
                )}
              </div>

              <Button
                className="w-full"
                onClick={
                  files.length > 0 ? handleProcessFile : handleStopRecording
                }
              >
                {t("retry")}
              </Button>
            </div>
          )}
        </div>

        {typeof lastTranscript !== "undefined" &&
          status === "REVIEWING" &&
          !(openEditTranscript || (toReview && !toReview.length)) && (
            <button
              onClick={() => setOpenEditTranscript(true)}
              className="flex max-h-[50px] w-40 cursor-pointer items-center gap-2 overflow-hidden rounded-lg bg-black/20 p-2 text-left text-xs text-white transition-all hover:bg-black/40 md:max-h-[100px]"
            >
              <div>{transcript}</div>
              <ChevronUpIcon className="text-xl" />
            </button>
          )}

        <div
          className={twMerge(
            "flex items-center gap-2",
            controllerPosition.includes("left") && "flex-row-reverse",
          )}
        >
          <ControllerDropDownMenu
            onUseScribe={async (scribe) => {
              isAbortedRef.current = false;
              setStatus("THINKING");
              const fields = getQuestionInputs(props.formState);
              const airesponse = await getAIResponse(
                scribe.external_id,
                fields,
                false,
              );
              if (!airesponse) return;
              setFormStateSnapshot(props.formState);
              setToReview(getFieldsToReview(airesponse, fields));
              setScribe(scribe);
              setStatus("REVIEWING");
              setLastTranscript(scribe.transcript || "");
              setTranscript(scribe.transcript || "");
              setInstanceId(scribe.external_id);
            }}
          />

          {[
            "REVIEWING",
            "ATTACHING",
            "RECORDING",
            "TRANSCRIBING",
            "THINKING",
            "FAILED",
          ].includes(status) && (
            <button
              onClick={() => handleCancel()}
              className="flex aspect-square h-full cursor-pointer items-center justify-center rounded-full border border-neutral-300 bg-neutral-200 p-4 text-xl transition-all hover:bg-neutral-300"
              title={t("cancel")}
            >
              <Cross1Icon />
            </button>
          )}
          {status === "IDLE" && quota.quotas?.some((q) => q.allow_ocr) && (
            <button
              onClick={() => setStatus("ATTACHING")}
              className="flex aspect-square h-full cursor-pointer items-center justify-center rounded-full border border-neutral-300 bg-neutral-200 p-4 text-xl transition-all hover:bg-neutral-300"
            >
              <ImageIcon />
            </button>
          )}
          <ScribeButton
            files={files}
            status={status}
            onClick={
              status === "ATTACHING"
                ? handleProcessFile
                : files.length > 0
                  ? () => handleCancel("ATTACHING")
                  : status !== "RECORDING"
                    ? handleStartRecording
                    : handleStopRecording
            }
            disabled={status === "ATTACHING" && files.length === 0}
          />
        </div>
      </div>
      {!!toReview && !!toReview.length && (
        <ScribeReview
          {...props}
          toReview={toReview}
          onReviewComplete={async (approvedFields) => {
            if (approvedFields.some((a) => a.approved))
              toast.success(t("autofilled_fields"));
            handleCancel("IDLE", false);
          }}
          onProcessAgain={handleStopRecording}
          scribe={scribe || undefined}
        />
      )}

      <TncDialog
        open={showTnc}
        onOpenChange={setShowTnc}
        tnc={quota.tnc}
        onAccept={quota.acceptTnc}
      />
    </>
  );
}
