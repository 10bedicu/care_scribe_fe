import { ScribeQuota, ScribeQuotaBulkChanges } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from "./ui/sheet";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { useState } from "react";
import { I18NNAMESPACE } from "@/utils/constants";
import { useTranslation } from "react-i18next";
import { useContainerRef } from "@/hooks/useContainerRef";

type FeatureKey = "allow_scribe" | "allow_ocr" | "allow_notes_scribe";
type FeatureChange = "keep" | "enable" | "disable";

const FEATURES: { key: FeatureKey; label: string }[] = [
  { key: "allow_scribe", label: "forms" },
  { key: "allow_ocr", label: "ocr" },
  { key: "allow_notes_scribe", label: "notes" },
];

const FEATURE_CHANGES: FeatureChange[] = ["keep", "enable", "disable"];

const INITIAL_FEATURES: Record<FeatureKey, FeatureChange> = {
  allow_scribe: "keep",
  allow_ocr: "keep",
  allow_notes_scribe: "keep",
};

export default function BulkQuotaEditSheet(props: {
  quotas: ScribeQuota[];
  open: boolean;
  onClose: () => void;
  onSubmit: (changes: ScribeQuotaBulkChanges) => Promise<unknown>;
}) {
  const { quotas, open, onClose, onSubmit } = props;
  const { t } = useTranslation(I18NNAMESPACE);
  const containerRef = useContainerRef();

  const [tokens, setTokens] = useState("");
  const [tokensPerUser, setTokensPerUser] = useState("");
  const [features, setFeatures] = useState(INITIAL_FEATURES);
  const [submitting, setSubmitting] = useState(false);

  const changes: ScribeQuotaBulkChanges = {};
  if (tokens !== "") changes.tokens = Number(tokens);
  if (tokensPerUser !== "") changes.tokens_per_user = Number(tokensPerUser);
  for (const { key } of FEATURES) {
    if (features[key] !== "keep") changes[key] = features[key] === "enable";
  }

  const isValid =
    Object.keys(changes).length > 0 &&
    (changes.tokens === undefined || changes.tokens >= 1) &&
    (changes.tokens_per_user === undefined || changes.tokens_per_user >= 0);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(changes);
    } catch {
      // Parent reports the error; keep the form intact so it can be corrected.
      return;
    } finally {
      setSubmitting(false);
    }
    setTokens("");
    setTokensPerUser("");
    setFeatures(INITIAL_FEATURES);
  };

  return (
    <Sheet open={open} onOpenChange={onClose} modal={false}>
      <SheetContent portalProps={{ container: containerRef?.current }}>
        <SheetTitle className="p-4">
          {t("bulk_edit_quotas", { count: quotas.length })}
        </SheetTitle>
        <SheetDescription className="sr-only">
          {t("bulk_edit_quotas_description")}
        </SheetDescription>
        <div className="overflow-y-auto p-4 pt-0">
          <div className="flex max-h-32 flex-wrap gap-1 overflow-y-auto">
            {quotas.map((quota) => (
              <Badge key={quota.external_id} variant="secondary">
                {quota.facility?.name || quota.user?.username}
              </Badge>
            ))}
          </div>
          <p className="mt-4 text-sm text-neutral-500">
            {t("bulk_edit_quotas_hint")}
          </p>
          <div className="mt-4">
            <label htmlFor="bulk-tokens">{t("tokens")}</label>
            <Input
              id="bulk-tokens"
              type="number"
              min={1}
              placeholder={t("keep_current_value")}
              value={tokens}
              onChange={(e) => setTokens(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <label htmlFor="bulk-tokens-per-user">{t("tokens_per_user")}</label>
            <Input
              id="bulk-tokens-per-user"
              type="number"
              min={0}
              placeholder={t("keep_current_value")}
              value={tokensPerUser}
              onChange={(e) => setTokensPerUser(e.target.value)}
            />
          </div>
          <div className="mt-4">
            <h2 className="text-lg font-medium">{t("features")}</h2>
            <div className="mt-2 flex flex-col gap-3">
              {FEATURES.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between">
                  <span id={`bulk-${key}`}>{t(label)}</span>
                  <div
                    role="group"
                    aria-labelledby={`bulk-${key}`}
                    className="flex gap-1 rounded-md border p-0.5"
                  >
                    {FEATURE_CHANGES.map((option) => (
                      <Button
                        key={option}
                        type="button"
                        size="sm"
                        variant={features[key] === option ? "primary" : "ghost"}
                        aria-pressed={features[key] === option}
                        onClick={() =>
                          setFeatures({ ...features, [key]: option })
                        }
                      >
                        {t(`bulk_feature_${option}`)}
                      </Button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <SheetFooter className="p-0">
            <Button
              disabled={submitting || !isValid}
              onClick={handleSubmit}
              className="mt-4 w-full"
            >
              {t("update_quotas", { count: quotas.length })}
            </Button>
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
