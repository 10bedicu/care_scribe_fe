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
  cleanAIResponse,
  getFieldsToReview,
  getHydratedFields,
  getQuestionInputs,
  uploadScribeFile,
} from "../utils/utils";
import {
  ChevronUpIcon,
  Cross1Icon,
  CrossCircledIcon,
  DotsVerticalIcon,
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
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { useMicrophones } from "@/hooks/useMicrophone";
import { useAtom } from "jotai/react";
import {
  controllerPositionAtom,
  microphoneAtom,
  devModeAtom,
  containerRefAtom,
} from "@/store";
import { twMerge } from "tailwind-merge";
import HistorySheet from "./History";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useQuota } from "@/hooks/useQuota";
import useAuthUser from "@/hooks/useAuthUser";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";

function MetaInformation(props: { meta: ScribeModel["meta"] }) {
  const info = {
    "Audio Model": props.meta.audio_model,
    "Chat Model": props.meta.chat_model,
    Provider: props.meta.provider,
    "Input Tokens": props.meta.iterations?.reduce(
      (acc, curr) => acc + (curr.completion_input_tokens || 0),
      0,
    ),
    "Cached Tokens": props.meta.iterations?.reduce(
      (acc, curr) => acc + (curr.completion_cached_tokens || 0),
      0,
    ),
    "Output Tokens": props.meta.iterations?.reduce(
      (acc, curr) => acc + (curr.completion_output_tokens || 0),
      0,
    ),
    "Transcription Time":
      props.meta.iterations
        ?.reduce((acc, curr) => acc + (curr.transcription_time || 0), 0)
        .toFixed(2) + "s",
    "Completion Time":
      props.meta.iterations
        ?.reduce((acc, curr) => acc + (curr.completion_time || 0), 0)
        .toFixed(2) + "s",
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
  const [currentMic, setCurrentMic] = useAtom(microphoneAtom);
  const [devMode, setEnableStatistics] = useAtom(devModeAtom);
  const [fetchMicrophones, setFetchMicrophones] = useState(false);
  const { microphones, error: micError } = useMicrophones(!fetchMicrophones);
  const [controllerPosition] = useAtom(controllerPositionAtom);
  const [scribe, setScribe] = useState<ScribeModel | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const path = usePath();
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [containerRef] = useAtom(containerRefAtom);
  const isAbortedRef = useRef(false);
  const user = useAuthUser();
  const [formStateSnapshot, setFormStateSnapshot] =
    useState<typeof props.formState>(null);
  const queryClient = useQueryClient();
  const facilityId = path?.includes("/facility/")
    ? path.split("/facility/")[1].split("/")[0]
    : undefined;

  const [showTnc, setShowTnc] = useState(false);

  const encounterId = path?.includes("/encounter/")
    ? path.split("/encounter/")[1].split("/")[0]
    : undefined;
  const quota = useQuota(facilityId);

  const {
    startRecording: startSegmentedRecording,
    stopRecording: stopSegmentedRecording,
    resetRecording,
    audioBlobs,
    setAudioBlobs,
  } = useSegmentedRecording();

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

  // Keeps polling the scribe endpoint to check if transcript or ai response has been generated
  async function poller(
    scribeInstanceId: string,
    type: "transcript",
  ): Promise<string>;
  async function poller(
    scribeInstanceId: string,
    type: "ai_response",
  ): Promise<ScribeModel["ai_response"]>;
  async function poller(
    scribeInstanceId: string,
    type: "transcript" | "ai_response",
  ): Promise<string | ScribeModel["ai_response"]> {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const res = await API.scribe.get(scribeInstanceId);
          if (isAbortedRef.current) {
            clearInterval(interval);
            return resolve(null);
          }
          setScribe(res);
          const { status, transcript, ai_response } = res;
          if (status === "FAILED" || status === "REFUSED") {
            clearInterval(interval);
            return reject(new Error("Transcription failed"));
          }

          if (
            type === "transcript" &&
            ["GENERATING_AI_RESPONSE", "COMPLETED"].includes(status) &&
            transcript !== null
          ) {
            clearInterval(interval);
            return resolve(transcript);
          }

          if (
            type === "ai_response" &&
            status === "COMPLETED" &&
            ai_response !== null
          ) {
            clearInterval(interval);
            return resolve(ai_response);
          }
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      }, 2000);
    });
  }

  // gets the AI response and returns only the data that has changes
  const getAIResponse = async (
    scribeInstanceId: string,
    questionnaire: ScribeQuestionnaire[],
  ) => {
    try {
      const hfields = getHydratedFields(questionnaire, false);
      if (!hfields || !hfields.length) {
        return;
      }
      const aiResponse = await poller(scribeInstanceId, "ai_response");
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
      );

      Object.values(cleaned.meta.failed).forEach((errors) => {
        errors.forEach((error) => {
          toast.error(error);
        });
      });

      updateProcessedResponse(scribeInstanceId, cleaned.meta);
      return cleaned.cleaned as ScribeAIResponse;
    } catch (e) {
      console.error(e);
      setStatus("FAILED");
    }
  };

  const updateProcessedResponse = async (
    scribeInstanceId: string,
    processedResponse: ScribeModel["meta"]["processed_ai_response"],
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
      const transcript = await poller(scribeInstanceId, "transcript");
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
      // prompt: "..."
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

  const handleStartRecording = async () => {
    if (!quota.tncAccepted) {
      setShowTnc(true);
      return;
    }
    handleCancel();
    isAbortedRef.current = true;

    try {
      await startSegmentedRecording();
      timer.start();
      setStatus("RECORDING");
    } catch {
      toast.error(t("audio__permission_message"));
      setStatus("IDLE");
    }
  };

  const handleStopRecording = async () => {
    setError(null);
    isAbortedRef.current = false;
    setToReview(undefined);
    timer.stop();
    timer.reset();
    setStatus("UPLOADING");
    stopSegmentedRecording();

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

  const handleCancel = (
    status: ScribeStatus = "IDLE",
    loadSnapshot: boolean = true,
  ) => {
    isAbortedRef.current = true;
    if (formStateSnapshot && loadSnapshot) {
      props.setFormState(formStateSnapshot);
    }
    stopSegmentedRecording();
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
            <div className="flex items-center justify-center p-4 py-10">
              <div className="text-center">
                <div className="text-xl font-black">{timer.time}</div>
                <p>{t("hearing")}</p>
              </div>
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
                {scribe?.meta.error && (
                  <pre className="max-h-20 w-52 overflow-auto rounded-md bg-red-100 p-2 text-xs break-words whitespace-pre-wrap text-red-500">
                    {scribe?.meta.error}
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
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button className="flex aspect-square w-6 items-center justify-center rounded-lg text-sm transition-all hover:bg-black/10">
                {/* Ellipsis Icon*/}
                <DotsVerticalIcon className="text-xl" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48"
              portalProps={{ container: containerRef?.current }}
            >
              <DropdownMenuGroup>
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger
                    onMouseOver={() => setFetchMicrophones(true)}
                  >
                    {t("microphone")}
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    {micError ? (
                      <p className="px-4 py-2 text-sm text-red-500">
                        {t("audio__permission_message")}
                      </p>
                    ) : (
                      <DropdownMenuRadioGroup
                        value={currentMic || undefined}
                        onValueChange={(v) => {
                          setCurrentMic(v);
                        }}
                      >
                        {microphones.map((mic) => (
                          <DropdownMenuRadioItem
                            key={mic.deviceId}
                            value={mic.deviceId}
                          >
                            {mic.label}
                          </DropdownMenuRadioItem>
                        ))}
                      </DropdownMenuRadioGroup>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
                <DropdownMenuItem onClick={() => setHistorySheetOpen(true)}>
                  {t("history")}
                </DropdownMenuItem>
                {user?.is_superuser && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuCheckboxItem
                      checked={devMode}
                      onCheckedChange={(checked) => {
                        setEnableStatistics(checked);
                      }}
                    >
                      {t("developer_mode")}
                    </DropdownMenuCheckboxItem>
                  </>
                )}
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

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
      <HistorySheet
        open={historySheetOpen}
        setOpen={setHistorySheetOpen}
        onUseScribe={async (scribe) => {
          isAbortedRef.current = false;
          setStatus("THINKING");
          const fields = getQuestionInputs(props.formState);
          const airesponse = await getAIResponse(scribe.external_id, fields);
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
      <Dialog open={showTnc} onOpenChange={setShowTnc}>
        <DialogContent portalProps={{ container: containerRef?.current }}>
          <DialogHeader>
            <DialogTitle>{t("terms_and_conditions")}</DialogTitle>
            <DialogDescription>
              {t("terms_and_conditions_description")}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-auto rounded-md bg-neutral-50 p-2 text-sm">
            <div
              className="reset-tw"
              style={{
                wordBreak: "normal",
                wordWrap: "normal",
                whiteSpace: "pre-line",
              }}
              dangerouslySetInnerHTML={{
                __html: quota.tnc || "LOADING...",
              }}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={async () => {
                quota.acceptTnc();
                setShowTnc(false);
              }}
            >
              {t("accept")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
