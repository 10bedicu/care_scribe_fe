import SidebarIcon from "@/components/icon";
import { PaginationControls } from "@/components/Pagination";
import { getStatusConfig, StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { enableStatisticsAtom } from "@/store";
import { SCRIBE_STATUS } from "@/types";
import { API } from "@/utils/api";
import { I18NNAMESPACE } from "@/utils/constants";
import { debounce } from "@/utils/utils";
import { ClockIcon, TextAlignBottomIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useAtom } from "jotai";
import { navigate, useQueryParams } from "raviger";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function HistoryListPage() {
  const { t } = useTranslation(I18NNAMESPACE);
  const [statsEnabled, setStatsEnabled] = useAtom(enableStatisticsAtom);
  const [{ page: initPage }, setQueryParams] = useQueryParams();
  const page = initPage || 1;
  const [search, setSearch] = useState({
    type: "facility",
    value: "",
  });
  const [filters, setFilters] = useState<{
    status: string;
    date_range: {
      start: string | null;
      end: string | null;
    };
    ordering: string;
  }>({
    status: "all",
    date_range: {
      start: null,
      end: null,
    },
    ordering: "-created_date",
  });

  const historyQuery = useQuery({
    queryKey: ["scribe-history", page, search, filters],
    queryFn: async () =>
      API.scribe.list({
        ordering: filters.ordering === "all" ? undefined : filters.ordering,
        status: filters.status === "all" ? undefined : filters.status,
        // start_date: filters.date_range.start,
        // end_date: filters.date_range.end,
        facility: search.type === "facility" ? search.value : undefined,
        encounter_id: search.type === "encounter" ? search.value : undefined,
        patient: search.type === "patient" ? search.value : undefined,
        offset: (Number(page) - 1) * 10,
        limit: 10,
      }),
  });

  const handleSearch = debounce((value: string) => {
    setSearch({ ...search, value });
    setQueryParams({ page: 1 });
  }, 500);

  const history = historyQuery.data?.results;

  const searchOptions = [
    { value: "facility", label: t("facility_name") },
    { value: "encounter", label: t("encounter_id") },
    { value: "patient", label: t("patient_name") },
  ];

  return (
    <div className="px-4 md:px-6">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
        {t("scribe_history")}
      </h1>
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
          <div className="flex w-full flex-col items-center gap-2 md:w-auto md:flex-row">
            <Input
              placeholder={t("search_by")}
              className="w-full bg-white md:max-w-48 md:min-w-24"
              onChange={(e) => handleSearch(e.target.value)}
            />
            <Select
              value={search.type}
              onValueChange={(value) =>
                setSearch({ ...search, type: value, value: "" })
              }
            >
              <SelectTrigger className="w-full bg-white text-xs md:w-[150px]">
                <SelectValue placeholder={t("search_by")} />
              </SelectTrigger>
              <SelectContent>
                {searchOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex w-full flex-col items-center gap-2 md:w-auto md:flex-row">
            <div className="flex items-center gap-2 text-sm">
              <Switch
                checked={statsEnabled}
                onCheckedChange={(checked) => {
                  setStatsEnabled(checked);
                }}
              />
              {t("developer_mode")}
            </div>
            <Select
              onValueChange={(value) => {
                setFilters({ ...filters, status: value });
              }}
              defaultValue={filters.status}
            >
              <SelectTrigger className="w-full bg-white md:w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_status")}</SelectItem>
                {SCRIBE_STATUS.map((status) => (
                  <SelectItem key={status} value={status}>
                    {getStatusConfig(status).label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              onValueChange={(value) => {
                setFilters({ ...filters, ordering: value });
              }}
              defaultValue={filters.ordering}
            >
              <SelectTrigger className="w-full bg-white md:w-[180px]">
                <TextAlignBottomIcon className="w-4" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="-created_date">
                  {t("newest_first")}
                </SelectItem>
                <SelectItem value="created_date">
                  {t("oldest_first")}
                </SelectItem>
                <SelectItem value="status">{t("status")}</SelectItem>
                <SelectItem value="requested_in_facility">
                  {t("facility")}
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Table className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <TableHeader>
            <TableRow>
              <TableHead>{t("date_and_time")}</TableHead>
              <TableHead>{t("status")}</TableHead>
              <TableHead>{t("patient_name")}</TableHead>
              <TableHead>{t("facility")}</TableHead>
              <TableHead>{t("encounter_id")}</TableHead>
              {statsEnabled && (
                <>
                  <TableHead>{t("ai_provider")}</TableHead>
                  <TableHead>{t("tokens")}</TableHead>
                  <TableHead>{t("duration")}</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {history?.map((scribe) => (
              <TableRow
                key={scribe.external_id}
                className="cursor-pointer"
                onClick={() =>
                  navigate(
                    `/facility/${scribe.requested_in_facility.id}/users/${scribe.requested_by}/scribe-history/${scribe.external_id}`,
                  )
                }
              >
                <TableCell>
                  {dayjs(scribe.created_date).format("D MMMM YYYY")}
                  <div className="flex items-center gap-1 text-xs opacity-80">
                    <ClockIcon className="w-3" />
                    {dayjs(scribe.created_date).format("hh:mm a")}
                  </div>
                </TableCell>
                <TableCell>
                  <StatusBadge status={scribe.status} />
                </TableCell>
                <TableCell className="">
                  {scribe.requested_in_encounter.patient.name}
                </TableCell>
                <TableCell>{scribe.requested_in_facility.name}</TableCell>
                <TableCell className="max-w-[100px] truncate">
                  {scribe.requested_in_encounter.external_id}
                </TableCell>

                {statsEnabled && (
                  <>
                    <TableCell>{scribe.meta.provider || "N/A"}</TableCell>
                    <TableCell>
                      {scribe.meta.completion_input_tokens || "-"} +{" "}
                      {scribe.meta.completion_output_tokens || "-"}
                    </TableCell>
                    <TableCell>
                      {(
                        (scribe.meta.transcription_time || 0) +
                        (scribe.meta.completion_time || 0)
                      ).toFixed(2)}{" "}
                      s
                    </TableCell>
                  </>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {historyQuery.isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[50px] rounded-lg" />
            <Skeleton className="h-[50px] rounded-lg" />
            <Skeleton className="h-[50px] rounded-lg" />
          </div>
        )}
        {historyQuery.isFetched && history?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg opacity-50">
            <div className="text-8xl">
              <SidebarIcon />
            </div>
            {t("no_scribe_history")}
          </div>
        )}
        {historyQuery.data &&
          (historyQuery.data.next || historyQuery.data.previous) && (
            <PaginationControls
              data={historyQuery.data}
              onPageChange={(url) => navigate(url)}
            />
          )}
      </div>
    </div>
  );
}
