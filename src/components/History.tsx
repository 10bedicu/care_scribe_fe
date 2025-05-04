import { useEffect, useRef, useState } from "react"
import { useAtom } from "jotai"
import { Button } from "./ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "./ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"
import { containerRefAtom } from "@/store"
import { useInfiniteQuery } from "@tanstack/react-query"
import { API } from "@/utils/api"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card"
import dayjs from "dayjs"
import { ScribeModel } from "@/types"
import { useTranslation } from "react-i18next"
import { I18NNAMESPACE } from "@/utils/constants"
import { Skeleton } from "./ui/skeleton"

export default function HistorySheet(props: { open: boolean; setOpen: (open: boolean) => void, onUseScribe: (scribe: ScribeModel) => void }) {
  const { open, setOpen, onUseScribe } = props
  const [containerRef] = useAtom(containerRefAtom)
  const { t } = useTranslation(I18NNAMESPACE)

  // State for the modal
  const [selectedScribe, setSelectedScribe] = useState<ScribeModel | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const historyQuery = useInfiniteQuery({
    queryKey: ["scribe-history"],
    initialPageParam: 0,
    queryFn: async ({ pageParam = 0 }) =>
      API.scribe.list({
        offset: pageParam,
        limit: 10,
      }),
    getNextPageParam: (lastPage, allPages, lastPageParam) => {
      if (lastPage.count > lastPageParam + 10) {
        return lastPageParam + 10
      } else {
        return undefined
      }
    },
  })

  const history = historyQuery.data?.pages.flatMap((page) => page.results)
  const { fetchNextPage, hasNextPage, isFetchingNextPage } = historyQuery

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    console.log("scrolling", el?.scrollTop, el?.scrollHeight, el?.clientHeight)
    if (!el || !hasNextPage || isFetchingNextPage) return
    // Trigger when 100px from bottom
    if (el.scrollHeight - el.scrollTop - el.clientHeight < 100) {
      fetchNextPage()
    }
  }

  // Handle card click
  const handleCardClick = (scribe: any) => {
    setSelectedScribe(scribe)
    setModalOpen(true)
  }

  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent portalProps={{ container: containerRef?.current }} className="overflow-y-auto" onScroll={handleScroll}>
          <SheetHeader>
            <SheetTitle>{t("history")}</SheetTitle>
          </SheetHeader>
          <div className="px-4 flex flex-col gap-2">
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
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => handleCardClick(scribe)}
              >
                <CardHeader>
                  <CardTitle>{scribe.transcript && scribe.transcript.length > 100 ? (scribe.transcript.slice(0, 100) + "..."): scribe.transcript}</CardTitle>
                  <CardDescription>{dayjs(scribe.created_date).format("YYYY-MM-DD hh:mm a")}</CardDescription>
                </CardHeader>
                <CardFooter>
                  <p className="text-sm text-muted-foreground">{t("click_to_view_details")}</p>
                </CardFooter>
              </Card>
            ))}
            {isFetchingNextPage && 
            <div className="">
                <Skeleton className="h-[125px] rounded-lg" />
            </div>}
          </div>
        </SheetContent>
      </Sheet>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent portalProps={{ container: containerRef?.current }} className="max-h-[80vh] max-w-screen-md w-full overflow-auto">
          <DialogHeader>
            <DialogTitle>{selectedScribe?.transcript}</DialogTitle>
            <DialogDescription>
              {selectedScribe && dayjs(selectedScribe.created_date).format("YYYY-MM-DD hh:mm a")}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 w-full">
            <h4 className="text-sm font-medium mb-2">{t("status")}:</h4>
            <p className={`text-sm ${selectedScribe?.status === "COMPLETED" ? "text-green-500" : "text-red-500"}`}>
                {selectedScribe?.status}
            </p>
            {!!selectedScribe?.audio_file_ids.length && (
                <div>
                    <h4 className="text-sm font-medium mt-4 mb-2">{t("audio")}:</h4>
                    {selectedScribe.audio_file_ids.map((audioId) => (
                        <audio key={audioId} controls className="w-full">
                            <source src={`${import.meta.env.VITE_API_URL}/api/v1/audio/${audioId}`} type="audio/mpeg" />
                            Your browser does not support the audio element.
                        </audio>
                    ))}
                </div>
            )}
            {!!selectedScribe?.document_file_ids.length && (
                <div>
                    <h4 className="text-sm font-medium mt-4 mb-2">{t("documents")}:</h4>
                    {selectedScribe.document_file_ids.map((docId) => (
                        <a key={docId} href={`${import.meta.env.VITE_API_URL}/api/v1/document/${docId}`} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                            Document {docId}
                        </a>
                    ))}
                </div>
            )}
          </div>
          <div className="flex justify-end mt-4 gap-2">
            <Button
                onClick={() => {
                    if (!selectedScribe) return
                    setModalOpen(false)
                    setOpen(false)
                    onUseScribe(selectedScribe)
                }}
                disabled={selectedScribe?.status !== "COMPLETED"}
            >
                {t("use_this_autofill")}
            </Button>
            <Button variant={"secondary"} onClick={() => setModalOpen(false)}>{t("close")}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
