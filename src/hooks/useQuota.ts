import { API } from "@/utils/api";
import { I18NNAMESPACE } from "@/utils/constants";
import { getMyQuotaStatus, quotaAlertMessageKey } from "@/utils/quota-utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

const lowQuotaWarned = new Set<string>();

export const useQuota = (facilityId?: string) => {
  const { t } = useTranslation(I18NNAMESPACE);
  const quotaQuery = useQuery({
    queryKey: ["my-quota", facilityId],
    queryFn: () => API.quotas.myQuota(facilityId),
    retry: false,
  });

  const status = getMyQuotaStatus(quotaQuery.data?.quotas);

  /**
   * Call before starting a scribe run. Warns when tokens are running low and
   * returns false when the quota is exhausted, so the doctor isn't left with
   * a recording that the backend will refuse to process.
   */
  const checkBeforeStart = () => {
    if (!status || status.level === "ok") return true;
    const message = t(quotaAlertMessageKey(status), {
      percent: status.percentRemaining,
    });
    const options = { description: t("quota_contact_admin") };
    if (status.level === "exhausted") {
      toast.error(message, options);
      return false;
    }
    const warnKey = `${facilityId}:${status.scope}`;
    if (status.level === "low" && lowQuotaWarned.has(warnKey)) return true;
    lowQuotaWarned.add(warnKey);
    toast.warning(message, options);
    return true;
  };

  const acceptTncMutation = useMutation({
    mutationFn: () => API.quotas.acceptTnc(facilityId!),
    onSuccess: () => {
      quotaQuery.refetch();
      toast.success("Terms and Conditions accepted successfully.");
    },
    onError: (error: any) => {
      toast.error(
        error?.response?.data?.detail ||
          "Failed to accept Terms and Conditions.",
      );
    },
  });

  return {
    quotas: quotaQuery.data?.quotas,
    tnc: quotaQuery.data?.tnc,
    tncAccepted: quotaQuery.data?.tnc_accepted,
    status,
    checkBeforeStart,
    acceptTnc: acceptTncMutation.mutate,
    isLoading: quotaQuery.isLoading,
    isError: quotaQuery.isError,
    refetch: quotaQuery.refetch,
  };
};
