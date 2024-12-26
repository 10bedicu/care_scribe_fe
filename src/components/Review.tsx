import { useEffect, useState } from "react";
import { ScribeFieldReviewedSuggestion, ScribeFieldSuggestion } from "../types";
import {
  previewFieldUpdate,
  renderFieldValue,
  sleep,
  updateFieldValue,
} from "../utils/utils";
import useKeyboardShortcut from "use-keyboard-shortcut";
import { useTranslation } from "react-i18next";

export default function ScribeReview(props: {
  toReview: ScribeFieldSuggestion[];
  onReviewComplete: (accepted: ScribeFieldReviewedSuggestion[]) => void;
}) {
  const { toReview, onReviewComplete } = props;
  const initialReviewIndex = toReview.length > 1 ? -1 : 0;
  const [reviewIndex, setReviewIndex] = useState(initialReviewIndex);
  const [acceptedSuggestions, setAcceptedSuggestions] = useState<
    ScribeFieldReviewedSuggestion[]
  >([]);

  const { t } = useTranslation();

  const reviewingField =
    reviewIndex !== -1 ? toReview?.[reviewIndex] : undefined;

  const reviewingFieldRect =
    reviewingField?.fieldElement.getBoundingClientRect();

  useEffect(() => {
    if (!reviewingField) return;

    const fieldRect = reviewingField.fieldElement.getBoundingClientRect();
    const windowCenter = window.innerHeight / 2;
    const fieldCenter = fieldRect.top + fieldRect.height / 2;
    const distanceFromCenter = Math.abs(windowCenter - fieldCenter);

    if (distanceFromCenter > 300) {
      reviewingField.fieldElement.scrollIntoView({
        behavior: "instant",
        block: "center",
        inline: "center",
      });
    }
  }, [reviewingField]);

  useEffect(() => {
    setReviewIndex(initialReviewIndex);
    setAcceptedSuggestions([]);
  }, [toReview]);

  const handleBack = () => {
    reviewIndex > 0 && setReviewIndex((i) => i - 1);
  };

  const handleReviewComplete = async (
    accepted?: typeof acceptedSuggestions,
  ) => {
    onReviewComplete(accepted || acceptedSuggestions);
  };

  const handleForward = (accepted?: typeof acceptedSuggestions) => {
    reviewIndex < toReview.length - 1
      ? setReviewIndex((i) => i + 1)
      : handleReviewComplete(accepted || acceptedSuggestions);
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
    if (!approved && reviewingField) updateFieldValue(reviewingField);
    await sleep(150);
    setAcceptedSuggestions(accepted);
    handleForward(accepted);
  };

  const handleAcceptAll = async () => {
    const accepted = toReview.map((field, idx) => ({
      ...field,
      approved: true,
      suggestionIndex: idx,
    }));
    for (const f of toReview) {
      await sleep(100);
      updateFieldValue(f, true);
    }
    setAcceptedSuggestions(accepted);
    handleReviewComplete(accepted);
  };

  useEffect(() => {
    if (reviewingField) {
      updateFieldValue(reviewingField, true);
      previewFieldUpdate(reviewingField);
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

  if (reviewIndex === -1) {
    return (
      <div className="fixed inset-0 z-20 flex flex-col items-center justify-center bg-black/50 p-20 text-white backdrop-blur">
        <h2 className="font-black">{toReview.length} fields inferred</h2>
        <div>
          <div className="my-4 flex max-h-[30vh] flex-wrap items-center justify-center gap-2 overflow-auto">
            {toReview.map((field, index) => (
              <div
                key={index}
                className="flex flex-col items-start rounded-lg bg-black/20 px-4 py-2"
              >
                <div className="text-secondary-400 text-xs">{field.label}</div>
                <div className="font-bold">{renderFieldValue(field, true)}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-2 md:flex-row">
          <button
            onClick={handleAcceptAll}
            className="bg-primary-500 hover:bg-primary-600 flex w-full items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold transition-all md:w-auto"
          >
            {/* <KeyboardShortcutKey shortcut={["E"]} /> */}
            {t("accept_all")}
          </button>
          <button
            onClick={() => handleForward()}
            className="hover:bg-secondary-100 flex w-full items-center gap-2 rounded-full bg-white px-4 py-2 text-lg font-semibold text-black transition-all md:w-auto"
          >
            {/* <KeyboardShortcutKey shortcut={["A"]} /> */}
            {t("start_review")}
          </button>
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
      <div className="absolute inset-x-0 bottom-32 flex flex-col items-center justify-center gap-4 p-4 text-white md:bottom-0">
        <div className="flex items-center gap-2">
          <button
            onClick={handleBack}
            className="flex aspect-square items-center justify-center rounded-full border border-white p-2 text-2xl font-semibold text-white"
          >
            {/* <CareIcon icon="l-angle-left" /> */}
          </button>
          <button
            onClick={() => handleVerdict(false)}
            className="hover:bg-secondary-100 flex items-center gap-2 rounded-full bg-white px-4 py-2 text-lg font-semibold text-black transition-all"
          >
            {/* <KeyboardShortcutKey shortcut={["R"]} /> */}
            {t("reject")}
          </button>
          <button
            onClick={() => handleVerdict(true)}
            className="bg-primary-500 hover:bg-primary-600 flex items-center gap-2 rounded-full px-4 py-2 text-lg font-semibold transition-all"
          >
            {/* <KeyboardShortcutKey shortcut={["A"]} /> */}
            {t("accept")}
          </button>
        </div>
        <div className="font-semibold">
          {t("scribe__reviewing_field", {
            currentField: reviewIndex + 1,
            totalFields: toReview.length,
          })}
        </div>
        <div className="flex items-center gap-4">
          {toReview.map((_, i) => (
            <button
              key={i}
              className={`aspect-square w-4 rounded-full ${acceptedSuggestions.find((s) => s.suggestionIndex === i)?.approved === true ? "bg-primary-500" : acceptedSuggestions.find((s) => s.suggestionIndex === i)?.approved === false ? "bg-red-500" : "bg-white"} ${reviewIndex === i ? "opacity-100" : "opacity-50"} transition-all`}
              onClick={() => setReviewIndex(i)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
