import SidebarIcon from "@/components/icon";
import { PaginationControls } from "@/components/Pagination";
import QuotaSheet from "@/components/QuotaSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ScribeQuota,
  ScribeQuotaCreateRequest,
  ScribeQuotaFilter,
} from "@/types";
import { API } from "@/utils/api";
import { I18NNAMESPACE } from "@/utils/constants";
import { debounce } from "@/utils/utils";
import {
  HomeIcon,
  PersonIcon,
  TextAlignBottomIcon,
} from "@radix-ui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { navigate, useQueryParams } from "raviger";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export default function ScribeQuotas() {
  const { t } = useTranslation(I18NNAMESPACE);

  const [selectedQuota, setSelectedQuota] = useState<ScribeQuota | null>();

  const [{ page: initPage }, setQueryParams] = useQueryParams();
  const page = initPage || 1;
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ScribeQuotaFilter>({
    ordering: "-created_date",
  });

  const quotasQuery = useQuery({
    queryKey: ["scribe-quotas", page, search, filters],
    queryFn: () =>
      API.quotas.list({
        ordering:
          filters.ordering === "all" ? "-created_date" : filters.ordering,
        facility: search || undefined,
        allow_ocr:
          filters.allow_ocr === true
            ? true
            : filters.allow_ocr === false
              ? false
              : undefined,
        offset: (Number(page) - 1) * 10,
        limit: 10,
      }),
  });

  const newQuotaMutation = useMutation({
    mutationFn: (newQuota: ScribeQuotaCreateRequest) =>
      API.quotas.create({
        ...newQuota,
        facility_external_id: newQuota.facility_external_id || undefined,
      }),
    onSuccess: () => {
      toast.success(t("quota_created_successfully"));
      quotasQuery.refetch();
      setQueryParams({ page: 1 });
    },
    onError: (error: any) => {
      toast.error(
        error?.error?.non_field_errors?.[0] || t("quota_creation_failed"),
      );
    },
  });

  const updateQuotaMutation = useMutation({
    mutationFn: ({
      quotaId,
      quota,
    }: {
      quotaId: string;
      quota: { tokens?: number; allow_ocr?: boolean; tokens_per_user?: number };
    }) =>
      API.quotas.update(quotaId, {
        ...quota,
      }),
    onSuccess: () => {
      toast.success(t("quota_updated_successfully"));
      quotasQuery.refetch();
      setSelectedQuota(undefined);
    },
    onError: (error: any) => {
      toast.error(
        error?.error?.non_field_errors?.[0] || t("quota_update_failed"),
      );
    },
  });

  const deleteQuotaMutation = useMutation({
    mutationFn: (quotaId: string) => API.quotas.delete(quotaId),
    onSuccess: () => {
      toast.success(t("quota_deleted"));
      quotasQuery.refetch();
      setSelectedQuota(undefined);
    },
    onError: (error: any) => {
      toast.error(
        error?.error?.non_field_errors?.[0] || t("quota_deletion_failed"),
      );
    },
  });

  const handleSearch = debounce((value: string) => {
    setSearch(value);
    setQueryParams({ page: 1 });
  }, 500);

  const quotas = quotasQuery.data?.results;

  return (
    <div className="px-4 md:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {t("scribe_quotas")}
        </h1>
        <Button onClick={() => setSelectedQuota(null)}>{t("new_quota")}</Button>
        <QuotaSheet
          open={typeof selectedQuota !== "undefined"}
          onClose={() => setSelectedQuota(undefined)}
          onSubmit={(quota) => {
            if (selectedQuota === null) {
              newQuotaMutation.mutate({
                ...quota,
                facility_external_id: quota.facility_external_id || undefined,
              });
            } else {
              updateQuotaMutation.mutate({
                quotaId: selectedQuota?.external_id || "",
                quota: {
                  tokens: quota.tokens,
                  allow_ocr: quota.allow_ocr,
                  tokens_per_user: quota.tokens_per_user,
                },
              });
            }
          }}
          onDelete={() => {
            if (selectedQuota) {
              deleteQuotaMutation.mutate(selectedQuota.external_id);
            }
          }}
          quota={selectedQuota || undefined}
        />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
          <Input
            placeholder={t("search_by_facility_name")}
            className="w-full bg-white md:max-w-52 md:min-w-24"
            onChange={(e) => handleSearch(e.target.value)}
          />
          <div className="flex w-full flex-col items-center gap-2 md:w-auto md:flex-row">
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
                <SelectItem value="-tokens">{t("most_tokens")}</SelectItem>
                <SelectItem value="tokens">{t("least_tokens")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Table className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <TableHeader>
            <TableRow>
              <TableHead>{t("facility")}</TableHead>
              <TableHead>{t("tokens")}</TableHead>
              <TableHead>{t("tokens_per_user")}</TableHead>
              <TableHead>{t("used_tokens")}</TableHead>
              <TableHead>{t("available_tokens")}</TableHead>
              <TableHead>{t("ocr_allowed")}</TableHead>
              <TableHead>{t("created_at")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotas?.map((quota) => (
              <TableRow
                key={quota.external_id}
                className="cursor-pointer"
                onClick={() => {
                  setSelectedQuota(quota);
                }}
              >
                <TableCell className="flex items-center gap-2">
                  {quota.facility ? <HomeIcon /> : <PersonIcon />}
                  {quota.facility ? quota.facility.name : quota.user.username}
                </TableCell>
                <TableCell>{quota.tokens.toLocaleString()}</TableCell>
                <TableCell>{quota.tokens_per_user.toLocaleString()}</TableCell>
                <TableCell>{quota.used.toLocaleString()}</TableCell>
                <TableCell>
                  {(quota.tokens - quota.used).toLocaleString()}
                </TableCell>
                <TableCell>{quota.allow_ocr ? t("yes") : t("no")}</TableCell>
                <TableCell>
                  {dayjs(quota.created_date).format("D MMMM YYYY")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {quotasQuery.isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[50px] rounded-lg" />
            <Skeleton className="h-[50px] rounded-lg" />
            <Skeleton className="h-[50px] rounded-lg" />
          </div>
        )}
        {quotasQuery.isFetched && history?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg opacity-50">
            <div className="text-8xl">
              <SidebarIcon />
            </div>
            {t("no_quotas_found")}
          </div>
        )}
        {quotasQuery.data &&
          (quotasQuery.data.next || quotasQuery.data.previous) && (
            <PaginationControls
              data={quotasQuery.data}
              onPageChange={(url) => navigate(url)}
            />
          )}
      </div>
    </div>
  );
}
