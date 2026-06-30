import { StatusBadge } from "@/components/StatusBadge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useAuthUser from "@/hooks/useAuthUser";
import { useStorage } from "@/hooks/useStorage";
import { ScribeModel, ScribeProcessing } from "@/types";
import { API } from "@/utils/api";
import { I18NNAMESPACE } from "@/utils/constants";
import STRUCTURES from "@/utils/structures";
import { calculateCost, cn, renderFieldValue } from "@/utils/utils";
import {
  CalendarIcon,
  CheckboxIcon,
  ClockIcon,
  ExternalLinkIcon,
  FaceIcon,
  FilePlusIcon,
  PersonIcon,
} from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { Link } from "raviger";
import { useTranslation } from "react-i18next";
import { twMerge } from "tailwind-merge";

export default function HistoryDetailsPage(props: {
  scribeId: string;
  onUseScribe?: (scribe: ScribeModel) => void;
}) {
  const { scribeId, onUseScribe } = props;
  const [statsEnabled, setStatsEnabled] = useStorage("scribe-enable-dev-mode");
  const user = useAuthUser();
  const { t } = useTranslation(I18NNAMESPACE);

  const scribeQuery = useQuery({
    queryKey: ["scribe", scribeId],
    queryFn: () => API.scribe.get(scribeId),
    enabled: !!scribeId,
  });

  const scribe = scribeQuery.data;
  const meta = scribe?.meta.processings?.[scribe.meta.processings.length - 1];

  const provider = meta?.chat_provider || meta?.transcribe_provider;
  const model = meta?.chat_model || meta?.transcribe_model;

  const assumedAudioTokens =
    Math.ceil(
      (scribe?.audio.reduce((acc, curr) => acc + (curr.length || 0), 0) || 0) /
        1000,
    ) * 32;

  const overviewDetails = [
    {
      icon: <CheckboxIcon />,
      label: t("status"),
      value: !!scribe && (
        <div className="flex items-center gap-1">
          <StatusBadge status={scribe?.status} />
          {scribe.transcript_only && (
            <Badge
              variant="outline"
              className="border-blue-300 bg-blue-50 text-blue-600"
            >
              {t("transcript_only")}
            </Badge>
          )}
          {scribe.status === "FAILED" && (
            <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-500">
              {meta?.error || t("unknown_error")}
            </div>
          )}
        </div>
      ),
    },
    {
      icon: <PersonIcon />,
      label: t("requested_by"),
      value: scribe?.requested_by.username,
    },
    {
      icon: <FilePlusIcon />,
      label: t("facility"),
      value: scribe?.requested_in_facility?.name,
    },
    {
      icon: <FaceIcon />,
      label: t("patient"),
      value: (
        <Link
          className="text-blue-500 hover:underline"
          href={`/facility/${scribe?.requested_in_facility?.id}/patient/${scribe?.requested_in_encounter?.patient.external_id}`}
        >
          {scribe?.requested_in_encounter?.patient.name}
        </Link>
      ),
      hide: !scribe?.requested_in_encounter,
    },
    {
      icon: <ExternalLinkIcon />,
      label: t("encounter_id"),
      value: (
        <Link
          className="text-blue-500 hover:underline"
          href={`/facility/${scribe?.requested_in_facility?.id}/patient/${scribe?.requested_in_encounter?.patient.external_id}/encounter/${scribe?.requested_in_encounter?.external_id}/updates`}
        >
          {scribe?.requested_in_encounter?.external_id}
        </Link>
      ),
      hide: !scribe?.requested_in_encounter,
    },
    {
      icon: <CalendarIcon />,
      label: t("created_at"),
      value: dayjs(scribe?.created_date).format("DD/MM/YYYY hh:mm a"),
    },
    {
      icon: <ClockIcon />,
      label: t("time_taken"),
      value: `
         ${(
           (meta?.transcription_time || 0) + (meta?.completion_time || 0)
         ).toFixed(2)} s`,
    },
  ];

  const metaData = [
    {
      label: t("thinking_tokens"),
      value: meta?.completion_thinking_tokens,
      hide: !meta?.completion_thinking_tokens,
    },
    {
      label: t("input_tokens"),
      value: meta?.completion_input_tokens,
    },
    {
      label: "→ " + t("audio"),
      value: (
        <span className="text-xs opacity-60">
          {meta?.completion_audio_input_tokens}
        </span>
      ),
      hide: !meta?.completion_audio_input_tokens,
    },
    {
      label: (
        <span>
          → {t("estimated_audio")}{" "}
          <span className="text-xs opacity-50">
            {Math.ceil(
              (scribe?.audio.reduce(
                (acc, curr) => acc + (curr.length || 0),
                0,
              ) || 0) / 1000,
            )}{" "}
            * 32
          </span>
        </span>
      ),
      value: <span className="text-xs opacity-60">{assumedAudioTokens}</span>,
      hide: !scribe?.audio.length || meta?.transcribe_provider !== "google",
    },
    {
      label: "→ " + t("image"),
      value: (
        <span className="text-xs opacity-60">
          {meta?.completion_image_input_tokens}
        </span>
      ),
      hide: !meta?.completion_image_input_tokens,
    },
    {
      label: "→ " + t("text"),
      value: (
        <span className="text-xs opacity-60">
          {meta?.completion_text_input_tokens}
        </span>
      ),
      hide: !meta?.completion_text_input_tokens,
    },
    {
      label: "→ " + t("cached"),
      value: (
        <span className="text-xs opacity-60">
          {meta?.completion_cached_tokens || 0}
        </span>
      ),
    },
    {
      label: <span className="pl-2">→ {t("audio")}</span>,
      value: (
        <span className="text-xs opacity-60">
          {meta?.completion_cached_audio_tokens}
        </span>
      ),
      hide: !meta?.completion_cached_audio_tokens,
    },
    {
      label: <span className="pl-2">→ {t("image")}</span>,
      value: (
        <span className="text-xs opacity-60">
          {meta?.completion_cached_image_tokens}
        </span>
      ),
      hide: !meta?.completion_cached_image_tokens,
    },
    {
      label: <span className="pl-2">→ {t("text")}</span>,
      value: (
        <span className="text-xs opacity-60">
          {meta?.completion_cached_text_tokens}
        </span>
      ),
      hide: !meta?.completion_cached_text_tokens,
    },
    {
      label: t("alloted_output_tokens"),
      value: meta?.transcription_alloted_output_tokens,
      hide: !meta?.transcription_alloted_output_tokens,
    },
    {
      label: t("output_tokens"),
      value: meta?.completion_output_tokens || 0,
    },
    {
      label: t("total_tokens"),
      value: meta?.completion_total_tokens,
    },
    {
      label: t("audio_duration"),
      value:
        scribe?.audio
          .map((a) => `${((a.length || 0) / 1000).toFixed(2)}`)
          .join(" + ") + " s",
      hide: !scribe?.audio?.length,
    },
    {
      label: t("transcription_time"),
      value: meta?.transcription_time?.toFixed(2) + " s",
      hide: !meta?.transcription_time,
    },
    {
      label: t("completion_time"),
      value: meta?.completion_time?.toFixed(2) + " s",
      hide: !meta?.completion_time,
    },
    {
      label: t("total_time"),
      value:
        (
          (meta?.transcription_time || 0) + (meta?.completion_time || 0)
        ).toFixed(2) + " s",
    },
    {
      label: t("transcription_id"),
      value: (
        <div
          className="inline-block w-20 overflow-hidden text-xs text-ellipsis"
          title={meta?.transcription_ids?.join(", ")}
        >
          {meta?.transcription_ids?.join(", ")}
        </div>
      ),
      hide: !meta?.transcription_ids?.length,
    },
    {
      label: t("completion_id"),
      hide: !meta?.completion_id,
      value: (
        <div
          className="inline-block w-20 overflow-hidden text-xs text-ellipsis"
          title={meta?.completion_id}
        >
          {meta?.completion_id}
        </div>
      ),
    },
    {
      label: t("transcribe_model"),
      value: meta?.transcribe_model,
      hide: !meta?.transcribe_model,
    },
    {
      label: t("chat_model"),
      value: meta?.chat_model,
      hide: !meta?.chat_model,
    },
    {
      label: t("chat_provider"),
      value: meta?.chat_provider,
      hide: !meta?.chat_provider,
    },
    {
      label: t("transcribe_provider"),
      value: meta?.transcribe_provider,
      hide: !meta?.transcribe_provider,
    },
    {
      label: t("start_time"),
      value: (
        <div className="text-xs">
          {dayjs(scribe?.created_date).format("D/M/YY hh:mm:ss a")}
        </div>
      ),
    },
    {
      label: t("end_time"),
      value: (
        <div className="text-xs">
          {dayjs(scribe?.created_date)
            .add(
              (meta?.transcription_time || 0) + (meta?.completion_time || 0),
              "second",
            )
            .format("D/M/YY hh:mm:ss a")}
        </div>
      ),
    },
    {
      label: t("estimated_cost"),
      value:
        calculateCost(
          meta?.completion_input_tokens || 0,
          meta?.completion_audio_input_tokens || 0,
          meta?.completion_output_tokens || 0,
          meta?.completion_cached_tokens || 0,
          meta?.completion_cached_audio_tokens || 0,
          `${provider === "google" ? "google" : "openai"}/${model || ""}`,
        ).toFixed(6) + "$",
    },
    {
      label: t("assumed_cost"),
      value:
        calculateCost(
          (meta?.completion_input_tokens || 0) -
            (meta?.completion_audio_input_tokens || 0) +
            assumedAudioTokens,
          assumedAudioTokens || 0,
          meta?.completion_output_tokens || 0,
          meta?.completion_cached_tokens || 0,
          meta?.completion_cached_audio_tokens || 0,
          `${provider === "google" ? "google" : "openai"}/${model || ""}`,
        ).toFixed(6) + "$",
    },
  ];

  const processingHistory = scribe?.meta.processings?.slice(0, -1).reverse();

  return (
    <div className="px-4 md:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {t("scribe_details")}
        </h1>
        <div className="flex items-center gap-2 text-sm">
          {user?.is_superuser && (
            <>
              <Switch
                checked={statsEnabled}
                onCheckedChange={(checked) => {
                  setStatsEnabled(checked);
                }}
              />
              {t("developer_mode")}
            </>
          )}
        </div>
      </div>
      {scribeQuery.isLoading ? (
        <Skeleton className="mt-4 h-64 w-full" />
      ) : (
        <>
          <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
            <div
              className={cn(
                `grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`,
                onUseScribe && "md:grid-cols-1 lg:grid-cols-1 xl:grid-cols-1",
              )}
            >
              {overviewDetails
                .filter((detail) => !detail.hide)
                .map((detail, index) => (
                  <div key={index} className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <div className="font-semibold text-slate-500">
                        {detail.icon}
                      </div>
                      <div className="text-sm">{detail.label}</div>
                    </div>
                    <div className="mt-1">{detail.value}</div>
                  </div>
                ))}
            </div>
            {onUseScribe && (
              <Button
                onClick={() => {
                  if (!scribe) return;
                  onUseScribe(scribe);
                }}
                className="mt-4 w-full"
              >
                {t("use_this_scribe")}
              </Button>
            )}
          </div>
          <Tabs
            defaultValue={scribe?.transcript_only ? "transcript" : "summary"}
            className="mt-6 w-full"
          >
            <TabsList
              className={cn(
                "w-full md:grid",
                scribe?.transcript_only
                  ? statsEnabled
                    ? "md:grid-cols-2"
                    : "md:grid-cols-1"
                  : statsEnabled
                    ? "md:grid-cols-3"
                    : "md:grid-cols-2",
              )}
            >
              {!scribe?.transcript_only && (
                <TabsTrigger value="summary">{t("ai_summary")}</TabsTrigger>
              )}
              <TabsTrigger value="transcript">{t("transcript")}</TabsTrigger>
              {statsEnabled && (
                <TabsTrigger value="metadata">{t("metadata")}</TabsTrigger>
              )}
            </TabsList>
            <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
              <TabsContent value="summary">
                <h3 className="text-xl">{t("ai_summary")}</h3>
                {scribe?.ai_response && (
                  <RenderAutofill
                    response={scribe.ai_response}
                    formData={scribe.form_data}
                    processedAIResponse={meta?.processed_ai_response}
                    compact={!!onUseScribe}
                  />
                )}
                {!!processingHistory?.length && (
                  <>
                    <h3 className="mt-4 mb-2 text-xl">
                      {t("processing_history")}
                    </h3>
                    {processingHistory?.map((processing, index) => (
                      <Accordion
                        type="single"
                        collapsible
                        key={index}
                        className="border-b"
                      >
                        <AccordionItem value={`item-${index}`}>
                          <AccordionTrigger className="py-2">
                            <div>
                              {t("processing")}{" "}
                              {processingHistory.length - index}
                              <div className="text-xs opacity-50">
                                {dayjs(processing.created_date).format(
                                  "DD/MM/YYYY hh:mm a",
                                )}
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent>
                            {processing.ai_response && (
                              <RenderAutofill
                                response={processing.ai_response}
                                formData={processing.form_data || []}
                                processedAIResponse={
                                  processing.processed_ai_response
                                }
                                compact={!!onUseScribe}
                              />
                            )}
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    ))}
                  </>
                )}
              </TabsContent>
              <TabsContent value="transcript">
                <h3 className="text-xl">{t("transcript")}</h3>
                <pre className="mt-4 rounded-md bg-neutral-100 p-2 text-xs break-words whitespace-pre-wrap">
                  {scribe?.transcript}
                </pre>
                {!!scribe?.audio.length && (
                  <div>
                    <div className="mt-4 mb-2 font-semibold">{t("audio")}:</div>
                    <div className="flex flex-col gap-2">
                      {scribe.audio.map((audio) => (
                        <audio
                          key={audio.id}
                          controls
                          controlsList=""
                          className="w-full"
                        >
                          <source
                            src={audio.read_signed_url}
                            type={audio.mime_type}
                          />
                          Your browser does not support the audio element.
                        </audio>
                      ))}
                    </div>
                  </div>
                )}
                {!!scribe?.documents.length && (
                  <div>
                    <div className="mt-4 mb-2 font-semibold">
                      {t("documents")}:
                    </div>
                    {scribe.documents.map((file) => (
                      <a
                        key={file.id}
                        href={file.read_signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 underline"
                      >
                        Document {file.id}
                      </a>
                    ))}
                  </div>
                )}
              </TabsContent>
              <TabsContent value="metadata">
                <h3 className="text-xl">{t("metadata")}</h3>

                <div className="mt-4 mb-2 font-semibold">{t("prompt")}</div>
                <pre className="max-h-64 overflow-y-auto rounded-md bg-neutral-100 p-2 text-xs break-all whitespace-pre-wrap">
                  {meta?.prompt}
                </pre>
                {!scribe?.transcript_only && (
                  <>
                    <div className="mt-4 mb-2 font-semibold">
                      {t("output_schema")}
                    </div>
                    <pre className="mt-4 max-h-64 overflow-y-auto rounded-md bg-neutral-100 p-2 text-xs break-all whitespace-pre-wrap">
                      {JSON.stringify(meta?.function, null, 2)}
                    </pre>
                  </>
                )}
                {meta?.thinking && (
                  <>
                    <div className="mt-4 mb-2 font-semibold">
                      {t("thinking")}
                    </div>
                    <pre className="mt-4 max-h-64 overflow-y-auto rounded-md bg-neutral-100 p-2 text-xs break-all whitespace-pre-wrap">
                      {meta?.thinking}
                    </pre>
                  </>
                )}
                {!scribe?.transcript_only && (
                  <>
                    <div className="mt-4 mb-2 font-semibold">
                      {t("ai_response")}
                    </div>
                    <pre className="mt-4 max-h-64 overflow-y-auto rounded-md bg-neutral-100 p-2 text-xs break-all whitespace-pre-wrap">
                      {JSON.stringify(scribe?.ai_response, null, 2)}
                    </pre>
                  </>
                )}
                <div
                  className={cn(
                    "mt-6 gap-4 md:columns-2",
                    onUseScribe && "md:columns-1",
                  )}
                >
                  <table className="w-full">
                    <tbody>
                      {metaData
                        .filter((m) => !m.hide)
                        .map((item, index) => (
                          <tr key={index} className="pb-2 text-sm">
                            <td className="text-left">{item.label}</td>
                            <td className="w-30 text-right font-semibold">
                              {item.value}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </div>
  );
}

export function RenderAutofill(props: {
  response: ScribeModel["ai_response"];
  formData: ScribeModel["form_data"];
  processedAIResponse: ScribeProcessing["processed_ai_response"];
  compact?: boolean;
}) {
  const { response, formData, processedAIResponse, compact } = props;
  const { t } = useTranslation(I18NNAMESPACE);
  const [statsEnabled] = useStorage("scribe-enable-dev-mode");

  if (
    !response ||
    Object.keys(response).filter((k) => k !== "__scribe__transcription")
      .length === 0
  ) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg opacity-50">
        {t("no_fields_autofilled")}
      </div>
    );
  }

  return (
    <Table>
      {!compact && (
        <TableHeader>
          <TableRow>
            <TableHead>{t("field_name")}</TableHead>
            <TableHead>{t("value")}</TableHead>
          </TableRow>
        </TableHeader>
      )}
      <TableBody>
        {Object.entries(response || {})
          .filter(([key]) => key !== "__scribe__transcription")
          .map(([key], index) => {
            // Helper to recursively find a field by id in nested fields
            function findFieldById(fields: any[], id: string): any | undefined {
              for (const field of fields) {
                if (field.id === id) return field;
                if (field.fields) {
                  const found = findFieldById(field.fields, id);
                  if (found) return found;
                }
              }
              return undefined;
            }

            const allFields = formData?.flatMap((f) => f.fields) ?? [];
            const field = findFieldById(allFields, key);
            const processedField = processedAIResponse?.successful[key];
            const failures = processedAIResponse?.failed[key];
            return (
              <TableRow key={index}>
                {!compact && (
                  <>
                    <TableCell className="max-w-[100px] text-wrap whitespace-normal">
                      {field?.friendlyName}
                      {statsEnabled && (
                        <div className="text-xs wrap-break-word opacity-50">
                          {key}
                        </div>
                      )}
                    </TableCell>
                  </>
                )}
                <TableCell
                  className={twMerge(
                    "max-w-[300px] break-words whitespace-pre-wrap",
                    !!compact && "px-0",
                  )}
                >
                  {!!compact && (
                    <div>
                      <div className="text-sm font-bold">
                        {field?.friendlyName}
                      </div>
                      <div className="text-xs opacity-50">
                        {statsEnabled && key}
                      </div>
                    </div>
                  )}
                  {processedField?.value !== undefined &&
                    processedField?.value !== null &&
                    processedField?.value !== "" && (
                      <div>
                        {renderFieldValue({
                          value: processedField.value,
                          structure: field?.structuredType
                            ? STRUCTURES[
                                field.structuredType as keyof typeof STRUCTURES
                              ]
                            : undefined,
                        })}
                      </div>
                    )}
                  {failures &&
                    failures.length > 0 &&
                    failures.map((failure, fIndex) => (
                      <div key={fIndex} className="mt-1 text-xs text-red-500">
                        {failure}
                      </div>
                    ))}
                  {processedField?.note && (
                    <div className="mt-1 text-xs text-yellow-500">
                      {processedField.note}
                    </div>
                  )}
                  {(processedField?.value === undefined ||
                    processedField?.value === null ||
                    processedField?.value === "") && (
                    <div className="mt-1 text-xs text-red-500">
                      {t("no_autofill")}
                    </div>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
      </TableBody>
    </Table>
  );
}
