import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ScribeAIResponse,
  ScribeDeseriliazedValue,
  ScribeField,
  ScribeFileType,
  ScribeModel,
  ScribeQuestionnaire,
} from "@/types";
import { API } from "@/utils/api";
import { calculateSimilarityScore } from "@/utils/benchmark-utils";
import { AI_MODELS, I18NNAMESPACE } from "@/utils/constants";
import { Label } from "@radix-ui/react-dropdown-menu";
import {
  ArrowRightIcon,
  DotsVerticalIcon,
  DownloadIcon,
  Pencil1Icon,
  RocketIcon,
  TrashIcon,
  UploadIcon,
} from "@radix-ui/react-icons";
import dayjs from "dayjs";
import isEqual from "lodash.isequal";
import { Link } from "raviger";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { twMerge } from "tailwind-merge";
import { distance as lev } from "fastest-levenshtein";
import { useContainerRef } from "@/hooks/useContainerRef";
import { useStorage } from "@/hooks/useStorage";
import { cleanAIResponse, poller } from "@/utils/response-utils";
import { getHydratedFields, getQuestionInputs } from "@/utils/field-utils";
import { uploadScribeFile } from "@/utils/upload-utils";
import useAuthUser from "@/hooks/useAuthUser";
import { Card, CardTitle } from "@/components/ui/card";
import { getAudioByIdentifier, openDB, putAudio } from "@/utils/idb";

export interface BenchmarkIteration {
  id: string;
  model: string;
  status: "pending" | "in-progress" | "completed" | "failed";
  errors: string[];
  result: Awaited<ReturnType<typeof cleanAIResponse>>["cleaned"] | null;
  startTime: Date;
  endTime: Date | null;
  scribeInstance: ScribeModel | null;
}

export interface Benchmark {
  id: string;
  benchmarkId: string;
  startTime: Date;
  tries: number;
  models: (keyof typeof AI_MODELS)[];
  iterations: BenchmarkIteration[];
}

export interface CreatedBenchmark {
  id: string;
  name: string;
  createdAt: Date;
  files: {
    type: "audio" | "document";
    identifier: string;
    mimeType: string;
  }[];
  formState: any;
}

export default function BenchmarkPage() {
  const { t } = useTranslation(I18NNAMESPACE);
  const containerRef = useContainerRef();
  const [benchmarks, setBenchmarks] = useStorage("scribe-benchmarks");
  const [userBenchmarks, setUserBenchmarks] = useStorage(
    "scribe-created-benchmarks",
  );
  const [startup, setStartup] = useState(true);
  const [selectedIteration, setSelectedIteration] =
    useState<BenchmarkIteration | null>(null);

  const [queuedIteration, setQueuedIteration] = useState<string | null>(null);
  const user = useAuthUser();

  const [newBenchmarkForm, setNewBenchmarkForm] = useState<{
    models: (keyof typeof AI_MODELS)[];
    benchmarkId: string | null;
    tries: number;
  }>({
    models: [],
    benchmarkId: null,
    tries: 3,
  });
  const [loadedAudios, setLoadedAudios] = useState<{ [key: string]: string }>(
    {},
  );

  const isISODateString = (value: unknown) =>
    typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value);

  const normalizeDates: (input: ScribeDeseriliazedValue) => unknown = (
    input: unknown,
  ) => {
    if (Array.isArray(input)) {
      return input.map(normalizeDates);
    } else if (
      input !== null &&
      typeof input === "object" &&
      Object.prototype.toString.call(input) === "[object Object]"
    ) {
      const result = {} as any;
      for (const key in input) {
        result[key] = normalizeDates(input[key as keyof typeof input]);
      }
      return result;
    } else if (isISODateString(input)) {
      return ""; // date can be relative, so no point of normalizing it
      // return (input as any).slice(0, 10); // keep only YYYY-MM-DD
    } else {
      return input;
    }
  };

  const hasOwn = (obj: unknown, prop: PropertyKey): prop is keyof typeof obj =>
    Object.prototype.hasOwnProperty.call(obj, prop);

  const getExpectedResultFromFormState = (formState: ScribeQuestionnaire[]) => {
    const qn = getQuestionInputs(formState);

    function flattenQuestionnaire(
      questionnaire: ScribeQuestionnaire,
    ): ScribeField[] {
      const fields: ScribeField[] = [];

      for (const item of questionnaire.questions) {
        // Check if item is a ScribeField (has 'question' and 'value' properties)
        if ("question" in item && "value" in item) {
          fields.push(item as ScribeField);
        }
        // Otherwise it's a nested ScribeQuestionnaire
        else if ("questions" in item) {
          fields.push(...flattenQuestionnaire(item as ScribeQuestionnaire));
        }
      }

      return fields;
    }

    const flattenedFields = qn.flatMap((questionnaire) =>
      flattenQuestionnaire(questionnaire),
    );

    return flattenedFields;
  };

  const calculateIterationScore = (
    benchmarkId: string,
    result: BenchmarkIteration["result"],
  ) => {
    const benchmark = availableBenchmarks.find((b) => b.id === benchmarkId);
    if (!benchmark) return { score: 0, percentage: 0 };
    const formState = benchmark.formState;

    const expectedFields = getExpectedResultFromFormState(formState);

    if (!result || !expectedFields) return { score: 0, percentage: 0 };

    // for each field in the expected result, check if
    // - the exact value matches - 3 points
    // - the value is an array, and there is at least one match - 2 points
    // - the key exists in the result - 1 point
    // - the key does not exist in the result - 0 points

    const perField: {
      [key: string]: {
        name: string;
        expected: ScribeDeseriliazedValue;
        received: ScribeDeseriliazedValue | null;
        score: number;
      };
    } = {};

    expectedFields.forEach((field) => {
      const fieldId = field.question.id;

      // skip if expected is null or undefined
      if (
        field.value === null ||
        field.value === undefined ||
        (Array.isArray(field.value) && field.value.length === 0)
      ) {
        return;
      }

      // if the field is not present in the result, we assume it was not answered
      if (!result[fieldId]) {
        perField[fieldId] = {
          name: field.question.text,
          expected: field.value,
          received: null,
          score: -1,
        };

        return;
      }

      const resultValue = result[fieldId].value;

      try {
        perField[fieldId] = {
          name: field.question.text,
          expected: field.value,
          received: resultValue ?? null,
          score: 0,
        };

        // Check if the key exists in the result
        if (!hasOwn(result, fieldId)) {
          if (field.value === null) {
            perField[fieldId].score = 3; // key does not exist and expected value is null
          } else {
            // key does not exist
            perField[fieldId].score = -1; // no match
          }
        }

        // If the value is an array, check if any of the values match
        else if (Array.isArray(resultValue)) {
          // if both expected and received are empty arrays or null, consider it a full match
          if (
            Array.isArray(field.value) &&
            field.value.length === 0 &&
            (resultValue.length === 0 || resultValue === null)
          ) {
            perField[fieldId].score = 3; // exact match
            return;
          }

          perField[fieldId].score = calculateSimilarityScore(
            normalizeDates(field.value || []) as any,
            normalizeDates(resultValue) as any,
          );
        }

        // If the value is not an array, and not a string, check for exact match
        else if (
          typeof resultValue !== "string" &&
          isEqual(
            normalizeDates(resultValue),
            normalizeDates(field.value) as any,
          )
        ) {
          perField[fieldId].score = 3; // exact match
        }

        // If the value is a string, use Levenshtein distance to calculate similarity
        else if (typeof resultValue === "string") {
          const distance =
            1 -
            lev(resultValue as string, (field.value as string) || "") /
              Math.max(
                (resultValue as string)?.length,
                (field.value as string)?.length || 0,
              );
          perField[fieldId].score = distance * 3;
        }

        // If the value is none of the above, it means no match
        else {
          perField[fieldId].score = 0; // key exists
        }
      } catch (error) {
        console.error(
          `Error calculating score for field ${field.question.id}:`,
          error,
        );
        perField[fieldId] = {
          name: field.question.text,
          expected: field.value,
          received: resultValue ?? null,
          score: -5, // error in calculation
        };
      }
    }, 0);

    // check for keys that were not expected
    Object.keys(result).forEach((key) => {
      if (
        !expectedFields.find((field) => field.question.id === key) &&
        !(Array.isArray(result[key].value) && result[key].value.length === 0)
      ) {
        perField[key] = {
          name: key,
          expected: null,
          received: result[key].value,
          score: -1,
        };
      }
    });

    const score = Object.values(perField).reduce(
      (acc, curr) => acc + curr.score,
      0,
    );

    const maxScore = Object.keys(perField).length * 3; // max score if all fields match exactly

    const outcome = {
      score,
      maxScore,
      percentage: (score / maxScore) * 100,
      perField,
    };

    return outcome;
  };

  useEffect(() => {
    let pending: BenchmarkIteration[] = [];
    if (benchmarks.length && startup) {
      pending = benchmarks.flatMap((b) =>
        b.iterations.filter((i) => i.status === "in-progress"),
      );
      setStartup(false);
    }
    if (queuedIteration) return;
    const pendingIterations = [
      ...pending,
      ...benchmarks.flatMap((b) =>
        b.iterations.filter((i) => i.status === "pending"),
      ),
    ];
    const nextIteration = pendingIterations[0] as
      | BenchmarkIteration
      | undefined;
    if (nextIteration) {
      setQueuedIteration(nextIteration.id);
      processIteration(nextIteration);
    }
    pending.forEach((iteration) => {
      updateIteration(iteration.id, { status: "pending" });
    });
  }, [queuedIteration, benchmarks]);

  useEffect(() => {
    // reload audios for user benchmarks
    userBenchmarks.forEach(async (benchmark) => {
      if (loadedAudios[benchmark.id]) return;
      const db = await openDB();
      const storedAudio = await getAudioByIdentifier(
        db,
        benchmark.files[0].identifier,
      );
      db.close();
      if (!storedAudio) {
        return;
      }
      const blob = new Blob([storedAudio.data], { type: storedAudio.mimeType });
      const blobUrl = URL.createObjectURL(blob);
      setLoadedAudios((prev) => ({
        ...prev,
        [benchmark.id]: blobUrl,
      }));
    });
  }, [userBenchmarks]);

  const updateIteration = (
    id: string,
    updates: Partial<BenchmarkIteration>,
  ) => {
    setBenchmarks((bms) =>
      bms.map((bm) => ({
        ...bm,
        iterations: bm.iterations.map((it) =>
          it.id === id ? { ...it, ...updates } : it,
        ),
      })),
    );
  };

  const processIteration = async (iteration: BenchmarkIteration) => {
    let scribeInstance: ScribeModel | null = null;
    try {
      console.log(
        `Processing iteration ${iteration.id} for model ${iteration.model}`,
      );
      updateIteration(iteration.id, { status: "in-progress" });
      const benchmark = benchmarks.find((b) =>
        b.iterations.some((it) => it.id === iteration.id),
      );
      const benchmarkData = availableBenchmarks.find(
        (b) => b.id === benchmark?.benchmarkId,
      );

      if (!benchmarkData) {
        console.error(`Benchmark data not found for iteration ${iteration.id}`);
        setQueuedIteration(null);
        return;
      }

      if (!benchmark) {
        console.error(`Benchmark not found for iteration ${iteration.id}`);
        setQueuedIteration(null);
        return;
      }

      const fields = getQuestionInputs(benchmarkData.formState);

      let blobUrl = loadedAudios[benchmarkData.id];

      if (!blobUrl) {
        const db = await openDB();
        const storedAudio = await getAudioByIdentifier(
          db,
          benchmarkData.files[0].identifier,
        );
        db.close();

        if (!storedAudio) {
          throw new Error("Audio not found");
        }

        const blob = new Blob([storedAudio.data], {
          type: storedAudio.mimeType,
        });
        blobUrl = URL.createObjectURL(blob);

        setLoadedAudios((prev) => ({
          ...prev,
          [benchmarkData.id]: blobUrl,
        }));
      }

      scribeInstance = await createScribeInstance(
        fields,
        blobUrl,
        iteration.model,
      );

      await poller(scribeInstance.external_id, "transcript");
      const aiResponse = await poller(
        scribeInstance.external_id,
        "ai_response",
      );
      if (!aiResponse) throw new Error("AI response is null");
      const cleaned = await cleanAIResponse(
        aiResponse as ScribeAIResponse,
        fields,
        {
          encounterId: "",
          currentUser: user!,
          currentTime: new Date().toISOString(),
        },
      );

      updateIteration(iteration.id, {
        status: "completed",
        result: cleaned.meta.successful,
        scribeInstance,
        endTime: new Date(),
      });
      setQueuedIteration(null);
    } catch (error) {
      console.error(`Error processing iteration ${iteration.id}:`, error);
      updateIteration(iteration.id, {
        status: "failed",
        errors: [error instanceof Error ? error.message : "Unknown error"],
        scribeInstance,
        endTime: new Date(),
      });
      setQueuedIteration(null);
    }
  };

  const orderedBenchmarks = benchmarks.sort((a, b) => {
    if (a.startTime > b.startTime) return -1;
    if (a.startTime < b.startTime) return 1;
    return 0;
  });

  const createScribeInstance = async (
    questionnaires: ScribeQuestionnaire[],
    audioUrl: string,
    chat_model?: string,
    audio_model?: string,
    chat_model_temperature?: number,
  ) => {
    const hfields = getHydratedFields(questionnaires, true);
    const cdata = await API.scribe.create({
      status: "CREATED",
      form_data: hfields,
      benchmark: true,
      chat_model,
      audio_model,
      chat_model_temperature,
    });
    const audioBlob = await fetch(audioUrl).then((res) => res.blob());

    await uploadScribeFile(
      audioBlob,
      cdata?.external_id ?? "",
      ScribeFileType.AUDIO,
    );

    const data = await API.scribe.update(cdata.external_id, {
      status: "READY",
    });

    return data;
  };

  const availableBenchmarks = userBenchmarks;

  const exportBenchmark = async (benchmark: CreatedBenchmark) => {
    // convert audio files to base64 strings

    const convertAudioFilesToBase64 = async (benchmark: CreatedBenchmark) => {
      const db = await openDB();

      const filesWithBase64 = await Promise.all(
        benchmark.files.map(async (file) => {
          const storedAudio = await getAudioByIdentifier(db, file.identifier);
          if (!storedAudio) {
            throw new Error("Audio not found");
          }
          const blob = new Blob([storedAudio.data], {
            type: storedAudio.mimeType,
          });
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve(reader.result as string);
            };
            reader.onerror = reject;
            reader.readAsDataURL(blob);
          });
          return {
            ...file,
            base64,
          };
        }),
      );
      db.close();
      return {
        ...benchmark,
        files: filesWithBase64,
      };
    };

    benchmark = await convertAudioFilesToBase64(benchmark);

    // create a json file and download

    const dataStr = JSON.stringify(benchmark, null, 2);

    const blob = new Blob([dataStr], { type: "application/json" });

    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");

    a.href = url;

    a.download = `${benchmark.name || "benchmark"}.json`;

    a.click();
    URL.revokeObjectURL(url);
  };

  const importBenchmark = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        let importedBenchmark = JSON.parse(e.target?.result as string);

        // check if the benchmark already exists
        if (userBenchmarks.find((b) => b.id === importedBenchmark.id)) {
          alert("Benchmark with the same ID already exists");
          return;
        }

        // convert base64 audio files to indexeddb entries
        const convertBase64ToIndexedDB = async (
          benchmark: CreatedBenchmark,
        ) => {
          const db = await openDB();

          const filesWithIdentifiers = await Promise.all(
            benchmark.files.map(async (file: any) => {
              // file has base64 property
              if (file.base64) {
                const res = await fetch(file.base64);
                const arrayBuffer = await res.arrayBuffer();

                const newIdentifier = crypto.randomUUID();

                await putAudio(db, newIdentifier, {
                  identifier: newIdentifier,
                  mimeType: file.mimeType,
                  data: arrayBuffer,
                });

                return {
                  type: file.type,
                  identifier: newIdentifier,
                  mimeType: file.mimeType,
                };
              } else {
                return file;
              }
            }),
          );

          db.close();

          return {
            ...benchmark,
            files: filesWithIdentifiers,
          };
        };

        importedBenchmark = await convertBase64ToIndexedDB(importedBenchmark);
        setUserBenchmarks((prev) => [...prev, importedBenchmark]);
      } catch (error) {
        console.error("Error importing benchmark:", error);
      }
    };

    reader.readAsText(file);

    event.target.value = "";
  };

  return (
    <div className="px-4 md:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {t("benchmark")}
        </h1>
        <div className="flex items-center gap-2">
          <Sheet>
            <SheetTrigger asChild>
              <Button variant={"outline"}>Manage Benchmarks</Button>
            </SheetTrigger>
            <SheetContent
              portalProps={{ container: containerRef?.current }}
              className=""
            >
              <SheetHeader>
                <SheetTitle>Manage Benchmarks</SheetTitle>
                <Button
                  variant={"secondary"}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.accept = "application/json";
                    input.onchange = importBenchmark as any;
                    input.click();
                  }}
                >
                  <UploadIcon />
                  Import
                </Button>
              </SheetHeader>
              <div className="flex flex-col gap-4 px-4">
                {userBenchmarks.length === 0 && (
                  <div>You have not created any benchmarks yet.</div>
                )}
                {userBenchmarks.map((benchmark) => (
                  <Card key={benchmark.id} className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <CardTitle>{benchmark.name}</CardTitle>
                      <div className="flex items-center gap-2">
                        {[
                          {
                            name: "Edit",
                            icon: <Pencil1Icon />,
                            onClick: () => {},
                          },
                          {
                            name: "Export",
                            icon: <DownloadIcon />,
                            onClick: () => {
                              exportBenchmark(benchmark);
                            },
                          },
                          {
                            name: "Delete",
                            icon: <TrashIcon />,
                            onClick: () => {
                              setUserBenchmarks((prev) =>
                                prev.filter((b) => b.id !== benchmark.id),
                              );
                            },
                          },
                        ].map((action) => (
                          <Button
                            variant={"secondary"}
                            key={action.name}
                            title={action.name}
                            onClick={action.onClick}
                          >
                            {action.icon}
                          </Button>
                        ))}
                      </div>
                    </div>
                    <div>
                      {loadedAudios[benchmark.id] && (
                        <audio
                          controls
                          src={loadedAudios[benchmark.id]}
                          className="w-full"
                        />
                      )}
                    </div>
                  </Card>
                ))}
              </div>
              <SheetFooter className="">
                <SheetClose asChild>
                  <Button>Close</Button>
                </SheetClose>
              </SheetFooter>
            </SheetContent>
          </Sheet>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant={"default"}>
                <RocketIcon />
                Run Benchmark
              </Button>
            </SheetTrigger>

            <SheetContent
              portalProps={{ container: containerRef?.current }}
              className=""
            >
              <SheetHeader>
                <SheetTitle>Run Benchmark</SheetTitle>
              </SheetHeader>
              <div className="p-4">
                <div className="">
                  <Label>Models</Label>
                  <div>
                    {(Object.keys(AI_MODELS) as (keyof typeof AI_MODELS)[]).map(
                      (model) => (
                        <label key={model} className="flex items-center gap-2">
                          <Checkbox
                            checked={newBenchmarkForm.models.includes(model)}
                            onCheckedChange={(checked) => {
                              setNewBenchmarkForm((prev) => {
                                const models = checked
                                  ? [...prev.models, model]
                                  : prev.models.filter((m) => m !== model);
                                return { ...prev, models };
                              });
                            }}
                          />
                          {model}
                        </label>
                      ),
                    )}
                  </div>
                </div>
                <div className="mt-4">
                  <Label>Benchmark</Label>
                  <Select
                    value={newBenchmarkForm.benchmarkId ?? ""}
                    onValueChange={(value) => {
                      setNewBenchmarkForm((prev) => ({
                        ...prev,
                        benchmarkId: value,
                      }));
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select Benchmark Audio" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableBenchmarks.map((benchmark) => (
                        <SelectItem key={benchmark.id} value={benchmark.id}>
                          {benchmark.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="mt-4">
                  <Label>Tries</Label>
                  <Input
                    type="number"
                    min={1}
                    value={newBenchmarkForm.tries}
                    onChange={(e) => {
                      const value = parseInt(e.target.value, 10);
                      if (!isNaN(value) && value > 0) {
                        setNewBenchmarkForm((prev) => ({
                          ...prev,
                          tries: value,
                        }));
                      }
                    }}
                  />
                </div>
                <SheetFooter className="p-0">
                  <SheetClose asChild>
                    <Button
                      disabled={
                        newBenchmarkForm.models.length === 0 ||
                        !newBenchmarkForm.benchmarkId ||
                        newBenchmarkForm.tries < 1
                      }
                      onClick={() => {
                        if (!newBenchmarkForm.benchmarkId) return;
                        if (
                          !availableBenchmarks.find(
                            (b) => b.id === newBenchmarkForm.benchmarkId,
                          )
                        )
                          return;

                        setBenchmarks((prev) => [
                          ...(prev || []),
                          {
                            id: crypto.randomUUID(),
                            benchmarkId: newBenchmarkForm.benchmarkId || "",
                            startTime: new Date(),
                            endTime: null,
                            tries: newBenchmarkForm.tries,
                            models: newBenchmarkForm.models,
                            iterations: newBenchmarkForm.models.flatMap(
                              (model) =>
                                Array.from(
                                  { length: newBenchmarkForm.tries },
                                  () => ({
                                    id: crypto.randomUUID(),
                                    model,
                                    status: "pending",
                                    errors: [],
                                    result: null,
                                    startTime: new Date(),
                                    endTime: null,
                                    scribeInstance: null,
                                  }),
                                ),
                            ),
                          },
                        ]);
                      }}
                      className="mt-4 w-full"
                    >
                      <RocketIcon />
                      Benchmark
                    </Button>
                  </SheetClose>
                </SheetFooter>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
      <div className="mt-8 flex flex-col gap-4">
        {orderedBenchmarks.map((benchmark, index) => {
          const benchmarkInfo = availableBenchmarks.find(
            (b) => b.id === benchmark.benchmarkId,
          );

          if (!benchmarkInfo) return null;

          const benchMarkStatus = benchmark.iterations.some(
            (iteration) => iteration.status === "pending",
          )
            ? "pending"
            : benchmark.iterations.some(
                  (iteration) => iteration.status === "failed",
                )
              ? "failed"
              : benchmark.iterations.every(
                    (iteration) => iteration.status === "completed",
                  )
                ? "completed"
                : "in-progress";

          const completion = benchmark.iterations.reduce((acc, iteration) => {
            if (iteration.status === "completed") {
              return acc + 1;
            }
            return acc;
          }, 0);

          const endTime =
            benchMarkStatus === "completed"
              ? benchmark.iterations.reduce((latest, iteration) => {
                  if (iteration.endTime && iteration.endTime > latest) {
                    return iteration.endTime;
                  }
                  return latest;
                }, new Date(0))
              : null;

          const unsortedModelScores = benchmark.iterations.reduce(
            (acc, iteration) => {
              if (iteration.status === "completed") {
                const score = calculateIterationScore(
                  benchmark.benchmarkId,
                  iteration.result,
                ).percentage;
                if (!acc[iteration.model]) {
                  acc[iteration.model] = [score];
                } else {
                  acc[iteration.model].push(score);
                }
              }
              return acc;
            },
            {} as Record<string, number[]>,
          );

          // sort models by average score
          const modelScores = Object.entries(unsortedModelScores).sort(
            ([, scoresA], [, scoresB]) =>
              scoresB.reduce((a, b) => a + b, 0) / scoresB.length -
              scoresA.reduce((a, b) => a + b, 0) / scoresA.length,
          );

          return (
            <div
              key={index}
              className={twMerge(
                "relative flex flex-col gap-2 overflow-hidden rounded-xl border border-slate-200 bg-white p-4 text-left",
                benchMarkStatus === "pending" && "animate-pulse",
              )}
            >
              <DropdownMenu modal={false}>
                <DropdownMenuTrigger asChild>
                  <button className="absolute top-4 right-4 z-10 flex aspect-square w-6 items-center justify-center rounded-lg text-sm transition-all hover:bg-black/10">
                    <DotsVerticalIcon className="text-xl" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-48"
                  portalProps={{ container: containerRef?.current }}
                >
                  <DropdownMenuItem
                    onClick={() => {
                      setBenchmarks((prev) => [
                        {
                          ...benchmark,
                          startTime: new Date(),
                          id: crypto.randomUUID(),
                          iterations: benchmark.iterations.map((i) => ({
                            ...i,
                            id: crypto.randomUUID(),
                            status: "pending",
                            result: null,
                            startTime: new Date(),
                            endTime: null,
                            scribeInstance: null,
                            errors: [],
                          })),
                        },
                        ...prev,
                      ]);
                    }}
                  >
                    Re-run
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => {
                      setBenchmarks((prev) =>
                        prev.filter((b) => b.id !== benchmark.id),
                      );
                    }}
                  >
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
                <div>
                  <h2 className="text-lg font-bold">{benchmarkInfo?.name}</h2>
                  {benchMarkStatus === "completed" && (
                    <div>
                      Overall Avg Score :{" "}
                      {(
                        benchmark.iterations
                          .map(
                            (iteration) =>
                              calculateIterationScore(
                                benchmark.benchmarkId,
                                iteration.result,
                              ).percentage,
                          )
                          .reduce((acc, score) => acc + score, 0) /
                        benchmark.iterations.length
                      ).toFixed(2)}{" "}
                      %
                    </div>
                  )}
                  <div className="flex items-center gap-4 text-xs opacity-70">
                    {dayjs(benchmark.startTime).format(
                      "DD MMM YYYY, hh:mm:ss a",
                    )}
                    {endTime && (
                      <>
                        <ArrowRightIcon />{" "}
                        {dayjs(endTime).format("DD MMM YYYY, hh:mm:ss a")}
                      </>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    {loadedAudios[benchmarkInfo.id] && (
                      <audio controls className="plain-audio">
                        <source
                          src={loadedAudios[benchmarkInfo.id]}
                          type={benchmarkInfo?.files[0].mimeType}
                        />
                      </audio>
                    )}
                  </div>
                  <div className="">
                    {benchmark.models.map((model) => (
                      <span
                        key={model}
                        className="mr-2 inline-block rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700"
                      >
                        {model.split("/")[1]}
                      </span>
                    ))}
                  </div>
                </div>
                {benchMarkStatus === "completed" && (
                  <div className="text-xs">
                    <Table>
                      <TableBody>
                        {modelScores.map(([model, scores], i) => {
                          return (
                            <TableRow key={i} className="text-xs">
                              <TableCell className="py-1">{i + 1}</TableCell>
                              <TableCell className="py-1">{model}</TableCell>
                              <TableCell className="py-1">
                                {(
                                  scores.reduce((a, b) => a + b, 0) /
                                    scores.length || 0
                                ).toFixed(2)}
                                %
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  {benchmark.models.map((model) => {
                    const iterations = benchmark.iterations.filter(
                      (iteration) => iteration.model === model,
                    );
                    return (
                      <div className="flex flex-col gap-2">
                        {iterations.map((iteration, idx) => {
                          const score =
                            iteration.status === "completed"
                              ? calculateIterationScore(
                                  benchmark.benchmarkId,
                                  iteration.result,
                                ).percentage
                              : null;

                          let bg = "bg-slate-200";
                          if (score !== null) {
                            if (score === 100) {
                              bg = "bg-purple-500";
                            } else if (score >= 80) {
                              bg = "bg-green-500";
                            } else if (score >= 50) {
                              bg = "bg-yellow-500";
                            } else if (score >= 30) {
                              bg = "bg-orange-500";
                            } else {
                              bg = "bg-red-500";
                            }
                          }
                          return (
                            <button
                              key={idx}
                              onClick={() => {
                                if (selectedIteration?.id === iteration.id) {
                                  setSelectedIteration(null);
                                } else {
                                  setSelectedIteration(iteration);
                                }
                              }}
                              title={`${iteration.model} - ${score?.toFixed(2) ?? "N/A"}%`}
                              className={twMerge(
                                "h-2 w-4 rounded-full bg-slate-200",
                                bg,
                                iteration.status === "in-progress" &&
                                  "animate-pulse",
                                iteration.status === "failed" && "bg-red-800",
                              )}
                            />
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
              {selectedIteration &&
                benchmark.iterations.some(
                  (it) => it.id === selectedIteration.id,
                ) && (
                  <div>
                    <Link
                      className="text-blue-500"
                      href={`/facility/abc/users/abc/scribe-history/${selectedIteration.scribeInstance?.external_id}`}
                    >
                      Open Details
                    </Link>
                    {(() => {
                      const score = calculateIterationScore(
                        benchmark.benchmarkId,
                        selectedIteration.result,
                      );

                      if (!("perField" in score)) return null;

                      return (
                        <div>
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Field</TableHead>
                                <TableHead>Expected</TableHead>
                                <TableHead>Received</TableHead>
                                <TableHead>Score</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {Object.entries(score.perField).map(
                                ([key, value]) => (
                                  <TableRow
                                    key={key}
                                    className={twMerge(
                                      value.score === 0 && "bg-red-500/20",
                                      value.score > 0 &&
                                        value.score <= 2 &&
                                        "bg-yellow-500/20",
                                      value.score > 2 && "bg-green-500/20",
                                      value.score === -1 && "bg-red-800/20",
                                    )}
                                  >
                                    <TableCell>{value.name}</TableCell>
                                    <TableCell className="">
                                      <div className="max-h-[100px] max-w-[250px] overflow-auto whitespace-pre-wrap">
                                        {typeof value.expected === "object"
                                          ? JSON.stringify(
                                              value.expected,
                                              null,
                                              2,
                                            )
                                          : value.expected?.toString() ||
                                            "No data"}
                                      </div>
                                    </TableCell>
                                    <TableCell className="">
                                      <div className="max-h-[100px] max-w-[250px] overflow-auto whitespace-pre-wrap">
                                        {typeof value.received === "object"
                                          ? JSON.stringify(
                                              value.received,
                                              null,
                                              2,
                                            )
                                          : value.received?.toString() ||
                                            "No data"}
                                      </div>
                                    </TableCell>
                                    <TableCell>
                                      {value.score.toFixed(2)}
                                    </TableCell>
                                  </TableRow>
                                ),
                              )}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })()}
                  </div>
                )}
              {benchMarkStatus !== "failed" &&
                completion < benchmark.iterations.length && (
                  <div className="absolute inset-x-0 bottom-0 h-1 w-full overflow-hidden rounded-full bg-slate-200">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{
                        width:
                          (completion / benchmark.iterations.length) * 100 +
                          "%",
                      }}
                    />
                  </div>
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
