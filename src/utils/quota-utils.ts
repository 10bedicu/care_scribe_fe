import { ScribeQuota } from "@/types";

export const LOW_QUOTA_THRESHOLD = 0.2;
export const CRITICAL_QUOTA_THRESHOLD = 0.05;

export type QuotaLevel = "ok" | "low" | "critical" | "exhausted";

export type QuotaStatus = {
  level: QuotaLevel;
  scope: "user" | "facility";
  used: number;
  remaining: number;
  total: number;
  percentRemaining: number;
};

const LEVEL_SEVERITY: Record<QuotaLevel, number> = {
  ok: 0,
  low: 1,
  critical: 2,
  exhausted: 3,
};

export const getQuotaLevel = (used: number, total: number): QuotaLevel => {
  const remaining = total - used;
  // Mirrors the backend check (`used >= limit`) that fails a scribe run.
  if (total <= 0 || remaining <= 0) return "exhausted";
  const fraction = remaining / total;
  if (fraction <= CRITICAL_QUOTA_THRESHOLD) return "critical";
  if (fraction <= LOW_QUOTA_THRESHOLD) return "low";
  return "ok";
};

// Percentage left with one decimal. Only a truly exhausted quota reads 0%
// (and a fully unused one 100%), so "100% used" always means blocked.
const percentLeft = (remaining: number, total: number) => {
  if (total <= 0 || remaining <= 0) return 0;
  if (remaining >= total) return 100;
  const percent = Math.round((remaining / total) * 1000) / 10;
  return Math.min(Math.max(percent, 0.1), 99.9);
};

const buildStatus = (
  scope: QuotaStatus["scope"],
  used: number,
  total: number,
): QuotaStatus => {
  const remaining = Math.max(total - used, 0);
  return {
    level: getQuotaLevel(used, total),
    scope,
    used,
    remaining,
    total,
    percentRemaining: percentLeft(remaining, total),
  };
};

const remainingFraction = (status: QuotaStatus) =>
  status.total > 0 ? status.remaining / status.total : 0;

/**
 * Returns the most restrictive quota status for the current user, combining
 * the facility pool and the user's per-user allocation (as returned by
 * `my-quota`). A user without a quota row yet (T&C not accepted) has used 0.
 */
export const getMyQuotaStatus = (
  quotas?: ScribeQuota[],
): QuotaStatus | undefined => {
  const facilityQuota = quotas?.find((q) => !q.user);
  if (!facilityQuota) return undefined;
  const userQuota = quotas?.find((q) => !!q.user);

  const facilityStatus = buildStatus(
    "facility",
    facilityQuota.used,
    facilityQuota.tokens,
  );
  const userStatus = buildStatus(
    "user",
    userQuota?.used ?? 0,
    facilityQuota.tokens_per_user,
  );

  const facilitySeverity = LEVEL_SEVERITY[facilityStatus.level];
  const userSeverity = LEVEL_SEVERITY[userStatus.level];
  if (facilitySeverity !== userSeverity) {
    return facilitySeverity > userSeverity ? facilityStatus : userStatus;
  }
  // Same severity: report whichever is closer to running out (unrounded).
  return remainingFraction(facilityStatus) < remainingFraction(userStatus)
    ? facilityStatus
    : userStatus;
};

export const isQuotaAlert = (status?: QuotaStatus) =>
  !!status && status.level !== "ok";

export const quotaAlertMessageKey = (status: QuotaStatus) =>
  status.level === "exhausted"
    ? status.scope === "user"
      ? "quota_exhausted_user"
      : "quota_exhausted_facility"
    : status.scope === "user"
      ? "quota_low_user"
      : "quota_low_facility";

export const isQuotaExhausted = (status?: QuotaStatus) =>
  status?.level === "exhausted";

// Derived from percentRemaining so the menu and banner always add up to 100.
export const quotaUsedPercent = (status: QuotaStatus) =>
  Math.round((100 - status.percentRemaining) * 10) / 10;

export const formatQuotaPercent = (percent: number) =>
  percent.toLocaleString(undefined, { maximumFractionDigits: 1 });
