import { useTranslation } from "react-i18next";
import { I18NNAMESPACE } from "@/utils/constants";
import { Button } from "./ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
import { useContainerRef } from "@/hooks/useContainerRef";

interface TncDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  content?: string;
  onAccept: () => void;
}

export default function TncDialog({
  open,
  onOpenChange,
  content,
  onAccept,
}: TncDialogProps) {
  const { t } = useTranslation(I18NNAMESPACE);
  const containerRef = useContainerRef();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        portalProps={{ container: containerRef?.current }}
        className="break-normal"
      >
        <DialogHeader>
          <DialogTitle>{t("terms_and_conditions")}</DialogTitle>
          <DialogDescription>
            {t("terms_and_conditions_description")}
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-auto rounded-md bg-neutral-50 p-2 text-sm">
          <div
            className="reset-tw"
            dangerouslySetInnerHTML={{
              __html: content || "LOADING...",
            }}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              onAccept();
              onOpenChange(false);
            }}
          >
            {t("accept")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
