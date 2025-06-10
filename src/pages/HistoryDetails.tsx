import { StatusBadge } from "@/components/StatusBadge";
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
import { useScribeFiles } from "@/hooks/useScribeFiles";
import { enableStatisticsAtom } from "@/store";
import { ScribeModel } from "@/types";
import { API } from "@/utils/api";
import { I18NNAMESPACE } from "@/utils/constants";
import { cn, renderFieldValue } from "@/utils/utils";
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
import { useAtom } from "jotai";
import { Link } from "raviger";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function HistoryDetailsPage(props: {
  scribeId: string;
  onUseScribe?: (scribe: ScribeModel) => void;
}) {
  const { scribeId, onUseScribe } = props;
  const [statsEnabled, setStatsEnabled] = useAtom(enableStatisticsAtom);
  const [parsedAiResponse, setParsedAiResponse] = useState<any>(null);

  const { t } = useTranslation(I18NNAMESPACE);

  const scribeQuery = useQuery({
    queryKey: ["scribe", scribeId],
    queryFn: () => API.scribe.get(scribeId),
    enabled: !!scribeId,
  });

  const scribe = scribeQuery.data;

  const { audioFiles, files } = useScribeFiles(scribe || null);

  const overviewDetails = [
    {
      icon: <CheckboxIcon />,
      label: t("status"),
      value: !!scribe && <StatusBadge status={scribe?.status} />,
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
         ${(
           (scribe?.meta.transcription_time || 0) +
           (scribe?.meta.completion_time || 0)
         ).toFixed(2)} s`,
    },
  ];

  const metaData = [
    {
      label: t("input_tokens"),
      value: scribe?.meta.completion_input_tokens,
    },
    {
      label: t("output_tokens"),
      value: scribe?.meta.completion_output_tokens,
    },
    {
      label: t("total_tokens"),
      value:
        (scribe?.meta.completion_input_tokens || 0) +
        (scribe?.meta.completion_output_tokens || 0),
    },
    {
      labek: t("transcription_time"),
      value: scribe?.meta.transcription_time?.toFixed(2) + " s",
      hide: !scribe?.meta.transcription_time,
    },
    {
      label: t("completion_time"),
      value: scribe?.meta.completion_time?.toFixed(2) + " s",
    },
    {
      label: t("total_time"),
      value:
        (
          (scribe?.meta.transcription_time || 0) +
          (scribe?.meta.completion_time || 0)
        ).toFixed(2) + " s",
    },
    {
      label: t("completion_id"),
      value: scribe?.meta.completion_id,
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
      value: dayjs(scribe?.created_date)
        .add(
          (scribe?.meta.transcription_time || 0) +
            (scribe?.meta.completion_time || 0),
          "second",
        )
        .format("DD/MM/YYYY HH:mm:ss"),
    },
  ];

  useEffect(() => {
    if (scribe?.ai_response) {
      try {
        setParsedAiResponse(scribe.ai_response);
      } catch (error) {
        console.error("Failed to parse AI response:", error);
      }
    }
  }, [scribe]);

  return (
    <div className="px-4 md:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {t("scribe_details")}
        </h1>
        <div className="flex items-center gap-2 text-sm">
          <Switch
            checked={statsEnabled}
            onCheckedChange={(checked) => {
              setStatsEnabled(checked);
            }}
          />
          {t("developer_mode")}
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
              {overviewDetails.map((detail, index) => (
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
                {parsedAiResponse && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {statsEnabled && <TableHead>{t("field_id")}</TableHead>}
                        <TableHead>{t("field_name")}</TableHead>
                        <TableHead>{t("value")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Object.entries(parsedAiResponse)
                        .filter(([key]) => key !== "__scribe__transcription")
                        .map(([key, value], index) => (
                          <TableRow key={index}>
                            {statsEnabled && <TableCell>{key}</TableCell>}
                            <TableCell>
                              {
                                scribe?.form_data
                                  .flatMap((f) => f.fields)
                                  .find((f) => f.id === key)?.friendlyName
                              }
                            </TableCell>
                            <TableCell className="max-w-[300px] break-words whitespace-pre-wrap">
                              {renderFieldValue({ value } as { value: string })}
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
                {!parsedAiResponse ||
                  (Object.keys(parsedAiResponse).filter(
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
                {!!scribe?.audio_file_ids.length && (
                  <div>
                    <div className="mt-4 mb-2 font-semibold">{t("audio")}:</div>
                    <div className="flex flex-col gap-2">
                      {audioFiles?.map((audio) => (
                        <audio key={audio.id} controls>
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
                {!!scribe?.document_file_ids.length && (
                  <div>
                    <div className="mt-4 mb-2 font-semibold">
                      {t("documents")}:
                    </div>
                    {files?.map((file) => (
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
                  {scribe?.meta.prompt}
                </pre>

                <div className="mt-4 mb-2 font-semibold">{t("tool_call")}</div>
                <pre className="mt-4 max-h-64 overflow-y-auto rounded-md bg-neutral-100 p-2 text-xs break-all whitespace-pre-wrap">
                  {JSON.stringify(scribe?.meta.function, null, 2)}
                </pre>

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
