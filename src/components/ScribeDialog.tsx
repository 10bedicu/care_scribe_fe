import { ScribeModel } from "@/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import dayjs from "dayjs";
import { I18NNAMESPACE } from "@/utils/constants";
import { useTranslation } from "react-i18next";
import { useAtom } from "jotai";
import { containerRefAtom, enableStatisticsAtom } from "@/store";
import { Button } from "./ui/button";
import { useScribeFiles } from "@/hooks/useScribeFiles";

export default function ScribeDialog(props: {
  scribe: ScribeModel | null;
  onClose: () => void;
  onUse?: () => void;
}) {
  const { scribe, onClose, onUse } = props;

  const { t } = useTranslation(I18NNAMESPACE);

  const [containerRef] = useAtom(containerRefAtom);
  const [statsEnabled] = useAtom(enableStatisticsAtom);

  const { audioFiles } = useScribeFiles(scribe);

  return (
    <Dialog
      open={!!scribe}
      modal
      onOpenChange={(open) => {
        if (!open) {
          onClose();
        }
      }}
    >
      <DialogContent
        portalProps={{ container: containerRef?.current }}
        className="max-h-[80vh] w-full max-w-screen-md overflow-auto"
      >
        <DialogHeader>
          <DialogTitle>{scribe?.transcript}</DialogTitle>
          <DialogDescription>
            {scribe && dayjs(scribe.created_date).format("YYYY-MM-DD hh:mm a")}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4 w-full">
          <h4 className="mb-2 text-sm font-medium">{t("status")}:</h4>
          <p
            className={`text-sm ${scribe?.status === "COMPLETED" ? "text-green-500" : "text-red-500"}`}
          >
            {scribe?.status}
          </p>
          {!!scribe?.audio_file_ids.length && (
            <div>
              <h4 className="mt-4 mb-2 text-sm font-medium">{t("audio")}:</h4>
              <div className="flex flex-col gap-2">
                {audioFiles?.map((audio) => (
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
              <h4 className="mt-4 mb-2 text-sm font-medium">
                {t("documents")}:
              </h4>
              {audioFiles?.map((file) => (
                <a
                  key={file.id}
                  href={file.read_signed_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-500 underline"
                >
                  Document {file.id}
                </a>
              ))}
            </div>
          )}
          {statsEnabled && scribe?.meta && (
            <div>
              <h4 className="mt-4 mb-2 text-sm font-medium">
                {t("statistics")}:
              </h4>
              <div className="text-xs">
                {Object.entries(scribe.meta).map(([key, value]) => (
                  <div key={key}>
                    {key.replace(/_/g, " ")} :{" "}
                    {(key === "completion_time" ||
                      key === "transcription_time") &&
                    typeof value === "number"
                      ? (value * 1000).toFixed(2) + " ms"
                      : value}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex justify-end gap-2">
          {onUse && (
            <Button
              onClick={() => {
                if (!scribe) return;
                onClose();
                onUse();
              }}
              disabled={scribe?.status !== "COMPLETED"}
            >
              {t("use_this_scribe")}
            </Button>
          )}
          <Button variant={"secondary"} onClick={onClose}>
            {t("close")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
