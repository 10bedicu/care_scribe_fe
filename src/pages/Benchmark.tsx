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
  ScribeFileType,
  ScribeModel,
  ScribeQuestionnaire,
} from "@/types";
import { API } from "@/utils/api";
import { BENCHMARK_AUDIOS } from "@/utils/benchmark-constants";
import { calculateSimilarityScore } from "@/utils/benchmark-utils";
import { AI_MODELS, I18NNAMESPACE } from "@/utils/constants";
import { Label } from "@radix-ui/react-dropdown-menu";
import {
  ArrowRightIcon,
  DotsVerticalIcon,
  RocketIcon,
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
  benchmark: keyof typeof BENCHMARK_AUDIOS;
  startTime: Date;
  tries: number;
  models: (keyof typeof AI_MODELS)[];
  iterations: BenchmarkIteration[];
}

export default function BenchmarkPage() {
  const { t } = useTranslation(I18NNAMESPACE);
  const containerRef = useContainerRef();
  const [benchmarks, setBenchmarks] = useStorage("scribe-benchmarks");
  const [startup, setStartup] = useState(true);
  const [selectedIteration, setSelectedIteration] =
    useState<BenchmarkIteration | null>(null);

  const [queuedIteration, setQueuedIteration] = useState<string | null>(null);

  const [newBenchmarkForm, setNewBenchmarkForm] = useState<{
    models: (keyof typeof AI_MODELS)[];
    benchmark: keyof typeof BENCHMARK_AUDIOS | null;
    tries: number;
  }>({
    models: [],
    benchmark: null,
    tries: 3,
  });

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

  const calculateIterationScore = (
    benchmark: keyof typeof BENCHMARK_AUDIOS,
    result: BenchmarkIteration["result"],
  ) => {
    const expectedResult = BENCHMARK_AUDIOS[benchmark].formFill;

    if (!result || !expectedResult) return { score: 0, percentage: 0 };

    // for each field in the expected result, check if
    // - the exact value matches - 3 points
    // - the value is an array, and there is at least one match - 2 points
    // - the key exists in the result - 1 point
    // - the key does not exist in the result - 0 points

    const totalFields = Object.keys(expectedResult).length;

    const perField: {
      [key: string]: {
        expected: ScribeDeseriliazedValue;
        received: ScribeDeseriliazedValue | null;
        score: number;
      };
    } = {};
    const maxScore = totalFields * 3; // max score if all fields match exactly
    Object.entries(expectedResult).forEach(([key, expectedValue]) => {
      try {
        perField[key] = {
          expected: expectedValue.value,
          received: result[key]?.value ?? null,
          score: 0,
        };
        if (!hasOwn(result, key)) {
          if (expectedValue.value === null) {
            perField[key].score = 3; // key does not exist and expected value is null
          } else {
            // key does not exist
            perField[key].score = -1; // no match
          }
        } else if (Array.isArray(result[key].value)) {
          perField[key].score = calculateSimilarityScore(
            normalizeDates(expectedValue.value || []) as any,
            normalizeDates(result[key].value) as any,
          );
        } else if (
          typeof result[key].value !== "string" &&
          isEqual(
            normalizeDates(result[key].value),
            normalizeDates(expectedValue.value) as any,
          )
        ) {
          perField[key].score = 3; // exact match
        } else if (typeof result[key].value === "string") {
          const distance =
            1 -
            lev(result[key].value, (expectedValue.value as string) || "") /
              Math.max(
                result[key].value.length,
                expectedValue.value?.length || 0,
              );
          perField[key].score = distance * 3;
        } else {
          perField[key].score = 0; // key exists
        }
      } catch (error) {
        console.error(`Error calculating score for field ${key}:`, error);
        perField[key] = {
          expected: expectedValue.value,
          received: result[key]?.value ?? null,
          score: -5, // error in calculation
        };
      }
    }, 0);

    // check for keys that were not expected
    Object.keys(result).forEach((key) => {
      if (
        !hasOwn(expectedResult, key) &&
        !(Array.isArray(result[key].value) && result[key].value.length === 0)
      ) {
        perField[key] = {
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
      if (!benchmark) {
        console.error(`Benchmark not found for iteration ${iteration.id}`);
        setQueuedIteration(null);
        return;
      }

      const fields = getQuestionInputs(
        BENCHMARK_AUDIOS[benchmark.benchmark].form,
        true,
      );
      scribeInstance = await createScribeInstance(
        fields,
        BENCHMARK_AUDIOS[benchmark.benchmark].path,
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
      );
      updateIteration(iteration.id, {
        status: "completed",
        result: cleaned.cleaned,
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

  return (
    <div className="px-4 md:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {t("benchmark")}
        </h1>
        <Sheet>
          <SheetTrigger asChild>
            <Button variant={"default"}>New Benchmark</Button>
          </SheetTrigger>
          <SheetContent
            portalProps={{ container: containerRef?.current }}
            className=""
          >
            <SheetHeader>
              <SheetTitle>New Benchmark</SheetTitle>
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
                  value={newBenchmarkForm.benchmark ?? ""}
                  onValueChange={(value) => {
                    setNewBenchmarkForm((prev) => ({
                      ...prev,
                      benchmark: value as keyof typeof BENCHMARK_AUDIOS,
                    }));
                  }}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select Benchmark Audio" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(BENCHMARK_AUDIOS).map(([key]) => (
                      <SelectItem key={key} value={key}>
                        {key}
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
                <SheetClose>
                  <Button
                    disabled={
                      newBenchmarkForm.models.length === 0 ||
                      !newBenchmarkForm.benchmark ||
                      newBenchmarkForm.tries < 1
                    }
                    onClick={() => {
                      setBenchmarks((prev) => [
                        ...(prev || []),
                        {
                          id: crypto.randomUUID(),
                          benchmark:
                            newBenchmarkForm.benchmark as keyof typeof BENCHMARK_AUDIOS,
                          startTime: new Date(),
                          endTime: null,
                          tries: newBenchmarkForm.tries,
                          models: newBenchmarkForm.models,
                          iterations: newBenchmarkForm.models.flatMap((model) =>
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
      <div className="mt-8 flex flex-col gap-4">
        {orderedBenchmarks.map((benchmark, index) => {
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
                  benchmark.benchmark,
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
                    {/* Ellipsis Icon*/}
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
                  <h2 className="text-lg font-bold">{benchmark.benchmark}</h2>
                  {benchMarkStatus === "completed" && (
                    <div>
                      Overall Avg Score :{" "}
                      {(
                        benchmark.iterations
                          .map(
                            (iteration) =>
                              calculateIterationScore(
                                benchmark.benchmark,
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
                    <audio controls className="plain-audio">
                      <source
                        src={BENCHMARK_AUDIOS[benchmark.benchmark].path}
                        type={`audio/${BENCHMARK_AUDIOS[benchmark.benchmark].type}`}
                      />
                    </audio>
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
                                  benchmark.benchmark,
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
                        benchmark.benchmark,
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
                                    <TableCell>
                                      {key
                                        .split("__")
                                        .pop()
                                        ?.replace(/_/g, " ")}
                                    </TableCell>
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
