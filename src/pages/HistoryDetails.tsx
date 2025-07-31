import { StatusBadge } from "@/components/StatusBadge";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
import { devModeAtom } from "@/store";
import { ScribeModel } from "@/types";
import { API } from "@/utils/api";
import { I18NNAMESPACE } from "@/utils/constants";
import STRUCTURES from "@/utils/structures";
import { cn, renderFieldValue } from "@/utils/utils";
import {
  CalendarIcon,
  CheckboxIcon,
  ClockIcon,
  ExternalLinkIcon,
  FaceIcon,
  FilePlusIcon,
  GridIcon,
  PersonIcon,
} from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useAtom } from "jotai";
import { Link } from "raviger";
import { useTranslation } from "react-i18next";
import { twMerge } from "tailwind-merge";

export default function HistoryDetailsPage(props: {
  scribeId: string;
  onUseScribe?: (scribe: ScribeModel) => void;
}) {
  const { scribeId, onUseScribe } = props;
  const [statsEnabled, setStatsEnabled] = useAtom(devModeAtom);
  const user = useAuthUser();
  const { t } = useTranslation(I18NNAMESPACE);

  const scribeQuery = useQuery({
    queryKey: ["scribe", scribeId],
    queryFn: () => API.scribe.get(scribeId),
    enabled: !!scribeId,
  });

  const scribe = scribeQuery.data;

  const overviewDetails = [
    {
      icon: <CheckboxIcon />,
      label: t("status"),
      value: !!scribe && (
        <div>
          <StatusBadge status={scribe?.status} />
          {scribe.status === "FAILED" && (
            <div className="mt-2 rounded-lg bg-red-50 p-2 text-xs text-red-500">
              {scribe?.meta.error || t("unknown_error")}
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
    },
    {
      icon: <CalendarIcon />,
      label: t("created_at"),
      value: dayjs(scribe?.created_date).format("DD/MM/YYYY HH:mm"),
    },
    {
      icon: <ClockIcon />,
      label: t("time_taken"),
      value: `
         ${
           scribe?.meta.iterations
             ?.reduce(
               (acc, iteration) =>
                 acc +
                 (iteration.transcription_time || 0) +
                 (iteration.completion_time || 0),
               0,
             )
             .toFixed(2) || 0
         } s`,
    },
    {
      icon: <GridIcon />,
      label: t("chunks"),
      value: scribe?.meta.iterations?.length || 0,
      hidden: !statsEnabled,
    },
  ];

  const metaData = [
    {
      label: t("input_tokens"),
      value: scribe?.meta.iterations?.reduce(
        (acc, iteration) => acc + (iteration.completion_input_tokens || 0),
        0,
      ),
    },
    {
      label: t("cached_tokens"),
      value: scribe?.meta.iterations?.reduce(
        (acc, iteration) => acc + (iteration.completion_cached_tokens || 0),
        0,
      ),
      hide: !scribe?.meta.iterations?.[0]?.completion_cached_tokens,
    },
    {
      label: t("output_tokens"),
      value: scribe?.meta.iterations?.reduce(
        (acc, iteration) => acc + (iteration.completion_output_tokens || 0),
        0,
      ),
    },
    {
      label: t("total_tokens"),
      value: scribe?.meta.iterations?.reduce(
        (acc, iteration) =>
          acc +
          (iteration.completion_input_tokens || 0) +
          (iteration.completion_output_tokens || 0),
        0,
      ),
    },
    {
      label: t("transcription_time"),
      value:
        scribe?.meta.iterations
          ?.reduce(
            (acc, iteration) => acc + (iteration.transcription_time || 0),
            0,
          )
          .toFixed(2) + " s",
      hide: !scribe?.meta.iterations?.[0]?.transcription_time,
    },
    {
      label: t("completion_time"),
      value:
        scribe?.meta.iterations
          ?.reduce(
            (acc, iteration) => acc + (iteration.completion_time || 0),
            0,
          )
          .toFixed(2) + " s",
    },
    {
      label: t("total_time"),
      value:
        scribe?.meta.iterations
          ?.reduce(
            (acc, iteration) =>
              acc +
              (iteration.transcription_time || 0) +
              (iteration.completion_time || 0),
            0,
          )
          .toFixed(2) + " s",
    },
    {
      label: t("completion_id"),
      value: scribe?.meta.iterations?.map((i) => i.completion_id).join(", "),
    },
    {
      label: t("audio_model"),
      value: scribe?.meta.audio_model,
      hide: !scribe?.meta.audio_model,
    },
    {
      label: t("chat_model"),
      value: scribe?.meta.chat_model,
    },
    {
      label: t("provider"),
      value: scribe?.meta.provider,
    },
    {
      label: t("start_time"),
      value: dayjs(scribe?.created_date).format("DD/MM/YYYY HH:mm:ss"),
    },
    {
      label: t("end_time"),
      value: scribe?.meta.iterations?.length
        ? dayjs(scribe?.created_date)
            .add(
              scribe?.meta.iterations?.reduce(
                (acc, iteration) =>
                  acc +
                  (iteration.transcription_time || 0) +
                  (iteration.completion_time || 0),
                0,
              ) || 0,
              "second",
            )
            .format("DD/MM/YYYY HH:mm:ss")
        : "-",
    },
  ];

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
                .filter((d) => !d.hidden)
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
          <Tabs defaultValue="summary" className="mt-6 w-full">
            <TabsList
              className={cn(
                "w-full md:grid md:grid-cols-2",
                statsEnabled && "md:grid-cols-3",
              )}
            >
              <TabsTrigger value="summary">{t("ai_summary")}</TabsTrigger>
              <TabsTrigger value="transcript">{t("transcript")}</TabsTrigger>
              {statsEnabled && (
                <TabsTrigger value="metadata">{t("metadata")}</TabsTrigger>
              )}
            </TabsList>
            <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
              <TabsContent value="summary">
                <h3 className="text-xl">{t("ai_summary")}</h3>
                {scribe?.ai_response && (
                  <Table>
                    {!onUseScribe && (
                      <TableHeader>
                        <TableRow>
                          <TableHead>{t("field_name")}</TableHead>
                          <TableHead>{t("value")}</TableHead>
                        </TableRow>
                      </TableHeader>
                    )}
                    <TableBody>
                      {Object.entries(scribe.ai_response)
                        .filter(([key]) => key !== "__scribe__transcription")
                        .map(([key], index) => {
                          // Helper to recursively find a field by id in nested fields
                          function findFieldById(
                            fields: any[],
                            id: string,
                          ): any | undefined {
                            for (const field of fields) {
                              if (field.id === id) return field;
                              if (field.fields) {
                                const found = findFieldById(field.fields, id);
                                if (found) return found;
                              }
                            }
                            return undefined;
                          }

                          const allFields =
                            scribe?.form_data?.flatMap((f) => f.fields) ?? [];
                          const field = findFieldById(allFields, key);
                          const processedField =
                            scribe.meta.processed_ai_response?.successful[key];
                          const failures =
                            scribe.meta.processed_ai_response?.failed[key];
                          return (
                            <TableRow key={index}>
                              {!onUseScribe && (
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
                                  !!onUseScribe && "px-0",
                                )}
                              >
                                {!!onUseScribe && (
                                  <div>
                                    <div className="text-sm font-bold">
                                      {field?.friendlyName}
                                    </div>
                                    <div className="text-xs opacity-50">
                                      {statsEnabled && key}
                                    </div>
                                  </div>
                                )}
                                {!!processedField && (
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html: renderFieldValue({
                                        value: field.structuredType
                                          ? processedField
                                          : processedField.value,
                                        structure: field?.structuredType
                                          ? STRUCTURES[
                                              field.structuredType as keyof typeof STRUCTURES
                                            ]
                                          : undefined,
                                      }),
                                    }}
                                  />
                                )}
                                {failures &&
                                  failures.length > 0 &&
                                  failures.map((failure, fIndex) => (
                                    <div
                                      key={fIndex}
                                      className="mt-1 text-xs text-red-500"
                                    >
                                      {failure}
                                    </div>
                                  ))}
                                {!field?.structuredType &&
                                  processedField?.note && (
                                    <div className="mt-1 text-xs text-yellow-500">
                                      {processedField.note}
                                    </div>
                                  )}
                                {!processedField && (
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
                )}
                {!scribe?.ai_response ||
                  (Object.keys(scribe?.ai_response).filter(
                    (k) => k !== "__scribe__transcription",
                  ).length === 0 && (
                    <div className="flex flex-col items-center justify-center gap-4 rounded-lg opacity-50">
                      {t("no_fields_autofilled")}
                    </div>
                  ))}
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
                        <audio key={audio.id} controls controlsList="">
                          <source
                            src={audio.read_signed_url}
                            type={
                              "audio/" +
                              audio.read_signed_url
                                .split(".")
                                .pop()
                                ?.split("?")[0]
                            }
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
                <Accordion
                  type="multiple"
                  defaultValue={
                    (scribe?.meta.iterations?.length || 0) < 2
                      ? ["item-1"]
                      : undefined
                  }
                >
                  {scribe?.meta.iterations?.map((iteration, index) => (
                    <AccordionItem value={`item-${index + 1}`} key={index}>
                      <AccordionTrigger>
                        {t("chunk_number", { number: index + 1 })}{" "}
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="mt-4 mb-2 font-semibold">
                          {t("prompt")}
                        </div>
                        <pre className="max-h-64 overflow-y-auto rounded-md bg-neutral-100 p-2 text-xs break-all whitespace-pre-wrap">
                          {iteration.prompt}
                        </pre>

                        <div className="mt-4 mb-2 font-semibold">
                          {t("output_schema")}
                        </div>
                        <pre className="mt-4 max-h-64 overflow-y-auto rounded-md bg-neutral-100 p-2 text-xs break-all whitespace-pre-wrap">
                          {JSON.stringify(iteration.function, null, 2)}
                        </pre>
                        <div className="mt-4 mb-2 font-semibold">
                          {t("chunk_output")}
                        </div>
                        <pre className="mt-4 max-h-64 overflow-y-auto rounded-md bg-neutral-100 p-2 text-xs break-all whitespace-pre-wrap">
                          {JSON.stringify(iteration.output, null, 2)}
                        </pre>
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
                <div className="mt-4 mb-2 font-semibold">
                  {t("ai_response")}
                </div>
                <pre className="mt-4 max-h-64 overflow-y-auto rounded-md bg-neutral-100 p-2 text-xs break-all whitespace-pre-wrap">
                  {JSON.stringify(scribe?.ai_response, null, 2)}
                </pre>
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
                            <td className="text-right font-semibold">
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
