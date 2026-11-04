import SidebarIcon from "@/components/Icon";
import BulkQuotaEditSheet from "@/components/BulkQuotaEditSheet";
import { PaginationControls } from "@/components/Pagination";
import QuotaSheet from "@/components/QuotaSheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  ScribeQuotaBulkChanges,
  ScribeQuotaCreateRequest,
  ScribeQuotaFacilityOption,
  ScribeQuotaFilter,
} from "@/types";
import { API } from "@/utils/api";
import { BatchFailure, BatchOutcome, runBatched } from "@/utils/batch";
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
import { useContainerRef } from "@/hooks/useContainerRef";

const quotaLabel = (quota?: ScribeQuota) =>
  quota?.facility ? quota.facility.name : quota?.user?.username;

const QUOTA_URL = "/api/care_scribe/quota/";

export default function ScribeQuotas() {
  const { t } = useTranslation(I18NNAMESPACE);

  const [showCreateQuotaSheet, setShowCreateQuotaSheet] = useState(false);
  const [showBulkEditSheet, setShowBulkEditSheet] = useState(false);
  const [showBulkDeleteDialog, setShowBulkDeleteDialog] = useState(false);
  const containerRef = useContainerRef();
  // Keyed by external_id so selection persists across pages and searches.
  const [selectedQuotas, setSelectedQuotas] = useState<
    Record<string, ScribeQuota>
  >({});
  const selectedList = Object.values(selectedQuotas);

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
        ordering: filters.ordering,
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

  const reportOutcome = (
    outcome: BatchOutcome,
    labelFor: (id: string) => string | undefined,
    successKey: string,
    failureKey: string,
  ) => {
    if (outcome.succeeded.length) {
      toast.success(t(successKey, { count: outcome.succeeded.length }));
      quotasQuery.refetch();
    }
    if (!outcome.failed.length) return;

    const messages = Object.entries(outcome.errors).map(
      ([id, message]) => `${labelFor(id) || id}: ${message}`,
    );
    toast.error(t(failureKey, { count: outcome.failed.length }), {
      description: messages.length ? (
        <ul className="list-disc pl-4">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      ) : undefined,
    });
  };

  // Only drop processed quotas; others may have been selected while the request was pending.
  const deselect = (ids: string[]) =>
    setSelectedQuotas((prev) =>
      Object.fromEntries(
        Object.entries(prev).filter(([id]) => !ids.includes(id)),
      ),
    );

  const newQuotasMutation = useMutation({
    mutationFn: ({
      quota,
      facilities,
    }: {
      quota: ScribeQuotaCreateRequest;
      facilities: ScribeQuotaFacilityOption[];
    }) =>
      runBatched(
        facilities.map((facility) => ({
          reference_id: facility.id,
          url: QUOTA_URL,
          method: "POST",
          body: { ...quota, facility_external_id: facility.id },
        })),
      ),
    onSuccess: (outcome, { facilities }) => {
      reportOutcome(
        outcome,
        (id) => facilities.find((facility) => facility.id === id)?.name,
        "quotas_created_successfully",
        "bulk_quota_creation_failed",
      );
      if (outcome.succeeded.length) setQueryParams({ page: 1 });
      if (!outcome.failed.length) setShowCreateQuotaSheet(false);
    },
  });

  const handleSearch = debounce((value: string) => {
    setSearch(value);
    setQueryParams({ page: 1 });
  }, 500);

  const bulkUpdateMutation = useMutation({
    mutationFn: (changes: ScribeQuotaBulkChanges) =>
      runBatched(
        selectedList.map((quota) => ({
          reference_id: quota.external_id,
          url: `${QUOTA_URL}${quota.external_id}/`,
          method: "PATCH",
          body: changes,
        })),
      ),
    onSuccess: (outcome) => {
      reportOutcome(
        outcome,
        (id) => quotaLabel(selectedQuotas[id]),
        "quotas_updated_successfully",
        "bulk_quota_update_failed",
      );
      deselect(outcome.succeeded);
      if (!outcome.failed.length) setShowBulkEditSheet(false);
    },
  });

  const quotas = quotasQuery.data?.results;

  const bulkDeleteMutation = useMutation({
    mutationFn: () =>
      runBatched(
        selectedList.map((quota) => ({
          reference_id: quota.external_id,
          url: `${QUOTA_URL}${quota.external_id}/`,
          method: "DELETE",
          body: {},
        })),
      ),
    onSuccess: (outcome) => {
      reportOutcome(
        outcome,
        (id) => quotaLabel(selectedQuotas[id]),
        "quotas_deleted_successfully",
        "bulk_quota_deletion_failed",
      );
      deselect(outcome.succeeded);
      if (outcome.succeeded.length) setQueryParams({ page: 1 });
      if (!outcome.failed.length) setShowBulkDeleteDialog(false);
    },
  });

  const selectedOnPage =
    quotas?.filter((quota) => selectedQuotas[quota.external_id]).length ?? 0;
  const allOnPageSelected =
    !!quotas?.length && selectedOnPage === quotas.length;

  const toggleQuota = (quota: ScribeQuota, checked: boolean) => {
    setSelectedQuotas((prev) => {
      const next = { ...prev };
      if (checked) next[quota.external_id] = quota;
      else delete next[quota.external_id];
      return next;
    });
  };

  const togglePage = () => {
    quotas?.forEach((quota) => toggleQuota(quota, !allOnPageSelected));
  };

  return (
    <div className="px-4 md:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {t("scribe_quotas")}
        </h1>
        <div className="flex items-center gap-2">
          {selectedList.length > 0 && (
            <>
              <span className="text-sm text-neutral-500">
                {t("n_selected", { count: selectedList.length })}
              </span>
              <Button variant="ghost" onClick={() => setSelectedQuotas({})}>
                {t("clear_selection")}
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowBulkEditSheet(true)}
              >
                {t("edit_selected")}
              </Button>
              <Button
                variant="destructive"
                onClick={() => setShowBulkDeleteDialog(true)}
              >
                {t("delete_selected")}
              </Button>
            </>
          )}
          <Button onClick={() => setShowCreateQuotaSheet(true)}>
            {t("new_quota")}
          </Button>
        </div>
        <QuotaSheet
          open={showCreateQuotaSheet}
          onClose={() => setShowCreateQuotaSheet(false)}
          onSubmit={async (quota, facilities) => {
            const { failed } = await newQuotasMutation.mutateAsync({
              quota,
              facilities,
            });
            if (failed.length) throw new BatchFailure(failed);
          }}
          onDelete={() => console.log("Delete not possible")}
        />
        <BulkQuotaEditSheet
          quotas={selectedList}
          open={showBulkEditSheet}
          onClose={() => setShowBulkEditSheet(false)}
          onSubmit={async (changes) => {
            const { failed } = await bulkUpdateMutation.mutateAsync(changes);
            if (failed.length) throw new BatchFailure(failed);
          }}
        />
        <Dialog
          open={showBulkDeleteDialog}
          onOpenChange={setShowBulkDeleteDialog}
        >
          <DialogContent portalProps={{ container: containerRef?.current }}>
            <DialogHeader>
              <DialogTitle>
                {t("bulk_delete_quotas", { count: selectedList.length })}
              </DialogTitle>
              <DialogDescription>
                {t("bulk_delete_quotas_description")}
              </DialogDescription>
            </DialogHeader>
            <ul className="max-h-48 list-disc overflow-y-auto pl-5 text-sm">
              {selectedList.map((quota) => (
                <li key={quota.external_id}>{quotaLabel(quota)}</li>
              ))}
            </ul>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowBulkDeleteDialog(false)}
              >
                {t("cancel")}
              </Button>
              <Button
                variant="destructive"
                disabled={bulkDeleteMutation.isPending}
                onClick={() => bulkDeleteMutation.mutate()}
              >
                {t("delete_quotas", { count: selectedList.length })}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
              <TableHead className="w-10">
                <Checkbox
                  aria-label={t("select_all_on_page")}
                  checked={
                    allOnPageSelected
                      ? true
                      : selectedOnPage > 0
                        ? "indeterminate"
                        : false
                  }
                  onCheckedChange={togglePage}
                />
              </TableHead>
              <TableHead>{t("facility")}</TableHead>
              <TableHead>{t("tokens")}</TableHead>
              <TableHead>{t("tokens_per_user")}</TableHead>
              <TableHead>{t("used_tokens")}</TableHead>
              <TableHead>{t("available_tokens")}</TableHead>
              <TableHead>{t("features")}</TableHead>
              <TableHead>{t("created_at")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotas?.map((quota) => (
              <TableRow
                key={quota.external_id}
                className="cursor-pointer"
                onClick={() => {
                  navigate(`/admin/scribe/quotas/${quota.external_id}`);
                }}
              >
                <TableCell onClick={(e) => e.stopPropagation()}>
                  <Checkbox
                    aria-label={t("select_quota", { name: quotaLabel(quota) })}
                    checked={!!selectedQuotas[quota.external_id]}
                    onCheckedChange={(checked) =>
                      toggleQuota(quota, checked === true)
                    }
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    {quota.facility ? <HomeIcon /> : <PersonIcon />}
                    {quotaLabel(quota)}
                  </div>
                </TableCell>
                <TableCell>{quota.tokens.toLocaleString()}</TableCell>
                <TableCell>{quota.tokens_per_user.toLocaleString()}</TableCell>
                <TableCell>{quota.used.toLocaleString()}</TableCell>
                <TableCell>
                  {(quota.tokens - quota.used).toLocaleString()}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap items-center gap-1">
                    {quota.allow_ocr && (
                      <Badge variant="secondary">{t("ocr")}</Badge>
                    )}
                    {quota.allow_notes_scribe && (
                      <Badge variant="secondary">{t("notes")}</Badge>
                    )}
                    {quota.allow_scribe && (
                      <Badge variant="secondary">{t("forms")}</Badge>
                    )}
                    {!quota.allow_ocr &&
                      !quota.allow_notes_scribe &&
                      !quota.allow_scribe && (
                        <span className="text-neutral-400">—</span>
                      )}
                  </div>
                </TableCell>
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
        {quotasQuery.isFetched && quotas?.length === 0 && (
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
