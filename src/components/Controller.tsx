import { useState } from "react";
import { ScribeField, ScribeFieldSuggestion, ScribeStatus } from "../types";
import { useTranslation } from "react-i18next";
import { getFieldsToReview, getQuestionInputs } from "../utils/utils";
import ScribeButton from "./ScribeButton";
import animationData from "../assets/animation.json";
import Lottie from "lottie-react";
import ScribeReview from "./Review";
import useSegmentedRecording from "@/hooks/useSegmentedRecorder";
import { useTimer } from "@/hooks/useTimer";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { API } from "@/utils/api";
import uploadFile from "@/utils/uploadFile";
import { useToast } from "@/hooks/use-toast";
import {
  SCRIBE_PROMPT_MAP,
  SCRIBE_REPEAT_PROMPT_MAP,
  STRUCTURED_INPUT_PROMPTS,
} from "@/utils/prompts";
import {
  ChevronUpIcon,
  Cross1Icon,
  CrossCircledIcon,
} from "@radix-ui/react-icons";

export function Controller(props: {
  formState: unknown;
  setFormState: unknown;
}) {
  const [status, setStatus] = useState<ScribeStatus>("IDLE");
  const { t } = useTranslation();
  const [transcript, setTranscript] = useState<string>();
  const timer = useTimer();
  const [lastTranscript, setLastTranscript] = useState<string>();
  const [instanceId, setInstanceId] = useState<string>();
  const [toReview, setToReview] = useState<ScribeFieldSuggestion[]>();
  const [openEditTranscript, setOpenEditTranscript] = useState(false);

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
          const { status, transcript, ai_response } = res;

          if (status === "FAILED") {
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
      // run type validations
      const changedData = Object.entries(parsedFormData)
        .filter(([k, v]) => {
          const f = hfields.find((f) => f.id === k);
          if (!f) return false;
          if (v === f.current) return false;
          return true;
        })
        .map(([k, v]) => ({ [k]: v }))
        .reduce((acc, curr) => ({ ...acc, ...curr }), {});
      return changedData;
    } catch (e) {
      toast({ title: t("scribe_error"), variant: "destructive" });
      setStatus("FAILED");
    }
  };

  // gets the audio transcription
  const getTranscript = async (scribeInstanceId: string) => {
    try {
      await API.scribe.update(scribeInstanceId, {
        status: "READY",
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
  const uploadAudio = async (audioBlob: Blob, scribeInstanceId: string) => {
    const category = "AUDIO";
    const name = "audio.mp3";
    const filename = Date.now().toString();

    const data = await API.scribe.createFileUpload({
      original_name: name,
      file_type: 1,
      name: filename,
      associating_id: scribeInstanceId,
      file_category: category,
      mime_type: audioBlob?.type?.split(";")?.[0],
    });

    await new Promise<void>((resolve, reject) => {
      const url = data?.signed_url;
      const internal_name = data?.internal_name;
      const f = audioBlob;
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
      "SCRIBE",
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
      // system_prompt: "...",
      // json_prompt: "...",
    });

    await Promise.all(
      audioBlobs.map((blob) => uploadAudio(blob, data?.external_id ?? "")),
    );

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

      return {
        friendlyName: field.question.text || "Unlabled Field",
        current: field.value,
        id: `${i}`,
        description:
          structuredPrompt?.prompt ||
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
    setToReview(undefined);
  };

  return (
    <>
      <div
        className={`fixed bottom-5 right-5 z-40 flex flex-col items-end gap-4 transition-all`}
      >
        <div
          className={`${status === "IDLE" ? "max-h-0 opacity-0" : "max-h-[400px]"} w-full overflow-hidden rounded-2xl ${status === "REVIEWING" && !(openEditTranscript || (toReview && !toReview.length)) ? "" : "border-secondary-400 border"} bg-white transition-all delay-100`}
        >
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
              <div className="text-secondary-700 -translate-y-4 text-sm">
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
                    <div className="border-secondary-400 bg-secondary-200 rounded border">
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

                <p className="mb-4 text-xs text-gray-800">
                  {t("transcript_edit_info")}
                </p>
                <button
                  onClick={() => setTranscript(SCRIBE_TEST_INPUT)}
                  className="absolute left-2 top-2 hidden text-xs"
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
                    className="absolute -top-6 right-4 text-xs text-gray-100 hover:text-gray-200"
                    onClick={() => setOpenEditTranscript(false)}
                  >
                    {t("close")}
                  </button>
                )}
              </div>
            )}
          {status === "FAILED" && (
            <div className="flex flex-col items-center justify-center gap-4 px-4 py-10 text-red-500">
              <CrossCircledIcon className="text-4xl" />
              {t("scribe_error")}
            </div>
          )}
        </div>
        {typeof lastTranscript !== "undefined" &&
          status === "REVIEWING" &&
          !(openEditTranscript || (toReview && !toReview.length)) && (
            <button
              onClick={() => setOpenEditTranscript(true)}
              className="flex max-h-[50px] w-40 items-center gap-2 overflow-hidden rounded-lg bg-black/20 p-2 text-left text-xs text-white transition-all hover:bg-black/40 md:max-h-[100px]"
            >
              <div>{transcript}</div>
              <ChevronUpIcon className="text-xl" />
            </button>
          )}
        <div className="flex items-center gap-2">
          {status === "REVIEWING" && (
            <button
              onClick={handleCancel}
              className="border-secondary-400 bg-secondary-300 hover:bg-secondary-400 flex aspect-square h-full items-center justify-center rounded-full border p-4 text-xl transition-all"
              title={t("cancel")}
            >
              <Cross1Icon />
            </button>
          )}
          <ScribeButton
            status={status}
            onClick={
              status !== "RECORDING"
                ? handleStartRecording
                : handleStopRecording
            }
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
          }}
        />
      )}
    </>
  );
}
