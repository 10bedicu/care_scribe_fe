import { ScribeModel } from "@/types";
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "./ui/dialog";
import { useAtom } from "jotai";
import { containerRefAtom } from "@/store";
import { Textarea } from "./ui/textarea";
import { Button } from "./ui/button";
import { useMutation } from "@tanstack/react-query";
import { API } from "@/utils/api";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";

export default function Feedback(props: { scribe: ScribeModel }) {
  const { scribe } = props;
  const [feedback, setFeedback] = useState<{
    isPositive: boolean | null;
    comments: string;
  }>({
    isPositive: null,
    comments: "",
  });

  const [containerRef] = useAtom(containerRefAtom);
  const [currentFeedback, setCurrentFeedback] = useState({
    isPositive: scribe.is_feedback_positive,
    comments: scribe.feedback_comments,
  });

  const feedbackMutation = useMutation({
    mutationFn: () =>
      API.scribe.update(scribe.external_id, {
        is_feedback_positive: feedback.isPositive,
        feedback_comments: feedback.comments || null,
      }),
    onSuccess: (data) => {
      setCurrentFeedback({
        isPositive: data.is_feedback_positive,
        comments: data.feedback_comments,
      });
      toast.success("Feedback submitted successfully!");
      setFeedback({ isPositive: null, comments: "" });
    },
    onError: (error) => {
      toast.error(`Failed to submit feedback: ${error}`);
    },
  });

  useEffect(() => {
    setCurrentFeedback({
      isPositive: scribe.is_feedback_positive,
      comments: scribe.feedback_comments,
    });
  }, [scribe]);

  return (
    <div className="flex items-center justify-center">
      {currentFeedback.isPositive === null && (
        <div className="text-xs opacity-50">
          Was this response satisfactory?
        </div>
      )}
      {["👍🏻", "👎🏻"].map((emoji, i) => (
        <button
          key={emoji}
          onClick={() => setFeedback({ ...feedback, isPositive: !i })}
          className={twMerge(
            "flex aspect-square w-8 shrink-0 items-center justify-center rounded-lg text-xl hover:bg-black/10",
            currentFeedback.isPositive === !!i && "opacity-50",
          )}
        >
          {emoji}
        </button>
      ))}
      <Dialog
        open={feedback.isPositive !== null}
        onOpenChange={(open) => {
          if (!open) {
            setFeedback((f) => ({ ...f, isPositive: null }));
          }
        }}
      >
        <DialogContent portalProps={{ container: containerRef?.current }}>
          <DialogTitle className="text-lg font-semibold">
            {feedback.isPositive
              ? "Thank you for your feedback! Can you tell us what you liked?"
              : "We're sorry to hear that. Can you tell us what went wrong?"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Please provide any additional comments or suggestions.
          </DialogDescription>
          <Textarea
            value={feedback.comments}
            onChange={(e) =>
              setFeedback({ ...feedback, comments: e.target.value })
            }
            placeholder="Your comments here (optional)"
            className="mt-2 h-40"
          />
          <Button
            className="mt-2"
            onClick={() => {
              feedbackMutation.mutate();
            }}
          >
            Submit Feedback
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
