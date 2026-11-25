import { useId } from "react";
import { useTranslation } from "react-i18next";

import { I18NNAMESPACE } from "@/utils/constants";
import {
  isQuotaAlert,
  quotaAlertMessageKey,
  QuotaStatus,
} from "@/utils/quota-utils";
import { cn } from "@/utils/utils";

export default function QuotaBanner(props: {
  status?: QuotaStatus;
  placement: "top" | "bottom";
  align: "left" | "right";
}) {
  const { status, placement, align } = props;
  const { t } = useTranslation(I18NNAMESPACE);
  const tooltipId = useId();

  if (!status || !isQuotaAlert(status)) return null;

  const isTop = placement === "top";

  return (
    <div
      className={cn(
        "group/quota absolute left-1/2 z-20 -translate-x-1/2",
        isTop ? "bottom-full" : "top-full",
      )}
    >
      <div
        tabIndex={0}
        aria-describedby={tooltipId}
        className={cn(
          "cursor-default px-2.5 py-0.5 text-[10px] font-semibold whitespace-nowrap shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/40",
          isTop ? "rounded-t-md" : "rounded-b-md",
          status.level === "low"
            ? "bg-amber-400 text-amber-950"
            : "bg-red-600 text-white",
        )}
      >
        {t("quota_percent_left", { percent: status.percentRemaining })}
      </div>
      <div
        id={tooltipId}
        role="tooltip"
        className={cn(
          "invisible absolute w-60 rounded-md bg-neutral-900 px-3 py-2 text-xs text-white opacity-0 shadow-md transition-opacity group-focus-within/quota:visible group-focus-within/quota:opacity-100 group-hover/quota:visible group-hover/quota:opacity-100",
          isTop ? "bottom-full mb-1.5" : "top-full mt-1.5",
          align === "right" ? "right-0" : "left-0",
        )}
      >
        <div className="font-semibold">
          {t(quotaAlertMessageKey(status), {
            percent: status.percentRemaining,
          })}
        </div>
        <div className="mt-0.5 opacity-80">{t("quota_contact_admin")}</div>
      </div>
    </div>
  );
}
