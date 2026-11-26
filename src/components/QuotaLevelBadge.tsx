import { useTranslation } from "react-i18next";

import { Badge } from "@/components/ui/badge";
import { I18NNAMESPACE } from "@/utils/constants";
import { getQuotaLevel } from "@/utils/quota-utils";
import { cn } from "@/utils/utils";

export default function QuotaLevelBadge(props: {
  used: number;
  total: number;
}) {
  const { t } = useTranslation(I18NNAMESPACE);
  const level = getQuotaLevel(props.used, props.total);

  if (level === "ok") return null;

  return (
    <Badge
      variant={level === "low" ? "outline" : "destructive"}
      className={cn(
        level === "low" && "border-amber-300 bg-amber-50 text-amber-900",
      )}
    >
      {t(`quota_level_${level}`)}
    </Badge>
  );
}
