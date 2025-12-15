import { DotsVerticalIcon } from "@radix-ui/react-icons";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { I18NNAMESPACE } from "@/utils/constants";
import { useTranslation } from "react-i18next";
import { useMicrophones } from "@/hooks/useMicrophone";
import { useState } from "react";
import useAuthUser from "@/hooks/useAuthUser";
import { ScribeModel } from "@/types";
import HistorySheet from "./History";
import { useContainerRef } from "@/hooks/useContainerRef";
import { useStorage } from "@/hooks/useStorage";

export default function ControllerDropDownMenu(props: {
  onUseScribe: (scribe: ScribeModel) => void;
}) {
  const { t } = useTranslation(I18NNAMESPACE);
  const containerRef = useContainerRef();
  const [devMode, setDevMode] = useStorage("scribe-enable-dev-mode");
  const [fetchMicrophones, setFetchMicrophones] = useState(false);
  const [currentMic, setCurrentMic] = useStorage("scribe-microphone");
  const user = useAuthUser();
  const [historySheetOpen, setHistorySheetOpen] = useState(false);

  const { microphones, error: micError } = useMicrophones(!fetchMicrophones);

  return (
    <>
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button className="flex aspect-square w-6 items-center justify-center rounded-lg text-sm transition-all hover:bg-black/10">
            {/* Ellipsis Icon*/}
            <DotsVerticalIcon className="text-xl" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-48"
          portalProps={{ container: containerRef?.current }}
        >
          <DropdownMenuGroup>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger
                onMouseOver={() => setFetchMicrophones(true)}
              >
                {t("microphone")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                {micError ? (
                  <p className="px-4 py-2 text-sm text-red-500">
                    {t("audio__permission_message")}
                  </p>
                ) : (
                  <DropdownMenuRadioGroup
                    value={currentMic || undefined}
                    onValueChange={(v) => {
                      setCurrentMic(v);
                    }}
                  >
                    {microphones.map((mic) => (
                      <DropdownMenuRadioItem
                        key={mic.deviceId}
                        value={mic.deviceId}
                      >
                        {mic.label}
                      </DropdownMenuRadioItem>
                    ))}
                  </DropdownMenuRadioGroup>
                )}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={() => setHistorySheetOpen(true)}>
              {t("history")}
            </DropdownMenuItem>
            {user?.is_superuser && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={devMode}
                  onCheckedChange={(checked) => {
                    setDevMode(checked);
                  }}
                >
                  {t("developer_mode")}
                </DropdownMenuCheckboxItem>
              </>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <HistorySheet
        open={historySheetOpen}
        setOpen={setHistorySheetOpen}
        onUseScribe={props.onUseScribe}
      />
    </>
  );
}
