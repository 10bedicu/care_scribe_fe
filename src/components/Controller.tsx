import { useRef, useState } from "react";
import {
  ScribeField,
  ScribeFieldSuggestion,
  ScribeFileType,
  ScribeModel,
  ScribeStatus,
  VALUESET_SYSTEM_NAMES,
} from "../types";
import {
  getFieldsToReview,
  getQuestionInputs,
  replaceCodeSearchQueriesInObjectAsync,
} from "../utils/utils";
import {
  SCRIBE_PROMPT_MAP,
  SCRIBE_REPEAT_PROMPT_MAP,
  STRUCTURED_INPUT_PROMPTS,
} from "@/utils/prompts";
import {
  ChevronUpIcon,
  Cross1Icon,
  CrossCircledIcon,
  DotsVerticalIcon,
  ImageIcon,
} from "@radix-ui/react-icons";
import { printNode, zodToTs } from "zod-to-ts";
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
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";
import { usePath } from "raviger";
import { useFeatureFlags } from "@/hooks/useFeatureFlags";
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "./ui/dropdown-menu";
import { useMicrophones } from "@/hooks/useMicrophone";
import { useAtom } from "jotai/react";
import { controllerPositionAtom, microphoneAtom, enableStatisticsAtom } from "@/store";
import { twMerge } from "tailwind-merge";

export function Controller(props: {
  formState: unknown;
  setFormState: unknown;
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
  const { microphones, error: micError } = useMicrophones();
  const [controllerPosition] = useAtom(controllerPositionAtom);
  const [scribe, setScribe] = useState<ScribeModel | null>(null);
  const [files, setFiles] = useState<File[]>([]);
  const path = usePath();
  const menuRef = useRef<HTMLButtonElement>(null);
  const facilityId = path?.includes("/facility/")
  ? path.split("/facility/")[1].split("/")[0]
  : undefined;
  const featureFlags = useFeatureFlags(facilityId);

  //Use this to test scribe
  const SCRIBE_TEST_INPUT = `The patient's encounter status is currently on hold, classified as an emergency with a priority of “as needed,” 
  under hospital identifier 245. The patient was admitted from a nursing home with a diet preference of vegetarian. The care team consists of physical therapists, 
  and the encounter started yesterday at 12 a.m., ending today at 5 p.m. The care plan focuses on stabilizing the patient's blood pressure, 
  with a follow-up frequency of two times weekly. The next visit is scheduled for January 3, 2025. 
  The patient's current vital signs indicate a systolic blood pressure of 20, diastolic blood pressure of 40, pulse of 84, SpO2 at 78%, 
  and a blood sugar level of 59. Pain is reported as mild, and the patient is bed-bound, unable to move.
  An acute symptom of left-sided ulcerative colitis has been added, with differential verification, moderate severity, beginning yesterday. 
  Update the existing symptom's verification to confirmed, and all existing diagnoses should be removed. Nurse John Doe is filling the allergy intolerance form.
  A resolved allergy to isomaltose has been detected.`;

  const {
    startRecording: startSegmentedRecording,
    stopRecording: stopSegmentedRecording,
    resetRecording,
    audioBlobs,
  } = useSegmentedRecording();

  const { toast } = useToast();

  // Keeps polling the scribe endpoint to check if transcript or ai response has been generated
  const poller = async (
    scribeInstanceId: string,
    type: "transcript" | "ai_response",
  ): Promise<string> => {
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const res = await API.scribe.get(scribeInstanceId);
          setScribe(res);
          const { status, transcript, ai_response } = res;

          if (status === "FAILED" || status === "REFUSED") {
            toast({ title: "Transcription failed", variant: "destructive" });
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

          // return reject(new Error(`Failed to resolve response`));
        } catch (error) {
          clearInterval(interval);
          reject(error);
        }
      }, 2000);
    });
  };

  // gets the AI response and returns only the data that has changes
  const getAIResponse = async (
    scribeInstanceId: string,
    fields: ScribeField[],
  ) => {
    try {
      const hfields = await getHydratedFields(fields);
      const updatedFieldsResponse = await poller(
        scribeInstanceId,
        "ai_response",
      );
      const parsedFormData = JSON.parse(updatedFieldsResponse ?? "{}");
      const scribeTranscription = parsedFormData.__scribe__transcription;
      if (scribeTranscription && files.length !== 0) {
        setTranscript(scribeTranscription);
      }
      // run type validations
      const changedData = Object.entries(parsedFormData)
        .map(([k, v]) => {
          const f = hfields.find((f) => f.id === k);
          const ogF = fields.find((_, i) => i === Number(f?.id));
          if (!f) return [k, null];
          if (v === f.current) return [k, null];
          if (
            ogF?.question.structured_type &&
            ogF.question.structured_type !== "encounter"
          ) {
            const prompt =
              STRUCTURED_INPUT_PROMPTS[
                ogF.question
                  .structured_type as keyof typeof STRUCTURED_INPUT_PROMPTS
              ].prompt;

            let parsedV = v;
            let jsonParsed = false;

            try {
              parsedV = JSON.parse(v as string);
              jsonParsed = true;
            } catch (error) {
              parsedV = v;
            }
            const validation = prompt(true).safeParse(parsedV);
            if (!validation.success) {
              console.error("Validation error", parsedV, validation.error);
              return [k, null];
            } else {
              return [
                k,
                jsonParsed ? JSON.stringify(validation.data) : validation.data,
              ];
            }
          }
          return [k, v];
        })
        .filter(([, v]) => !!v)
        .map(([k, v]) => ({ [k as string]: v }))
        .reduce((acc, curr) => ({ ...acc, ...curr }), {});
      const replacedData = await Promise.all(
        Object.entries(changedData).map(async ([index, data]) => {
          let parsedData;
          try {
            parsedData = JSON.parse(data as string);
          } catch (e) {
            parsedData = data;
          }

          const replacedData =
            await replaceCodeSearchQueriesInObjectAsync(parsedData);

            replacedData.noMatches
              .filter((m) => m.primary === true)
              .forEach((m) => {
                toast({
                  title: t("scribe_no_match", {
                    valueType:
                      VALUESET_SYSTEM_NAMES[m.code_search_type].toLowerCase(),
                    query: m.code_search_query,
                  }),
                  variant: "destructive",
                });
              });
          
          let transformed = replacedData.transformed;
          console.log(transformed);
          if (Array.isArray(replacedData.transformed)) {
            transformed = replacedData.transformed.map((item) => {
              if (typeof item === "object" && item !== null) {
                // if any key in the object contains "CODE_NOT_FOUND", return null
                if (Object.values(item).includes("CODE_NOT_FOUND")) {
                  return null;
                }
              }
              return item;
            });
            transformed = transformed?.filter((item : any) => item !== null);
          }
          console.log(transformed)

          return { index, data: JSON.stringify(transformed) };
        }),
      );

      const replacedDataMap = replacedData.reduce(
        (acc, curr) => (curr ? { ...acc, [curr.index]: curr.data } : acc),
        {},
      );

      return replacedDataMap;
    } catch (e) {
      console.error(e);
      toast({ title: t("scribe_error"), variant: "destructive" });
      setStatus("FAILED");
    }
  };

  // gets the audio transcription
  const getTranscript = async (scribeInstanceId: string) => {
    try {
      await API.scribe.update(scribeInstanceId, {
        status: "READY",
        requested_in_facility_id: facilityId || "",
      });
      const transcript = await poller(scribeInstanceId, "transcript");
      setLastTranscript(transcript);
      setTranscript(transcript);
      return transcript;
    } catch (error) {
      toast({ title: t("scribe_error"), variant: "destructive" });
      setStatus("FAILED");
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
  const createScribeInstance = async (fields: ScribeField[]) => {
    const hfields = await getHydratedFields(fields);
    const data = await API.scribe.create({
      status: "CREATED",
      form_data: hfields as any,
      requested_in_facility_id: facilityId || "",
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

  const getHydratedFields = async (fields: ScribeField[]) => {
    return fields.map((field, i) => {
      const structuredType = field.question.structured_type;

      const structuredPrompt =
        structuredType &&
        Object.keys(STRUCTURED_INPUT_PROMPTS).includes(structuredType)
          ? STRUCTURED_INPUT_PROMPTS[
              structuredType as keyof typeof STRUCTURED_INPUT_PROMPTS
            ]
          : undefined;

      const promptMap = field.question.repeats
        ? SCRIBE_REPEAT_PROMPT_MAP
        : SCRIBE_PROMPT_MAP;

      let structuredPromptText = structuredPrompt
        ? `A structure of type ${printNode(zodToTs(structuredPrompt.prompt()).node)}. Update existing data, delete existing data or append to the existing list as per the will of the user. NOTE: Make sure not to discard existing data until explicitly said so. Current datetime is ${new Date().toISOString()}`
        : undefined;

      return {
        friendlyName: field.question.text || "Unlabled Field",
        current: field.value,
        id: `${i}`,
        description:
          (structuredPrompt ? structuredPromptText : undefined) ||
          promptMap[field.question.type]?.prompt ||
          promptMap["default"]?.prompt,
        type: typeof (
          structuredPrompt?.example ||
          promptMap[field.question.type]?.example ||
          promptMap["default"]?.example
        ),
        example: JSON.stringify(
          structuredPrompt?.example ||
            promptMap[field.question.type]?.example ||
            promptMap["default"]?.example,
        ),
        options: field.question.answer_option?.map((opt) => ({
          id: opt.value,
          text: opt.value,
        })),
      };
    });
  };

  // updates the transcript and fetches a new AI response
  const handleUpdateTranscript = async (updatedTranscript: string) => {
    if (updatedTranscript === lastTranscript) return;
    if (!instanceId) throw Error("Cannot find scribe instance");
    setToReview(undefined);
    setLastTranscript(updatedTranscript);
    try {
      await API.scribe.update(instanceId, {
        status: "READY",
        transcript: updatedTranscript,
        requested_in_facility_id: facilityId || "",
        //ai_response: null,
      });
    } catch (error) {
      throw Error("Error updating Scribe Instance");
    }
    setStatus("THINKING");
    const fields = getQuestionInputs(props.formState);
    const aiResponse = await getAIResponse(instanceId, fields);
    if (!aiResponse) return;
    setStatus("REVIEWING");
    setToReview(getFieldsToReview(aiResponse, fields));
  };

  const handleStartRecording = async () => {
    setToReview(undefined);
    setScribe(null);
    resetRecording();
    try {
      await startSegmentedRecording();
      timer.start();
      setStatus("RECORDING");
    } catch (error) {
      toast({ title: t("audio__permission_message") });
      setStatus("IDLE");
    }
  };

  const handleStopRecording = async () => {
    timer.stop();
    timer.reset();
    setStatus("UPLOADING");
    stopSegmentedRecording();
    const fields = getQuestionInputs(props.formState);
    const instanceId = await createScribeInstance(fields);
    setInstanceId(instanceId);
    setStatus("TRANSCRIBING");
    await getTranscript(instanceId);
    setStatus("THINKING");
    const aiResponse = await getAIResponse(instanceId, fields);
    if (!aiResponse) return;
    setStatus("REVIEWING");
    setToReview(getFieldsToReview(aiResponse, fields));
  };

  const handleCancel = () => {
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
    await getTranscript(instanceId);
    setStatus("THINKING");
    const aiResponse = await getAIResponse(instanceId, fields);
    if (!aiResponse) return;
    setStatus("REVIEWING");
    setToReview(getFieldsToReview(aiResponse, fields));
  };

  return (
    <>
      {/* placeholder */}
      <div className="h-10" />
      <div
        className={`fixed z-40 flex ${controllerPosition.includes("top") ? "top-5 flex-col-reverse" : "bottom-5 flex-col"} ${controllerPosition.includes("right") ? "right-5 items-end" : "left-5 items-start"} gap-4 transition-all`}
      >
        {typeof lastTranscript !== "undefined" &&
          status === "REVIEWING" && enableStatistics && scribe?.meta && (
            <div className="w-60 rounded-lg bg-black/20 p-2 text-left text-[10px] text-white">
              {Object.entries(scribe?.meta).map(([key, value]) => (
                <div key={key}>
                  {key} : {key === "completion_time" && typeof value === "number" ? ((value * 1000).toFixed(2) + " ms") : value}
                </div>
              ))}
            </div>
          )}
        <div
          className={`${status === "IDLE" ? "max-h-0 opacity-0" : "max-h-[400px]"} w-full overflow-hidden rounded-2xl ${status === "REVIEWING" && !(openEditTranscript || (toReview && !toReview.length)) ? "" : "border-neutral-300 border"} bg-white transition-all delay-100`}
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
              <div className="text-neutral-700 -translate-y-4 text-sm">
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
                    <div className="border-neutral-300 bg-neutral-200 rounded border">
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
                <button
                  onClick={() => setTranscript(SCRIBE_TEST_INPUT)}
                  className="absolute left-2 top-2 hidden text-xs cursor-pointer"
                >
                  Test
                </button>
                <Textarea
                  name="transcript"
                  disabled={status !== "REVIEWING"}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="h-20 resize-none"
                  // errorClassName="hidden"
                  placeholder="Transcript"
                />
                <Button
                  // loading={status !== "REVIEWING"}
                  disabled={transcript === lastTranscript}
                  className="mt-4 w-full"
                  onClick={() =>
                    transcript && handleUpdateTranscript(transcript)
                  }
                >
                  {t("process_transcript")}
                </Button>
                {!(toReview && !toReview.length) && (
                  <button
                    className={`absolute ${controllerPosition.includes("top") ? "-bottom-6" : "-top-6"} right-4 text-xs text-neutral-100 hover:text-neutral-200 cursor-pointer`}
                    onClick={() => setOpenEditTranscript(false)}
                  >
                    {t("close")}
                  </button>
                )}
              </div>
            )}
          {status === "FAILED" && (
            <div className="flex flex-col items-center justify-center gap-4 px-4 py-10 text-red-500">
              <CrossCircledIcon className="h-8 w-8" />
              {t("scribe_error")}
            </div>
          )}
        </div>
        
        {typeof lastTranscript !== "undefined" &&
          status === "REVIEWING" &&
          !(openEditTranscript || (toReview && !toReview.length)) && (
            <button
              onClick={() => setOpenEditTranscript(true)}
              className="flex max-h-[50px] w-40 items-center gap-2 overflow-hidden rounded-lg bg-black/20 p-2 text-left text-xs text-white transition-all hover:bg-black/40 md:max-h-[100px] cursor-pointer"
            >
              <div>{transcript}</div>
              <ChevronUpIcon className="text-xl" />
            </button>
          )}
          
        <div className={twMerge("flex items-center gap-2", controllerPosition.includes("left") && "flex-row-reverse")}>
        
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  ref={menuRef}
                  className="flex items-center justify-center aspect-square w-6 text-sm hover:bg-black/10 transition-all rounded-lg"
                >
                  {/* Ellipsis Icon*/}
                  <DotsVerticalIcon className="text-xl" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" portalProps={{container: menuRef.current}}>
                <DropdownMenuGroup>
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger>
                      {t("microphone")}
                    </DropdownMenuSubTrigger>
                    {micError && (
                      <p className="px-4 py-2 text-sm text-red-500">
                        {t("audio__permission_message")}
                      </p>
                    )}
                      <DropdownMenuSubContent>
                      <DropdownMenuRadioGroup value={currentMic || undefined} onValueChange={(v) => {
                        setCurrentMic(v)
                      }}>
                        {microphones.map((mic) => (
                          <DropdownMenuRadioItem
                            key={mic.deviceId}
                            value={mic.deviceId}
                          >
                            {mic.label}
                          </DropdownMenuRadioItem>
                        ))}
                        </DropdownMenuRadioGroup>
                      </DropdownMenuSubContent>

                  </DropdownMenuSub>
                  {/* <DropdownMenuItem> // IDK if this is needed yet
                        History
                  </DropdownMenuItem> */}
                  <DropdownMenuSeparator/>
                  <DropdownMenuCheckboxItem
                    checked={enableStatistics}
                    onCheckedChange={(checked) => {
                      setEnableStatistics(checked);
                    }}
                  >
                  {t("enable_statistics")}
                </DropdownMenuCheckboxItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          
          {(status === "REVIEWING" || status === "ATTACHING") && (
            <button
              onClick={handleCancel}
              className="border-neutral-300 bg-neutral-200 hover:bg-neutral-300 flex aspect-square h-full items-center justify-center rounded-full border p-4 text-xl transition-all cursor-pointer"
              title={t("cancel")}
            >
              <Cross1Icon />
            </button>
          )}
          {status === "IDLE" && featureFlags.includes("SCRIBE_OCR_ENABLED") && (
            <button
              onClick={() => setStatus("ATTACHING")}
              className="border-neutral-300 bg-neutral-200 hover:bg-neutral-300 flex aspect-square h-full items-center justify-center rounded-full border p-4 text-xl transition-all cursor-pointer"
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
            const approved = approvedFields.filter((a) => a.approved);
            approved &&
              toast({
                title: t("autofilled_fields"),
              });
            setToReview(undefined);
            setStatus("IDLE");
            setFiles([]);
          }}
        />
      )}
    </>
  );
}
