import SidebarIcon from "@/components/Icon";
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
import { ScribeQuotaFilter } from "@/types";
import { API } from "@/utils/api";
import { I18NNAMESPACE } from "@/utils/constants";
import { cn, debounce } from "@/utils/utils";
import {
  CalendarIcon,
  CameraIcon,
  CheckboxIcon,
  CookieIcon,
  HomeIcon,
  PersonIcon,
  TextAlignBottomIcon,
  TokensIcon,
} from "@radix-ui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { navigate, useQueryParams } from "raviger";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export default function ScribeQuotaUsage(props: { quotaId: string }) {
  const { quotaId } = props;

  const { t } = useTranslation(I18NNAMESPACE);
  const [{ page: initPage }, setQueryParams] = useQueryParams();
  const page = initPage || 1;

  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<ScribeQuotaFilter>({
    ordering: "-created_date",
  });
  const [openQuotaSheet, setOpenQuotaSheet] = useState(false);

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
      quotaQuery.refetch();
      setOpenQuotaSheet(false);
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
      navigate("/admin/scribe/quotas");
    },
    onError: (error: any) => {
      toast.error(
        error?.error?.non_field_errors?.[0] || t("quota_deletion_failed"),
      );
    },
  });

  const quotaQuery = useQuery({
    queryKey: ["quota", quotaId],
    queryFn: () => API.quotas.get(quotaId),
  });

  const facilityQuota = quotaQuery.data;

  const userQuotaQuery = useQuery({
    queryKey: ["scribe-user-quotas", page, search, filters],
    queryFn: () =>
      API.quotas.list({
        facility_id: facilityQuota?.facility.id,
        ordering:
          filters.ordering === "all" ? "-created_date" : filters.ordering,
        username: search || undefined,
        offset: (Number(page) - 1) * 10,
        limit: 10,
      }),
    enabled: !!facilityQuota,
  });

  const handleSearch = debounce((value: string) => {
    setSearch(value);
    setQueryParams({ page: 1 });
  }, 500);

  const quotas = userQuotaQuery.data?.results || [];

  const overviewDetails = [
    {
      icon: <HomeIcon />,
      label: t("facility"),
      value: facilityQuota?.facility.name || "",
    },
    {
      icon: <TokensIcon />,
      label: t("tokens"),
      value: facilityQuota ? facilityQuota.tokens.toLocaleString() : "",
    },
    {
      icon: <PersonIcon />,
      label: t("tokens_per_user"),
      value: facilityQuota
        ? facilityQuota.tokens_per_user.toLocaleString()
        : "",
    },
    {
      icon: <CookieIcon />,
      label: t("used_tokens"),
      value: facilityQuota ? facilityQuota.used.toLocaleString() : "",
    },
    {
      icon: <CheckboxIcon />,
      label: t("available_tokens"),
      value: facilityQuota
        ? (facilityQuota.tokens - facilityQuota.used).toLocaleString()
        : "",
    },
    {
      icon: <CameraIcon />,
      label: t("ocr_allowed"),
      value: facilityQuota
        ? facilityQuota.allow_ocr
          ? t("yes")
          : t("no")
        : "",
    },
    {
      icon: <CalendarIcon />,
      label: t("created_at"),
      value: facilityQuota
        ? dayjs(facilityQuota.created_date).format("D MMMM YYYY")
        : "",
    },
  ];

  return (
    <div className="px-4 md:px-6">
      {facilityQuota && (
        <QuotaSheet
          open={openQuotaSheet}
          onClose={() => setOpenQuotaSheet(false)}
          onSubmit={(quota) => {
            updateQuotaMutation.mutate({
              quotaId: facilityQuota.external_id,
              quota: {
                tokens: quota.tokens,
                allow_ocr: quota.allow_ocr,
                tokens_per_user: quota.tokens_per_user,
              },
            });
          }}
          onDelete={() => {
            deleteQuotaMutation.mutate(facilityQuota.external_id);
          }}
          quota={facilityQuota}
        />
      )}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {t("quota_details")}
        </h1>
        <Button onClick={() => setOpenQuotaSheet(true)}>
          {t("edit_quota")}
        </Button>
      </div>
      {quotaQuery.isLoading ? (
        <Skeleton className="mt-4 h-64 w-full" />
      ) : (
        <>
          <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
            <div
              className={cn(
                `grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`,
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
          </div>
          <div className="mt-4 flex flex-col items-center justify-between gap-2 md:flex-row">
            <Input
              placeholder={t("search_by_username")}
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
                  <SelectItem value="-used">{t("most_tokens_used")}</SelectItem>
                  <SelectItem value="used">{t("least_tokens_used")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Table className="mt-4 overflow-hidden rounded-lg border bg-white shadow-sm">
            <TableHeader>
              <TableRow>
                <TableHead>{t("user")}</TableHead>
                <TableHead>{t("used_tokens")}</TableHead>
                <TableHead>{t("available_tokens")}</TableHead>
                <TableHead>{t("started_using_since")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotas?.map((quota) => (
                <TableRow key={quota.external_id} className="cursor-pointer">
                  <TableCell className="flex items-center gap-2">
                    <PersonIcon />
                    {quota.user.username}
                  </TableCell>
                  <TableCell>{quota.used.toLocaleString()}</TableCell>
                  <TableCell>
                    {(
                      (facilityQuota?.tokens_per_user || 0) - quota.used
                    ).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    {dayjs(quota.created_date).format("D MMMM YYYY")}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {userQuotaQuery.isLoading && (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-[50px] rounded-lg" />
              <Skeleton className="h-[50px] rounded-lg" />
              <Skeleton className="h-[50px] rounded-lg" />
            </div>
          )}
          {userQuotaQuery.isFetched && quotas.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-lg opacity-50">
              <div className="text-8xl">
                <SidebarIcon />
              </div>
              {t("no_quotas_found")}
            </div>
          )}
          {quotas &&
            (userQuotaQuery.data?.next || userQuotaQuery.data?.previous) && (
              <PaginationControls
                data={userQuotaQuery.data}
                onPageChange={(url) => navigate(url)}
              />
            )}
        </>
      )}
    </div>
  );
}
