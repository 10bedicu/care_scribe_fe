import { useState } from "react";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "./ui/sheet";
import { useInfiniteQuery } from "@tanstack/react-query";
import { API } from "@/utils/api";
import { Card, CardDescription, CardHeader, CardTitle } from "./ui/card";
import dayjs from "dayjs";
import { ScribeModel } from "@/types";
import { useTranslation } from "react-i18next";
import { I18NNAMESPACE } from "@/utils/constants";
import { Skeleton } from "./ui/skeleton";
import HistoryDetailsPage from "@/pages/HistoryDetails";
import { twMerge } from "tailwind-merge";
import { StatusBadge } from "./StatusBadge";
import { useContainerRef } from "@/hooks/useContainerRef";

export default function HistorySheet(props: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onUseScribe: (scribe: ScribeModel) => void;
}) {
  const { open, setOpen, onUseScribe } = props;
  const containerRef = useContainerRef();
  const { t } = useTranslation(I18NNAMESPACE);

  // State for the modal
  const [selectedScribe, setSelectedScribe] = useState<ScribeModel | null>(
    null,
  );

  const historyQuery = useInfiniteQuery({
    queryKey: ["scribe-history"],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) =>
      API.scribe.list({
        offset: pageParam,
        benchmark: false,
        limit: 10,
        ordering: "-modified_date",
      }),
    getNextPageParam: (lastPage, _, lastPageParam) => {
      if (lastPage.count > lastPageParam + 10) {
        return lastPageParam + 10;
      } else {
        return undefined;
      }
    },
  });

  const history = historyQuery.data?.pages.flatMap((page) => page.results);
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = historyQuery;

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    // Trigger when 100px from bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      fetchNextPage();
    }
  };

  // Handle card click
  const handleCardClick = (scribe: ScribeModel) => {
    setSelectedScribe(scribe);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          portalProps={{ container: containerRef?.current }}
          className="overflow-y-auto"
          onScroll={handleScroll}
        >
          <SheetTitle className="p-4">{t("history")}</SheetTitle>
          <SheetDescription className="sr-only">
            History of Scribe requests. Click on a request to view details and
            use the transcript.
          </SheetDescription>
          <div className="flex flex-col gap-2 px-4">
            {historyQuery.isLoading && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-[125px] rounded-lg" />
                <Skeleton className="h-[125px] rounded-lg" />
                <Skeleton className="h-[125px] rounded-lg" />
              </div>
            )}
            {historyQuery.isFetched && history?.length === 0 && (
              <div className="flex flex-col items-center justify-center gap-4 rounded-lg opacity-50">
                {t("no_scribe_history")}
              </div>
            )}
            {history?.map((scribe) => (
              <Card
                key={scribe.external_id}
                className={twMerge(
                  "cursor-pointer transition-shadow hover:shadow-md",
                  !["FAILED", "REFUSED", "COMPLETED"].includes(scribe.status) &&
                    "animate-pulse",
                )}
                onClick={() => handleCardClick(scribe)}
              >
                <CardHeader>
                  <CardTitle>
                    {scribe.transcript && scribe.transcript.length > 100
                      ? scribe.transcript.slice(0, 100) + "..."
                      : scribe.transcript}
                    {scribe.transcript === "" && (
                      <span className="text-gray-500">No transcript</span>
                    )}
                    {scribe.status !== "COMPLETED" && (
                      <StatusBadge status={scribe.status} />
                    )}
                  </CardTitle>
                  <CardDescription>
                    {dayjs(scribe.created_date).format("YYYY-MM-DD hh:mm a")}
                  </CardDescription>
                </CardHeader>
              </Card>
            ))}
            {isFetchingNextPage && (
              <div className="">
                <Skeleton className="h-[125px] rounded-lg" />
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={!!selectedScribe}
        onOpenChange={() => setSelectedScribe(null)}
      >
        <SheetContent
          portalProps={{ container: containerRef?.current }}
          className="overflow-y-auto py-8"
          onScroll={handleScroll}
        >
          <SheetTitle className="sr-only">Scribe Details</SheetTitle>
          <SheetDescription className="sr-only">
            Scribe Details
          </SheetDescription>
          {selectedScribe && (
            <HistoryDetailsPage
              scribeId={selectedScribe?.external_id}
              onUseScribe={() => {
                if (!selectedScribe) return;
                setOpen(false);
                setSelectedScribe(null);
                onUseScribe(selectedScribe);
              }}
            />
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
