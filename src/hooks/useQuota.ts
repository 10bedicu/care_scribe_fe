import { API } from "@/utils/api";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

export const useQuota = (facilityId?: string) => {
  const quotaQuery = useQuery({
    queryKey: ["my-quota", facilityId],
    queryFn: () => API.quotas.myQuota(facilityId),
    retry: false,
  });

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
    acceptTnc: acceptTncMutation.mutate,
    isLoading: quotaQuery.isLoading,
    isError: quotaQuery.isError,
    refetch: quotaQuery.refetch,
  };
};
