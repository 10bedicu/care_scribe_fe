import { ImageIcon, ReloadIcon } from "@radix-ui/react-icons";
import { ScribeStatus } from "../types";
import { useTranslation } from "react-i18next";
import useKeyboardShortcut from "use-keyboard-shortcut";
import { MicrophoneIcon, MicrophoneSlashIcon } from "@/utils/icons";
import {
  ScribeControllerPosition,
  useScribePosition,
} from "@/utils/controller-position";
import { useRef, useState } from "react";

import { I18NNAMESPACE } from "@/utils/constants";

export default function ScribeButton(props: {
  files: File[];
  status: ScribeStatus;
  onClick: () => void;
  disabled?: boolean;
}) {
  const { status, onClick, disabled, files } = props;
  const { t } = useTranslation(I18NNAMESPACE);
  const [, setControllerPosition] = useScribePosition();
  const [initMousePosition, setInitMousePosition] = useState<{
    x: number;
    y: number;
  }>();
  const [mousePosition, setMousePosition] = useState<{
    x: number;
    y: number;
  }>();
  const [estimatedMovingPosition, setEstimatedMovingPosition] =
    useState<ScribeControllerPosition>();

  const buttonRef = useRef<HTMLButtonElement>(null);

  useKeyboardShortcut(["X"], onClick);

  const handleDragStart = (xy: typeof initMousePosition) => {
    setInitMousePosition(xy);
  };

  const handleDragMove = (newMousePosition: { x: number; y: number }) => {
    if (!buttonRef.current || !initMousePosition) return;
    const xOffset = (initMousePosition.x - newMousePosition.x) * -1;
    const yOffset = (initMousePosition.y - newMousePosition.y) * -1;
    buttonRef.current.style.transform = `translateX(${xOffset}px) translateY(${yOffset}px)`;
    if (Math.abs(xOffset) > 30 || Math.abs(yOffset) > 30) {
      const isLeft = newMousePosition.x < window.innerWidth / 2;
      const isTop = newMousePosition.y < window.innerHeight / 2;
      const estimatedPosition =
        `${isTop ? "top" : "bottom"}-${isLeft ? "left" : "right"}` as ScribeControllerPosition;
      setEstimatedMovingPosition(estimatedPosition);
    } else {
      setEstimatedMovingPosition(undefined);
    }
    setMousePosition(newMousePosition);
  };

  const handleDragEnd = () => {
    if (!buttonRef.current || !mousePosition) return;
    buttonRef.current.style.transform = ``;
    const isLeft = mousePosition.x < window.innerWidth / 2;
    const isTop = mousePosition.y < window.innerHeight / 2;
    const finalPosition =
      `${isTop ? "top" : "bottom"}-${isLeft ? "left" : "right"}` as ScribeControllerPosition;
    setControllerPosition(finalPosition);
    setInitMousePosition(undefined);
    //timeout so that ending the drag does not trigger a click
    setTimeout(() => setEstimatedMovingPosition(undefined), 200);
  };

  const touchCords = (e: React.TouchEvent<HTMLButtonElement>) => ({
    x: e.touches[0].clientX,
    y: e.touches[0].clientY,
  });
  const mouseCords = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => ({
    x: e.clientX,
    y: e.clientY,
  });

  const placeholderCommonClasses =
    "fixed h-20 w-20 rounded-full bg-green-700 blur-xl transition-all";
  const visibleClasses = (isVisible?: boolean) =>
    isVisible ? "visible opacity-100" : "invisible opacity-0";

  return (
    <>
      <div
        className={`-right-10 -top-10 ${placeholderCommonClasses} ${visibleClasses(estimatedMovingPosition === "top-right")}`}
      />
      <div
        className={`-left-10 -top-10 ${placeholderCommonClasses} ${visibleClasses(estimatedMovingPosition === "top-left")}`}
      />
      <div
        className={`-bottom-10 -right-10 ${placeholderCommonClasses} ${visibleClasses(estimatedMovingPosition === "bottom-right")}`}
      />
      <div
        className={`-bottom-10 -left-10 ${placeholderCommonClasses} ${visibleClasses(estimatedMovingPosition === "bottom-left")}`}
      />
      <button
        ref={buttonRef}
        onTouchStart={(e) => handleDragStart(touchCords(e))}
        onTouchEnd={handleDragEnd}
        onTouchMove={(e) => handleDragMove(touchCords(e))}
        onTouchCancel={handleDragEnd}
        onMouseDown={(e) => handleDragStart(mouseCords(e))}
        onMouseMove={(e) => handleDragMove(mouseCords(e))}
        onMouseUp={handleDragEnd}
        onMouseLeave={handleDragEnd}
        onClick={() => (!estimatedMovingPosition ? onClick() : undefined)}
        className={`group z-10 flex items-center rounded-full ${status === "IDLE" ? "bg-primary-500 hover:bg-primary-600 text-white" : "border-neutral-300 bg-neutral-100 hover:bg-neutral-200 border"} ${!!estimatedMovingPosition ? "opacity-50" : ""} disabled:bg-neutral-200 transition-[background,top,right,left,bottom,opacity] cursor-pointer`}
        disabled={["TRANSCRIBING", "THINKING"].includes(status) || disabled}
        style={{ touchAction: "none" }}
      >
        <div
          className={`flex aspect-square h-full items-center justify-center rounded-full ${status === "IDLE" ? "bg-primary-600 group-hover:bg-primary-700" : "bg-neutral-200 group-hover:bg-neutral-300"} p-4 text-xl`}
        >
          {status === "IDLE" ? (
            <MicrophoneIcon className="w-4 invert" />
          ) : status === "RECORDING" ? (
            <MicrophoneSlashIcon className="w-5" />
          ) : status === "ATTACHING" ? (
            <ImageIcon />
          ) : (
            <ReloadIcon />
          )}
        </div>
        <div className="pl-2 pr-6 font-semibold">
          {status === "IDLE"
            ? t("voice_autofill")
            : status === "ATTACHING"
              ? t("process_images")
              : status === "RECORDING"
                ? t("stop_recording")
                : files.length > 0
                  ? t("reupload_files")
                  : t("retake_recording")}
        </div>
      </button>
    </>
  );
}
