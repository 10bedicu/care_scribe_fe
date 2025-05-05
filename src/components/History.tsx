import { useEffect, useState } from "react"
import { useAtom } from "jotai"
import { Button } from "./ui/button"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./ui/sheet"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"
import { containerRefAtom } from "@/store"
import { useInfiniteQuery, useMutation } from "@tanstack/react-query"
import { API } from "@/utils/api"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "./ui/card"
import dayjs from "dayjs"
import { FileUploadModel, ScribeFileModel, ScribeModel } from "@/types"
import { useTranslation } from "react-i18next"
import { I18NNAMESPACE } from "@/utils/constants"
import { Skeleton } from "./ui/skeleton"

export default function HistorySheet(props: { open: boolean; setOpen: (open: boolean) => void, onUseScribe: (scribe: ScribeModel) => void }) {
  const { open, setOpen, onUseScribe } = props
  const [containerRef] = useAtom(containerRefAtom)
  const { t } = useTranslation(I18NNAMESPACE)

  // State for the modal
  const [selectedScribe, setSelectedScribe] = useState<ScribeModel | null>(null)
  const [selectedAudios, setSelectedAudios] = useState<ScribeFileModel[] | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<ScribeFileModel[] | null>(null);
  const [modalOpen, setModalOpen] = useState(false)

  const filesMutation = useMutation<ScribeFileModel, Error, {fileId: string, fileType: string, associatingId: string}>({
    mutationFn: ({fileId, fileType, associatingId}) => API.files.get(fileId, fileType, associatingId),
    onSuccess: (data, params) => {
      if (params.fileType === "SCRIBE_AUDIO") {
        setSelectedAudios((prev) => [...(prev || []), data])
      }else{
        setSelectedFiles((prev) => [...(prev || []), data])
      }
    },
  })

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
  

  useEffect(() => {
    if (!selectedScribe) {
        setSelectedAudios(null)
        setSelectedFiles(null)
        return;
    }
    if (selectedScribe?.audio_file_ids.length) {
        for (const audioId of selectedScribe.audio_file_ids) {
            filesMutation.mutate({fileId: audioId, fileType: "SCRIBE_AUDIO", associatingId: selectedScribe.external_id})
        }
    }
    if (selectedScribe?.document_file_ids.length) {
        for (const docId of selectedScribe.document_file_ids) {
            filesMutation.mutate({fileId: docId, fileType: "SCRIBE_DOCUMENT", associatingId: selectedScribe.external_id})
        }
    }
  }, [selectedScribe]);

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

      <Dialog open={modalOpen} onOpenChange={(open) => {
        setModalOpen(open)
        if (!open) {
          setSelectedScribe(null)
          setSelectedAudios(null)
          setSelectedFiles(null)
        }
      }}>
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
                    <div className="flex flex-col gap-2">
                    {selectedAudios?.map((audio) => (
                        <audio key={audio.id} controls className="w-full">
                            <source src={audio.read_signed_url} type="audio/mpeg" />
                            Your browser does not support the audio element.
                        </audio>
                    ))}
                    </div>
                </div>
            )}
            {!!selectedScribe?.document_file_ids.length && (
                <div>
                    <h4 className="text-sm font-medium mt-4 mb-2">{t("documents")}:</h4>
                    {selectedFiles?.map((file) => (
                        <a key={file.id} href={file.read_signed_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                            Document {file.id}
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
