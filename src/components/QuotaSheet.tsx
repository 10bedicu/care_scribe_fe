import { ScribeQuota, ScribeQuotaCreateRequest } from "@/types";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from "./ui/sheet";
import { containerRefAtom } from "@/store";
import { useAtom } from "jotai";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { I18NNAMESPACE } from "@/utils/constants";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { API } from "@/utils/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";

export default function QuotaSheet(props: {
  quota?: ScribeQuota;
  open: boolean;
  onClose: () => void;
  onSubmit: (quota: ScribeQuotaCreateRequest) => void;
  onDelete: () => void;
}) {
  const { quota: initQuota, open, onClose, onSubmit } = props;
  const { t } = useTranslation(I18NNAMESPACE);

  const [containerRef] = useAtom(containerRefAtom);

  const [quota, setQuota] = useState<ScribeQuotaCreateRequest>({
    facility_external_id: "",
    tokens: 1000000,
    allow_ocr: false,
    tokens_per_user: 100000,
  });

  const facilityQuery = useQuery({
    queryKey: ["all-facilities"],
    queryFn: () => API.facilities.all({ limit: 50 }),
  });

  useEffect(() => {
    if (initQuota) {
      setQuota({
        facility_external_id: initQuota?.facility.id || "",
        tokens: quota.tokens,
        allow_ocr: quota.allow_ocr,
        tokens_per_user: initQuota.tokens_per_user,
      });
    }
  }, [initQuota]);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        portalProps={{ container: containerRef?.current }}
        className=""
      >
        <SheetTitle className="p-4">
          {initQuota ? t("edit_quota") : t("new_quota")}
        </SheetTitle>
        <SheetDescription className="sr-only">
          Set/Edit the quota for a user or facility. This will allow them to use
          Scribe services based on the number of tokens allocated.
        </SheetDescription>
        <div className="p-4 pt-0">
          {!initQuota?.external_id && (
            <>
              <label>{t("facility")}</label>
              <Select
                value={quota.facility_external_id || ""}
                onValueChange={(value) => {
                  setQuota({
                    ...quota,
                    facility_external_id: value,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("facility")} />
                </SelectTrigger>
                <SelectContent>
                  {facilityQuery.data?.results.map((facility) => (
                    <SelectItem key={facility.id} value={facility.id || ""}>
                      {facility.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </>
          )}
          <div className="mt-4">
            <label>{t("tokens")}</label>
            <Input
              type="number"
              min={1}
              value={quota.tokens}
              onChange={(e) =>
                setQuota({ ...quota, tokens: Number(e.target.value) })
              }
            />
          </div>
          <div className="mt-4">
            <label>{t("tokens_per_user")}</label>
            <Input
              type="number"
              min={1}
              value={quota.tokens_per_user}
              onChange={(e) =>
                setQuota({
                  ...quota,
                  tokens_per_user: Number(e.target.value),
                })
              }
            />
          </div>
          <div className="mt-4 flex items-center gap-2">
            <label>{t("ocr_allowed")}</label>
            <Switch
              checked={quota.allow_ocr}
              onCheckedChange={(checked) =>
                setQuota({ ...quota, allow_ocr: checked })
              }
            />
          </div>
          <SheetFooter className="p-0">
            <SheetClose>
              <Button
                disabled={!quota.facility_external_id || quota.tokens < 1}
                onClick={() => {
                  onSubmit(quota);
                  setQuota({
                    facility_external_id: "",
                    tokens: 1000000,
                    allow_ocr: false,
                    tokens_per_user: 100000,
                  });
                }}
                className="mt-4 w-full"
              >
                {initQuota ? t("update_quota") : t("create_quota")}
              </Button>
            </SheetClose>
            {initQuota?.external_id && (
              <SheetClose>
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={props.onDelete}
                >
                  {t("delete_quota")}
                </Button>
              </SheetClose>
            )}
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
