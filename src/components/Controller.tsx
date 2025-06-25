import { useEffect, useRef, useState } from "react";
import {
  ScribeAIResponse,
  ScribeFieldSuggestion,
  ScribeFileType,
  ScribeHydratedAndRawField,
  ScribeHydratedField,
  ScribeHydratedQuestionnaire,
  ScribeModel,
  ScribeQuestionnaire,
  ScribeStatus,
} from "../types";
import {
  getFieldsToReview,
  getHydratedFields,
  getQuestionInputs,
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
import uploadFile from "@/utils/uploadFile";
import useSegmentedRecording from "@/hooks/useSegmentedRecorder";
import { useTimer } from "@/hooks/useTimer";
import { useTranslation } from "react-i18next";
import { usePath } from "raviger";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
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
  enableStatisticsAtom,
  containerRefAtom,
} from "@/store";
import { twMerge } from "tailwind-merge";
import HistorySheet from "./History";
import { useQueryClient } from "@tanstack/react-query";
import structures from "@/utils/structures";
import { toast } from "sonner";

function MetaInformation(props: { meta: ScribeModel["meta"] }) {
  const info = {
    "Audio Model": props.meta.audio_model,
    "Chat Model": props.meta.chat_model,
    Provider: props.meta.provider,
    "Input Tokens": props.meta.iterations?.reduce(
      (acc, curr) => acc + (curr.completion_input_tokens || 0),
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
  const { t } = useTranslation(I18NNAMESPACE);
  const [transcript, setTranscript] = useState<string>();
  const timer = useTimer();
  const [lastTranscript, setLastTranscript] = useState<string>();
  const [instanceId, setInstanceId] = useState<string>();
  const [toReview, setToReview] = useState<ScribeFieldSuggestion[]>();
  const [openEditTranscript, setOpenEditTranscript] = useState(false);
  const [currentMic, setCurrentMic] = useAtom(microphoneAtom);
  const [enableStatistics, setEnableStatistics] = useAtom(enableStatisticsAtom);
  const [fetchMicrophones, setFetchMicrophones] = useState(false);
  const { microphones, error: micError } = useMicrophones(!fetchMicrophones);
  const [controllerPosition] = useAtom(controllerPositionAtom);
  const [scribe, setScribe] = useState<ScribeModel | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const path = usePath();
  const [historySheetOpen, setHistorySheetOpen] = useState(false);
  const [containerRef] = useAtom(containerRefAtom);
  const isAbortedRef = useRef(false);
  const [formStateSnapshot, setFormStateSnapshot] =
    useState<typeof props.formState>(null);
  const queryClient = useQueryClient();
  const facilityId = path?.includes("/facility/")
    ? path.split("/facility/")[1].split("/")[0]
    : undefined;

  const encounterId = path?.includes("/encounter/")
    ? path.split("/encounter/")[1].split("/")[0]
    : undefined;
  const featureFlags = useFeatureFlags(facilityId);

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
      // run type validations
      const changedData = (
        (await Promise.all(
          Object.entries(aiResponse).map(async ([k, v]) => {
            // Recursively find a field by id in nested hydrated fields
            const findFieldById = (
              fieldsArr: any[],
              id: string,
            ): ScribeHydratedAndRawField | undefined => {
              for (const field of fieldsArr) {
                if ("id" in field && field.id === id) return field;
                if ("fields" in field && Array.isArray(field.fields)) {
                  const found = findFieldById(field.fields, id);
                  if (found) return found;
                }
              }
              return undefined;
            };
            const field = findFieldById(hfields, k);
            if (!field) return [k, null];

            const structure = field.structuredType
              ? structures[field.structuredType as keyof typeof structures]
              : null;
            let deserializedValue = v;
            let note: string | undefined;

            if (structure) {
              const deserialized = await structure.deserialize(
                v as any,
                field.current as any,
              );
              deserializedValue = deserialized.data;
              deserialized.errors?.forEach((error) => {
                toast.error(error);
              });
            } else {
              deserializedValue = (v as any).value;
              note = (v as any).note;
            }

            if (
              JSON.stringify(deserializedValue) ===
              JSON.stringify(field.current)
            ) {
              console.error(
                "No changes detected for field",
                k,
                "with value",
                deserializedValue,
              );
              return [k, null];
            }

            if (
              field.question.structured_type &&
              field.question.structured_type !== "encounter"
            ) {
              const validation = structure?.toolStructure.safeParse(v);
              if (!validation?.success) {
                console.error("Validation error", v, validation?.error);
                return [k, null];
              }
            }
            return [
              k,
              {
                value: deserializedValue,
                note,
              },
            ];
          }),
        )) as Array<[string, { value: any; note?: string } | null]>
      )
        .filter(([, output]) => !!output?.value)
        .map(([k, v]) => ({ [k as string]: v }))
        .reduce((acc, curr) => ({ ...acc, ...curr }), {});

      return changedData as ScribeAIResponse;
    } catch (e) {
      console.error(e);
      setStatus("FAILED");
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

  // Uploads a scribe audio blob. Returns the response of the upload.
  const uploadScribeFile = async (
    blob: Blob,
    scribeInstanceId: string,
    type: ScribeFileType,
  ) => {
    const category = type === ScribeFileType.AUDIO ? "AUDIO" : "UNSPECIFIED";
    const extension = blob?.type?.split("/")?.[1].split(";")?.[0];
    const name = "file" + (extension ? `.${extension}` : "");
    const filename = Date.now().toString();

    const data = await API.scribe.createFileUpload({
      original_name: name,
      file_type: type,
      name: filename,
      associating_id: scribeInstanceId,
      file_category: category,
      mime_type: blob?.type?.split(";")?.[0],
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
        null,
        reject,
      );
    });

    return await API.scribe.editFileUpload(
      data.id,
      type === ScribeFileType.AUDIO ? "SCRIBE_AUDIO" : "SCRIBE_DOCUMENT",
      scribeInstanceId,
      { upload_completed: true },
    );
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

  const handleCancel = (loadSnapshot: boolean = true) => {
    isAbortedRef.current = true;
    if (formStateSnapshot && loadSnapshot) {
      props.setFormState(formStateSnapshot);
    }
    setFormStateSnapshot(null);
    timer.reset();
    setStatus("IDLE");
    resetRecording();
    setToReview(undefined);
    setFiles([]);
    setTranscript(undefined);
    setLastTranscript(undefined);
    setScribe(null);
  };

  const handleProcessFile = async () => {
    setStatus("UPLOADING");
    const fields = getQuestionInputs(props.formState);
    const instanceId = await createScribeInstance(fields);
    setInstanceId(instanceId);
    setStatus("TRANSCRIBING");
    const transcript = await getTranscript(instanceId);
    setLastTranscript(transcript);
    setTranscript(transcript);
    setStatus("THINKING");
    const aiResponse = await getAIResponse(instanceId, fields);
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
          className={`${status === "IDLE" ? "max-h-0 opacity-0" : "max-h-[500px]"} w-full overflow-hidden rounded-2xl ${status === "REVIEWING" && !(openEditTranscript || (toReview && !toReview.length)) ? "" : "border border-neutral-300"} bg-white transition-all delay-100`}
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
          {(status === "TRANSCRIBING" ||
            status === "UPLOADING" ||
            status === "THINKING") && (
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="w-32">
                <Lottie animationData={animationData} loop autoPlay />
              </div>
              <div className="-translate-y-4 text-sm text-neutral-700">
                {t("copilot_thinking")}
              </div>
            </div>
          )}
          {typeof lastTranscript !== "undefined" &&
            status === "REVIEWING" &&
            (openEditTranscript || (!!toReview && !toReview.length)) && (
              <div className="p-4 md:w-[300px]">
                {!!toReview && !toReview.length && (
                  <p className="mb-4 text-sm font-bold text-red-500">
                    {t("could_not_autofill")}
                  </p>
                )}
                {audioBlobs.length > 0 && (
                  <div className="mb-4">
                    <div className="rounded border border-neutral-300 bg-neutral-200">
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
                    <Button
                      className="mt-2 w-full"
                      onClick={handleStopRecording}
                    >
                      {t("transcribe_again")}
                    </Button>
                  </div>
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
                  className="h-20 resize-none"
                  // errorClassName="hidden"
                  placeholder="Transcript"
                />
                {typeof lastTranscript !== "undefined" &&
                  status === "REVIEWING" &&
                  enableStatistics &&
                  scribe?.meta && <MetaInformation meta={scribe.meta} />}
                <Button
                  // loading={status !== "REVIEWING"}
                  disabled={transcript === lastTranscript && !files.length}
                  className="mt-4 w-full"
                  onClick={() =>
                    transcript && handleUpdateTranscript(transcript)
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
            <div className="flex flex-col items-center justify-between gap-4 p-4 text-red-500">
              <div className="flex flex-col items-center justify-center gap-4 py-4">
                <CrossCircledIcon className="h-8 w-8" />
                {t("scribe_error")}
                {enableStatistics && scribe?.meta.error && (
                  <pre className="max-h-20 w-52 overflow-auto rounded-md bg-red-100 p-2 text-xs break-words whitespace-pre-wrap text-red-500">
                    {scribe?.meta.error}
                  </pre>
                )}
              </div>
              <Button className="w-full" onClick={handleStopRecording}>
                {t("transcribe_again")}
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
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={enableStatistics}
                  onCheckedChange={(checked) => {
                    setEnableStatistics(checked);
                  }}
                >
                  {t("developer_mode")}
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {[
            "REVIEWING",
            "ATTACHING",
            "RECORDING",
            "TRANSCRIBING",
            "THINKING",
          ].includes(status) && (
            <button
              onClick={() => handleCancel()}
              className="flex aspect-square h-full cursor-pointer items-center justify-center rounded-full border border-neutral-300 bg-neutral-200 p-4 text-xl transition-all hover:bg-neutral-300"
              title={t("cancel")}
            >
              <Cross1Icon />
            </button>
          )}
          {status === "IDLE" && featureFlags.includes("SCRIBE_OCR_ENABLED") && (
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
                  ? () => setStatus("ATTACHING")
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
            handleCancel(false);
          }}
        />
      )}
      <HistorySheet
        open={historySheetOpen}
        setOpen={setHistorySheetOpen}
        onUseScribe={async (scribe) => {
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
    </>
  );
}
