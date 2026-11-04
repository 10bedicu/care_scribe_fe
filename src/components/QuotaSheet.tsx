import {
  FacilityModel,
  ScribeQuota,
  ScribeQuotaCreateRequest,
  ScribeQuotaFacilityOption,
} from "@/types";
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
import { CheckIcon, CaretSortIcon, Cross2Icon } from "@radix-ui/react-icons";
import { cn } from "@/utils/utils";
import { Skeleton } from "./ui/skeleton";
import { Badge } from "./ui/badge";
import { BatchFailure } from "@/utils/batch";

const FACILITY_RESULTS = 50;
// CARE caps list endpoints at limit=200.
const PAGE_SIZE = 200;

const fetchAssignedFacilityIds = async () => {
  const ids = new Set<string>();
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await API.quotas.list({ limit: PAGE_SIZE, offset });
    page.results.forEach((quota) => {
      if (quota.facility?.id) ids.add(quota.facility.id);
    });
    if (!page.next) return ids;
  }
};

// Pages through facilities so assigned ones being filtered out don't leave the list short.
const fetchUnassignedFacilities = async (
  search: string,
  assigned: Set<string>,
) => {
  const results: FacilityModel[] = [];
  for (let offset = 0; results.length < FACILITY_RESULTS; offset += PAGE_SIZE) {
    const page = await API.facilities.all({
      search_text: search || undefined,
      limit: PAGE_SIZE,
      offset,
    });
    results.push(
      ...page.results.filter(
        (facility) => facility.id && !assigned.has(facility.id),
      ),
    );
    if (offset + PAGE_SIZE >= page.count) break;
  }
  return results.slice(0, FACILITY_RESULTS);
};

export default function QuotaSheet(props: {
  quota?: ScribeQuota;
  open: boolean;
  onClose: () => void;
  onSubmit: (
    quota: ScribeQuotaCreateRequest,
    facilities: ScribeQuotaFacilityOption[],
  ) => Promise<unknown>;
  onDelete: () => void;
}) {
  const { quota: initQuota, open, onClose, onSubmit } = props;
  const { t } = useTranslation(I18NNAMESPACE);

  const containerRef = useContainerRef();

  const [quota, setQuota] = useState<ScribeQuotaCreateRequest>({
    facility_external_id: "",
    tokens: 1000000,
    allow_ocr: false,
    allow_scribe: true,
    allow_notes_scribe: true,
    tokens_per_user: 100000,
  });

  const [selectedFacilities, setSelectedFacilities] = useState<
    ScribeQuotaFacilityOption[]
  >([]);

  const toggleFacility = (facility: ScribeQuotaFacilityOption) => {
    setSelectedFacilities((prev) =>
      prev.some((f) => f.id === facility.id)
        ? prev.filter((f) => f.id !== facility.id)
        : [...prev, facility],
    );
  };

  const isCreating = !initQuota?.external_id;

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    const submitted = isCreating ? selectedFacilities : [];
    // Only drop processed facilities; others may have been selected while the request was pending.
    const deselect = (ids: string[]) =>
      setSelectedFacilities((prev) =>
        prev.filter((facility) => !ids.includes(facility.id)),
      );

    setSubmitting(true);
    try {
      await onSubmit(quota, submitted);
    } catch (error) {
      if (error instanceof BatchFailure) {
        deselect(
          submitted
            .map((facility) => facility.id)
            .filter((id) => !error.failed.includes(id)),
        );
        assignedQuery.refetch();
      }
      // Parent reports the error; keep the form intact so it can be corrected.
      return;
    } finally {
      setSubmitting(false);
    }
    if (isCreating) {
      deselect(submitted.map((facility) => facility.id));
      setQuota({
        facility_external_id: "",
        tokens: 1000000,
        allow_ocr: false,
        allow_scribe: true,
        allow_notes_scribe: true,
        tokens_per_user: 100000,
      });
    }
  };

  const [comboboxOpen, setComboboxOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState(searchQuery);

  // Refetch on every open so newly assigned or freed facilities are reflected.
  const assignedQuery = useQuery({
    queryKey: ["scribe-assigned-facility-ids"],
    queryFn: fetchAssignedFacilityIds,
    enabled: open && isCreating,
  });

  const facilityQuery = useQuery({
    queryKey: [
      "scribe-unassigned-facilities",
      debouncedSearchQuery,
      assignedQuery.dataUpdatedAt,
    ],
    queryFn: () =>
      fetchUnassignedFacilities(debouncedSearchQuery, assignedQuery.data!),
    enabled: open && isCreating && !!assignedQuery.data,
  });

  useEffect(() => {
    if (initQuota) {
      setQuota({
        facility_external_id: initQuota?.facility.id || "",
        tokens: initQuota.tokens,
        allow_ocr: initQuota.allow_ocr,
        allow_scribe: initQuota.allow_scribe,
        allow_notes_scribe: initQuota.allow_notes_scribe,
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
        <div className="overflow-y-auto p-4 pt-0">
          {isCreating && (
            <>
              <label>{t("facilities")}</label>
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
                    {selectedFacilities.length
                      ? t("n_facilities_selected", {
                          count: selectedFacilities.length,
                        })
                      : t("select_facilities")}
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
                      {(assignedQuery.isLoading || facilityQuery.isLoading) && (
                        <div className="flex w-full flex-col gap-1 p-1">
                          <Skeleton className="h-[35px] w-full rounded-lg" />
                          <Skeleton className="h-[35px] w-full rounded-lg" />
                          <Skeleton className="h-[35px] w-full rounded-lg" />
                        </div>
                      )}
                      {facilityQuery.isFetched &&
                        facilityQuery.data?.length === 0 && (
                          <CommandEmpty>{t("no_facility_found")}</CommandEmpty>
                        )}
                      <CommandGroup>
                        {facilityQuery.data?.map((facility) => (
                          <CommandItem
                            key={facility.id}
                            value={facility.id || ""}
                            onSelect={() =>
                              toggleFacility({
                                id: facility.id || "",
                                name: facility.name || "",
                              })
                            }
                          >
                            {facility.name}
                            <CheckIcon
                              className={cn(
                                "ml-auto h-4 w-4",
                                selectedFacilities.some(
                                  (f) => f.id === facility.id,
                                )
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
              {selectedFacilities.length > 0 && (
                <div className="mt-2 flex max-h-32 flex-wrap gap-1 overflow-y-auto">
                  {selectedFacilities.map((facility) => (
                    <Badge
                      key={facility.id}
                      variant="secondary"
                      className="gap-1"
                    >
                      {facility.name}
                      <button
                        type="button"
                        aria-label={t("remove_facility", {
                          name: facility.name,
                        })}
                        onClick={() => toggleFacility(facility)}
                      >
                        <Cross2Icon className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
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
          <div className="mt-4">
            <h2 className="text-lg font-medium">{t("features")}</h2>
            <div className="mt-2 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <label>{t("forms")}</label>
                <Switch
                  className="data-[state=checked]:bg-primary-700"
                  checked={quota.allow_scribe}
                  onCheckedChange={(checked) =>
                    setQuota({ ...quota, allow_scribe: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <label>{t("ocr")}</label>
                <Switch
                  className="data-[state=checked]:bg-primary-700"
                  checked={quota.allow_ocr}
                  onCheckedChange={(checked) =>
                    setQuota({ ...quota, allow_ocr: checked })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <label>{t("notes")}</label>
                <Switch
                  className="data-[state=checked]:bg-primary-700"
                  checked={quota.allow_notes_scribe}
                  onCheckedChange={(checked) =>
                    setQuota({ ...quota, allow_notes_scribe: checked })
                  }
                />
              </div>
            </div>
          </div>
          <SheetFooter className="p-0">
            <Button
              disabled={
                submitting ||
                (isCreating
                  ? !selectedFacilities.length
                  : !quota.facility_external_id) ||
                quota.tokens < 1
              }
              onClick={handleSubmit}
              className="mt-4 w-full"
            >
              {initQuota ? t("update_quota") : t("create_quota")}
            </Button>
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
