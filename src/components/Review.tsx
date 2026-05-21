import {
  ScribeFieldReviewedSuggestion,
  ScribeFieldSuggestion,
  ScribeModel,
} from "../types";
import { renderFieldValue, sleep } from "../utils/utils";
import { useEffect, useState } from "react";

import { ChevronLeftIcon } from "@radix-ui/react-icons";
import { I18NNAMESPACE } from "@/utils/constants";
import { KeyboardShortcutKey } from "./ui/keyboard-shortcut";
import useKeyboardShortcut from "use-keyboard-shortcut";
import { useTranslation } from "react-i18next";
import STRUCTURES from "@/utils/structures";
import Feedback from "./Feedback";
import { useStorage } from "@/hooks/useStorage";
import { StackedGrid } from "./StackedGrid";
import { updateFieldValue } from "@/utils/field-utils";

export default function ScribeReview(props: {
  setFormState: unknown;
  scribe?: ScribeModel;
  toReview: ScribeFieldSuggestion[];
  onReviewComplete: (accepted: ScribeFieldReviewedSuggestion[]) => void;
  onProcessAgain: () => void;
}) {
  const { toReview, onReviewComplete, setFormState, onProcessAgain, scribe } =
    props;
  const initialReviewIndex = toReview.length > 1 ? -1 : 0;
  const [reviewIndex, setReviewIndex] = useState(initialReviewIndex);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<
    ScribeFieldReviewedSuggestion[]
  >([]);
  const [controllerPosition] = useStorage("scribe-controller-position");
  const [accepting, setAccepting] = useState(false);
  const [reviewingFieldRect, setReviewingFieldRect] = useState<
    DOMRect | undefined
  >();

  const { t } = useTranslation(I18NNAMESPACE);

  const reviewingField =
    reviewIndex !== -1 ? toReview?.[reviewIndex] : undefined;

  useEffect(() => {
    if (!reviewingField) {
      setReviewingFieldRect(undefined);
      return;
    }

    const fieldElement = document.getElementById(
      "question-" + reviewingField.question.id,
    );

    if (!fieldElement) {
      console.warn("Field element not found for:", reviewingField.question.id);
      // jump to the next field, or end the review
      if (reviewIndex < toReview.length - 1) {
        setReviewIndex((i) => i + 1);
      } else {
        onReviewComplete(acceptedSuggestions);
        return;
      }
    }

    fieldElement?.scrollIntoView({
      behavior: "instant",
      block: "center",
      inline: "center",
    });

    let resizeObserver: ResizeObserver | undefined;
    let settleTimeout: ReturnType<typeof setTimeout> | undefined;

    const initialTimeout = setTimeout(() => {
      // Expand any Radix Collapsible triggers inside the field so that all inferred data is visible to thwe reviewer.
      fieldElement
        ?.querySelectorAll<HTMLElement>(
          'button[data-state="closed"][aria-expanded="false"]:not([aria-haspopup])',
        )
        .forEach((el) => el.click());

      const updateRect = () => {
        setReviewingFieldRect(fieldElement?.getBoundingClientRect());
      };
      updateRect();

      if (fieldElement && typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          updateRect();
          if (settleTimeout) clearTimeout(settleTimeout);
          settleTimeout = setTimeout(() => {
            resizeObserver?.disconnect();
          }, 200);
        });
        resizeObserver.observe(fieldElement);
        // Safety net: disconnect after 2s regardless.
        settleTimeout = setTimeout(() => {
          resizeObserver?.disconnect();
        }, 2000);
      }
      // Add delay so DOM settles
    }, 100);

    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
      clearTimeout(initialTimeout);
      if (settleTimeout) clearTimeout(settleTimeout);
      resizeObserver?.disconnect();
    };
  }, [reviewingField]);

  useEffect(() => {
    setReviewIndex(initialReviewIndex);
    setAcceptedSuggestions([]);
  }, [toReview]);

  const handleBack = () => {
    if (reviewIndex > 0) setReviewIndex((i) => i - 1);
  };

  const handleReviewComplete = async (
    accepted?: typeof acceptedSuggestions,
  ) => {
    onReviewComplete(accepted || acceptedSuggestions);
  };

  const handleForward = (accepted?: typeof acceptedSuggestions) => {
    if (reviewIndex < toReview.length - 1) {
      setReviewIndex((i) => i + 1);
    } else {
      handleReviewComplete(accepted || acceptedSuggestions);
    }
  };

  const handleVerdict = async (approved: boolean) => {
    const accepted = [
      ...acceptedSuggestions.filter((s) => s.suggestionIndex !== reviewIndex),
      {
        ...toReview[reviewIndex],
        approved,
        suggestionIndex: reviewIndex,
      },
    ];
    if (!approved && reviewingField)
      updateFieldValue(reviewingField, false, setFormState);
    await sleep(150);
    setAcceptedSuggestions(accepted);
    handleForward(accepted);
  };

  const handleAcceptAll = async () => {
    setAccepting(true);
    const accepted = toReview.map((field, idx) => ({
      ...field,
      approved: true,
      suggestionIndex: idx,
    }));
    for (const f of toReview) {
      await sleep(100);
      updateFieldValue(f, true, setFormState);
    }
    setAcceptedSuggestions(accepted);
    handleReviewComplete(accepted);
    setAccepting(false);
  };

  useEffect(() => {
    if (reviewingField) {
      updateFieldValue(reviewingField, true, setFormState);
    }
  }, [reviewingField]);

  useKeyboardShortcut(["A"], () =>
    reviewIndex !== -1 ? handleVerdict(true) : handleForward(),
  );
  useKeyboardShortcut(["E"], () =>
    reviewIndex === -1 ? handleAcceptAll() : undefined,
  );
  useKeyboardShortcut(["R"], () => handleVerdict(false));
  useKeyboardShortcut(["B"], handleBack);
  useKeyboardShortcut(["P"], onProcessAgain);

  if (reviewIndex === -1) {
    return (
      <div className="fixed inset-0 z-20 flex flex-col items-center justify-end bg-black/50 p-6 text-white backdrop-blur-sm md:justify-center md:p-20">
        <h2 className="text-center text-xl font-black md:text-3xl">
          {toReview.length} fields inferred
        </h2>
        <StackedGrid
          items={toReview.map((field, index) => (
            <div
              key={index}
              className="flex flex-col items-start overflow-hidden rounded-lg bg-black/20"
            >
              <div className="w-full p-2">
                <div className="text-xs text-neutral-400">
                  {field.question.text}
                </div>
                <div className="font-bold whitespace-pre-wrap">
                  {renderFieldValue(
                    {
                      ...field,
                      structure: field.question.structured_type
                        ? STRUCTURES[field.question.structured_type]
                        : undefined,
                    },
                    true,
                  )}
                </div>
              </div>
              {field.newNote && (
                <div className="w-full bg-yellow-300/10 p-2 text-xs text-yellow-400">
                  {field.newNote}
                </div>
              )}
            </div>
          ))}
          className="my-4 max-h-[calc(100vh-400px)] overflow-auto md:max-h-[50vh]"
        />
        <div className="flex flex-col items-center gap-4">
          <div className="flex flex-row flex-wrap items-center justify-center gap-2">
            {!accepting ? (
              <>
                <button
                  onClick={handleAcceptAll}
                  className="bg-primary-500 hover:bg-primary-600 flex cursor-pointer items-center gap-2 rounded-full px-2 py-2 font-semibold transition-all md:w-auto md:px-4 md:text-lg"
                >
                  <KeyboardShortcutKey shortcut={["E"]} />
                  {t("accept_all")}
                </button>
                <button
                  onClick={() => handleForward()}
                  className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-2 py-2 font-semibold text-black transition-all hover:bg-neutral-100 md:w-auto md:px-4 md:text-lg"
                >
                  <KeyboardShortcutKey shortcut={["A"]} />
                  {t("start_review")}
                </button>
                <button
                  onClick={onProcessAgain}
                  className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-2 py-2 font-semibold text-black transition-all hover:bg-neutral-100 md:w-auto md:px-4 md:text-lg"
                >
                  <KeyboardShortcutKey shortcut={["P"]} />
                  {t("process_transcript")}
                </button>
              </>
            ) : (
              <div>{t("making_changes")}...</div>
            )}
          </div>
          {scribe && <Feedback scribe={scribe} />}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-20">
      <div className="absolute inset-0 flex flex-col">
        <div
          className="bg-black/50 transition-all"
          style={{ height: (reviewingFieldRect?.top || 0) - 10 + "px" }}
        />
        <div className="flex items-stretch">
          <div
            style={{ width: (reviewingFieldRect?.left || 0) - 10 + "px" }}
            className="bg-black/50 transition-all"
          />
          <div
            style={{
              height: (reviewingFieldRect?.height || 0) + 20 + "px",
              width: (reviewingFieldRect?.width || 0) + 20 + "px",
            }}
            className="transition-all"
          />
          <div className="flex-1 bg-black/50 transition-all" />
        </div>
        <div className="flex-1 bg-black/50 transition-all" />
      </div>
      <div
        className={`absolute inset-x-0 ${controllerPosition.includes("bottom") ? "bottom-32" : "bottom-0"} flex flex-col items-center justify-center gap-4 p-4 text-white md:bottom-0`}
      >
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="flex aspect-square cursor-pointer items-center justify-center rounded-full border border-white p-2 text-2xl font-semibold text-white"
          >
            <ChevronLeftIcon />
          </button>
          <button
            onClick={() => handleVerdict(false)}
            className="flex cursor-pointer items-center gap-2 rounded-full bg-white px-4 py-2 text-lg font-semibold text-black transition-all hover:bg-neutral-100"
          >
            <KeyboardShortcutKey shortcut={["R"]} />
            {t("reject")}
          </button>
          <button
            onClick={() => handleVerdict(true)}
            className="bg-primary-500 hover:bg-primary-600 flex cursor-pointer items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold transition-all"
          >
            <KeyboardShortcutKey shortcut={["A"]} />
            {t("accept")}
          </button>
          <div className="text-xs opacity-80">
            {reviewIndex + 1} / {toReview.length}
          </div>
        </div>
        {scribe && toReview.length === 1 && <Feedback scribe={scribe} />}
        <div className="flex items-center gap-2">
          {toReview.map((_, i) => (
            <button
              key={i}
              className={`aspect-square w-2 cursor-pointer rounded-full ${acceptedSuggestions.find((s) => s.suggestionIndex === i)?.approved === true ? "bg-green-400" : acceptedSuggestions.find((s) => s.suggestionIndex === i)?.approved === false ? "bg-red-500" : "bg-white"} ${reviewIndex === i ? "opacity-100" : "opacity-50"} transition-all`}
              onClick={() => setReviewIndex(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
