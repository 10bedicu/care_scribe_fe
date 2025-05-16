import SidebarIcon from "@/components/icon";
import ScribeDialog from "@/components/ScribeDialog";
import { getStatusConfig, StatusBadge } from "@/components/StatusBadge";
import { Input } from "@/components/ui/input";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
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
import { SCRIBE_STATUS, ScribeModel } from "@/types";
import { API } from "@/utils/api";
import { I18NNAMESPACE } from "@/utils/constants";
import { debounce } from "@/utils/utils";
import { ClockIcon } from "@radix-ui/react-icons";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useAtom } from "jotai";
import { useQueryParams } from "raviger";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function AutofillHistory() {
  const { t } = useTranslation(I18NNAMESPACE);
  const [scribe, setScribe] = useState<ScribeModel | null>(null);
  const [statsEnabled, setStatsEnabled] = useAtom(enableStatisticsAtom);
  const [{ page: initPage }] = useQueryParams();
  const page = initPage || 1;
  const [search, setSearch] = useState("");
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
        search: search === "" ? undefined : search,
        offset: (Number(page) - 1) * 10,
        limit: 10,
      }),
  });

  const handleSearch = debounce((value: string) => {
    setSearch(value);
  }, 500);

  const history = historyQuery.data?.results;

  const totalHistory = historyQuery.data?.count || 0;
  const totalPages = Math.ceil(totalHistory / 10);

  const timePresets = [
    {
      label: t("last_24_hours"),
      value: {
        start: dayjs().subtract(1, "day").toISOString(),
        end: dayjs().toISOString(),
      },
    },
    {
      label: t("last_7_days"),
      value: {
        start: dayjs().subtract(7, "day").toISOString(),
        end: dayjs().toISOString(),
      },
    },
    {
      label: t("last_30_days"),
      value: {
        start: dayjs().subtract(30, "day").toISOString(),
        end: dayjs().toISOString(),
      },
    },
  ];

  return (
    <div className="px-6 md:px-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
        {t("scribe_history")}
      </h1>
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <Input
            placeholder={t("search")}
            className="max-w-64 min-w-24 bg-white"
            onChange={(e) => handleSearch(e.target.value)}
          />
          <div className="flex items-center gap-2">
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
              <SelectTrigger className="w-[180px] bg-white">
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
                const selected = timePresets.find(
                  (preset) => preset.label === value,
                );
                if (selected) {
                  setFilters({
                    ...filters,
                    date_range: selected.value,
                  });
                }
              }}
              defaultValue={"all"}
            >
              <SelectTrigger className="w-[180px] bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("all_time")}</SelectItem>
                {timePresets.map((preset) => (
                  <SelectItem key={preset.label} value={preset.label}>
                    {preset.label}
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
              <SelectTrigger className="w-[180px] bg-white">
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
                onClick={() => setScribe(scribe)}
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
        <Pagination>
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious href={`?page=${Number(page) - 1}`} />
              </PaginationItem>
            )}
            {page < totalPages && (
              <PaginationItem>
                <PaginationNext href={`?page=${Number(page) + 1}`} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      </div>
      <ScribeDialog
        scribe={scribe}
        onClose={() => {
          setScribe(null);
        }}
      />
    </div>
  );
}
