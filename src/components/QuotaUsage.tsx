import { useTranslation } from "react-i18next";

import { I18NNAMESPACE } from "@/utils/constants";
import { QuotaStatus, quotaUsedPercent } from "@/utils/quota-utils";
import { cn } from "@/utils/utils";

export default function QuotaUsage(props: { status: QuotaStatus }) {
  const { status } = props;
  const { t } = useTranslation(I18NNAMESPACE);
  const usedPercent = quotaUsedPercent(status);

  return (
    <div className="px-2 py-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{t("usage")}</span>
        <span className="text-neutral-600">
          {t("quota_percent_used", { percent: usedPercent })}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={t("usage")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={usedPercent}
        className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200"
      >
        <div
          className={cn(
            "h-full rounded-full transition-all",
            status.level === "ok"
              ? "bg-primary-500"
              : status.level === "low"
                ? "bg-amber-400"
                : "bg-red-500",
          )}
          style={{ width: `${usedPercent}%` }}
        />
      </div>
      <div className="mt-1 text-[10px] text-neutral-500">
        {t(
          status.scope === "user"
            ? "quota_tokens_used"
            : "quota_tokens_used_facility",
          {
            used: status.used.toLocaleString(),
            total: status.total.toLocaleString(),
          },
        )}
      </div>
    </div>
  );
}
