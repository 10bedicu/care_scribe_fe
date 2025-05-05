import ScribeDialog from "@/components/ScribeDialog";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { ScribeModel } from "@/types";
import { API } from "@/utils/api";
import { I18NNAMESPACE } from "@/utils/constants";
import { useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { useQueryParams } from "raviger";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function AutofillHistory() {
  const { t } = useTranslation(I18NNAMESPACE);
  const [scribe, setScribe] = useState<ScribeModel | null>(null);
  const [{ page: initPage }] = useQueryParams();
  const page = initPage || 1;

  const historyQuery = useQuery({
    queryKey: ["scribe-history", page],
    queryFn: async () =>
      API.scribe.list({
        offset: (Number(page) - 1) * 10,
        limit: 10,
      }),
  });

  const history = historyQuery.data?.results;

  const totalHistory = historyQuery.data?.count || 0;
  const totalPages = Math.ceil(totalHistory / 10);

  return (
    <div className="px-6 md:px-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
        {t("autofill_history")}
      </h1>
      <div className="mt-4 flex flex-col gap-2">
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
            onClick={() => setScribe(scribe)}
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
          </Card>
        ))}
        <Pagination>
          <PaginationContent>
            {page > 1 && (
              <PaginationItem>
                <PaginationPrevious href={`?page=${Number(page) - 1}`} />
              </PaginationItem>
            )}
            {page < totalPages && (
              <PaginationItem>
                <PaginationNext href={`?page=${Number(page) + 1}`} />
              </PaginationItem>
            )}
          </PaginationContent>
        </Pagination>
      </div>
      <ScribeDialog
        scribe={scribe}
        onClose={() => {
          setScribe(null);
        }}
      />
    </div>
  );
}
