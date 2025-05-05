import { useState } from "react";
import { useAtom } from "jotai";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet";
import { containerRefAtom } from "@/store";
import { useInfiniteQuery } from "@tanstack/react-query";
import { API } from "@/utils/api";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./ui/card";
import dayjs from "dayjs";
import { ScribeModel } from "@/types";
import { useTranslation } from "react-i18next";
import { I18NNAMESPACE } from "@/utils/constants";
import { Skeleton } from "./ui/skeleton";
import ScribeDialog from "./ScribeDialog";

export default function HistorySheet(props: {
  open: boolean;
  setOpen: (open: boolean) => void;
  onUseScribe: (scribe: ScribeModel) => void;
}) {
  const { open, setOpen, onUseScribe } = props;
  const [containerRef] = useAtom(containerRefAtom);
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
        limit: 10,
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
    console.log("scrolling", el?.scrollTop, el?.scrollHeight, el?.clientHeight);
    if (!el || !hasNextPage || isFetchingNextPage) return;
    // Trigger when 100px from bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      fetchNextPage();
    }
  };

  // Handle card click
  const handleCardClick = (scribe: any) => {
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
          <SheetHeader>
            <SheetTitle>{t("history")}</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4">
            {historyQuery.isLoading && (
              <div className="flex flex-col gap-2">
                <Skeleton className="h-[125px] rounded-lg" />
                <Skeleton className="h-[125px] rounded-lg" />
                <Skeleton className="h-[125px] rounded-lg" />
              </div>
            )}
            {history?.map((scribe) => (
              <Card
                key={scribe.external_id}
                className="cursor-pointer transition-shadow hover:shadow-md"
                onClick={() => handleCardClick(scribe)}
              >
                <CardHeader>
                  <CardTitle>
                    {scribe.transcript && scribe.transcript.length > 100
                      ? scribe.transcript.slice(0, 100) + "..."
                      : scribe.transcript}
                  </CardTitle>
                  <CardDescription>
                    {dayjs(scribe.created_date).format("YYYY-MM-DD hh:mm a")}
                  </CardDescription>
                </CardHeader>
                <CardFooter>
                  <p className="text-muted-foreground text-sm">
                    {t("click_to_view_details")}
                  </p>
                </CardFooter>
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

      <ScribeDialog
        scribe={selectedScribe}
        onClose={() => {
          setSelectedScribe(null);
        }}
        onUse={() => {
          if (!selectedScribe) return;
          onUseScribe(selectedScribe);
        }}
      />
    </>
  );
}
