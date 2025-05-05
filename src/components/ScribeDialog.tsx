import { ScribeFileModel, ScribeModel } from "@/types"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog"
import { useMutation } from "@tanstack/react-query"
import { API } from "@/utils/api"
import { useEffect, useState } from "react"
import dayjs from "dayjs"
import { I18NNAMESPACE } from "@/utils/constants"
import { useTranslation } from "react-i18next"
import { useAtom } from "jotai"
import { containerRefAtom, enableStatisticsAtom } from "@/store"
import { Button } from "./ui/button"

export default function ScribeDialog(props: {
    scribe: ScribeModel | null
    onClose: () => void
    onUse?: () => void
}) {

    const { scribe, onClose, onUse } = props

const { t } = useTranslation(I18NNAMESPACE)
      const [selectedAudios, setSelectedAudios] = useState<ScribeFileModel[] | null>(null);
      const [selectedFiles, setSelectedFiles] = useState<ScribeFileModel[] | null>(null);
      const [containerRef] = useAtom(containerRefAtom)
      const [statsEnabled] = useAtom(enableStatisticsAtom)

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

      useEffect(() => {
          if (!scribe) {
              setSelectedAudios(null)
              setSelectedFiles(null)
              return;
          }
          if (scribe?.audio_file_ids.length) {
              for (const audioId of scribe.audio_file_ids) {
                  filesMutation.mutate({fileId: audioId, fileType: "SCRIBE_AUDIO", associatingId: scribe.external_id})
              }
          }
          if (scribe?.document_file_ids.length) {
              for (const docId of scribe.document_file_ids) {
                  filesMutation.mutate({fileId: docId, fileType: "SCRIBE_DOCUMENT", associatingId: scribe.external_id})
              }
          }
        }, [scribe]);

    return (
        <Dialog open={!!scribe} modal onOpenChange={(open) => {
            if (!open) {
                onClose()
              setSelectedAudios(null)
              setSelectedFiles(null)
            }
          }}>
            <DialogContent portalProps={{ container: containerRef?.current }} className="max-h-[80vh] max-w-screen-md w-full overflow-auto">
              <DialogHeader>
                <DialogTitle>{scribe?.transcript}</DialogTitle>
                <DialogDescription>
                  {scribe && dayjs(scribe.created_date).format("YYYY-MM-DD hh:mm a")}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-4 w-full">
                <h4 className="text-sm font-medium mb-2">{t("status")}:</h4>
                <p className={`text-sm ${scribe?.status === "COMPLETED" ? "text-green-500" : "text-red-500"}`}>
                    {scribe?.status}
                </p>
                {!!scribe?.audio_file_ids.length && (
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
                {!!scribe?.document_file_ids.length && (
                    <div>
                        <h4 className="text-sm font-medium mt-4 mb-2">{t("documents")}:</h4>
                        {selectedFiles?.map((file) => (
                            <a key={file.id} href={file.read_signed_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 underline">
                                Document {file.id}
                            </a>
                        ))}
                    </div>
                )}
                {statsEnabled && scribe?.meta && (
                    <div>
                        <h4 className="text-sm font-medium mt-4 mb-2">{t("statistics")}:</h4>
                        <div className="text-xs">
                        {Object.entries(scribe.meta).map(([key, value]) => (
                          <div key={key}>
                      {key} : {(key === "completion_time" || key === "transcription_time") && typeof value === "number" ? ((value * 1000).toFixed(2) + " ms") : value}
                    </div>
                  ))}
                  </div>
                    </div>
                )}
              </div>
              <div className="flex justify-end mt-4 gap-2">
                {onUse && (
                    <Button
                    onClick={() => {
                        if (!scribe) return
                        onClose()
                        onUse()
                    }}
                    disabled={scribe?.status !== "COMPLETED"}
                    >
                    {t("use_this_autofill")}
                </Button>
                )}
                <Button variant={"secondary"} onClick={onClose}>{t("close")}</Button>
              </div>
            </DialogContent>
          </Dialog>
    )
}