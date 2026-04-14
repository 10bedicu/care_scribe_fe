import { ScribeQuota, ScribeQuotaCreateRequest } from "@/types";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
} from "./ui/sheet";
import { Input } from "./ui/input";
import { Switch } from "./ui/switch";
import { Button } from "./ui/button";
import { useEffect, useState } from "react";
import { I18NNAMESPACE } from "@/utils/constants";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { API } from "@/utils/api";
import { useContainerRef } from "@/hooks/useContainerRef";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "./ui/command";
import { CheckIcon, CaretSortIcon } from "@radix-ui/react-icons";
import { cn } from "@/utils/utils";
import { Skeleton } from "./ui/skeleton";

export default function QuotaSheet(props: {
  quota?: ScribeQuota;
  open: boolean;
  onClose: () => void;
  onSubmit: (quota: ScribeQuotaCreateRequest) => void;
  onDelete: () => void;
}) {
  const { quota: initQuota, open, onClose, onSubmit } = props;
  const { t } = useTranslation(I18NNAMESPACE);

  const containerRef = useContainerRef();

  const [quota, setQuota] = useState<ScribeQuotaCreateRequest>({
    facility_external_id: "",
    tokens: 1000000,
    allow_ocr: false,
    enable_live_transcription: false,
    tokens_per_user: 100000,
  });

  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  const facilityQuery = useQuery({
    queryKey: ["all-facilities", debouncedSearchQuery],
    queryFn: () =>
      API.facilities.all({ limit: 50, search_text: debouncedSearchQuery }),
  });

  useEffect(() => {
    if (initQuota) {
      setQuota({
        facility_external_id: initQuota?.facility.id || "",
        tokens: initQuota.tokens,
        allow_ocr: initQuota.allow_ocr,
        enable_live_transcription: initQuota.enable_live_transcription,
        tokens_per_user: initQuota.tokens_per_user,
      });
    }
  }, [initQuota]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery);
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchQuery]);

  return (
    <Sheet open={open} onOpenChange={onClose} modal={false}>
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
              <Popover
                modal={false}
                open={comboboxOpen}
                onOpenChange={setComboboxOpen}
              >
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={comboboxOpen}
                    className="w-full justify-between"
                  >
                    {quota.facility_external_id
                      ? facilityQuery.data?.results.find(
                          (facility) =>
                            facility.id === quota.facility_external_id,
                        )?.name
                      : t("facility")}
                    <CaretSortIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  portalProps={{ container: containerRef?.current }}
                  className="pointer-events-auto w-[400px] p-0"
                >
                  <Command shouldFilter={false}>
                    <CommandInput
                      className="border-0 ring-0"
                      placeholder={t("facility")}
                      value={searchQuery}
                      onValueChange={setSearchQuery}
                    />
                    <CommandList>
                      {facilityQuery.isLoading && (
                        <div className="flex w-full flex-col gap-1 p-1">
                          <Skeleton className="h-[35px] w-full rounded-lg" />
                          <Skeleton className="h-[35px] w-full rounded-lg" />
                          <Skeleton className="h-[35px] w-full rounded-lg" />
                        </div>
                      )}
                      {facilityQuery.isFetched &&
                        facilityQuery.data?.results.length === 0 && (
                          <CommandEmpty>{t("no_facility_found")}</CommandEmpty>
                        )}
                      <CommandGroup>
                        {facilityQuery.data?.results.map((facility) => (
                          <CommandItem
                            key={facility.id}
                            value={facility.id || ""}
                            onSelect={(currentValue) => {
                              setQuota({
                                ...quota,
                                facility_external_id: currentValue,
                              });
                              setComboboxOpen(false);
                            }}
                          >
                            {facility.name}
                            <CheckIcon
                              className={cn(
                                "ml-auto h-4 w-4",
                                quota.facility_external_id === facility.id
                                  ? "opacity-100"
                                  : "opacity-0",
                              )}
                            />
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
          <div className="mt-4 flex items-center gap-2">
            <label>{t("live_transcription")}</label>
            <Switch
              checked={quota.enable_live_transcription}
              onCheckedChange={(checked) =>
                setQuota({ ...quota, enable_live_transcription: checked })
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
                    enable_live_transcription: false,
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
                  variant="secondary"
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
