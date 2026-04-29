import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useContainerRef } from "@/hooks/useContainerRef";
import { Question, ScribeQuestionnaireInstruction } from "@/types";
import { API } from "@/utils/api";
import { I18NNAMESPACE } from "@/utils/constants";
import {
  CheckIcon,
  DotsVerticalIcon,
  ExternalLinkIcon,
  MinusCircledIcon,
  PlusCircledIcon,
} from "@radix-ui/react-icons";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, navigate } from "raviger";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { twMerge } from "tailwind-merge";

export default function QuestionnaireInstructionsUpdate(props: {
  instructionId: string;
}) {
  const { instructionId } = props;
  const { t } = useTranslation(I18NNAMESPACE);
  const [instruction, setInstruction] =
    useState<ScribeQuestionnaireInstruction | null>(null);
  const containerRef = useContainerRef();

  const instructionQuery = useQuery({
    queryKey: ["scribe-questionnaire-instructions", instructionId],
    queryFn: () => API.questionnaireInstructions.get(instructionId),
  });

  const questionnaireQuery = useQuery({
    queryKey: ["questionnaires", instruction?.questionnaire_slug],
    queryFn: () => API.questionnaire.get(instruction?.questionnaire_slug || ""),
    enabled: !!instruction?.questionnaire_slug,
  });

  const questionnaire = questionnaireQuery.data;

  const deleteInstructionMutation = useMutation({
    mutationFn: () => API.questionnaireInstructions.delete(instructionId),
    onSuccess: () => {
      toast.success(t("instruction_deleted_successfully"));
      navigate("/admin/scribe/questionnaire-instructions");
    },
    onError: () => {
      toast.error(t("error_deleting_instruction"));
    },
  });

  const updateInstructionMutation = useMutation({
    mutationFn: (data: ScribeQuestionnaireInstruction) =>
      API.questionnaireInstructions.update(instructionId, data),
    onSuccess: () => {
      toast.success(t("instruction_updated_successfully"));
      instructionQuery.refetch();
    },
    onError: () => {
      toast.error(t("error_updating_instruction"));
    },
  });

  useEffect(() => {
    if (instructionQuery.data) {
      setInstruction(instructionQuery.data);
    }
  }, [instructionQuery.data]);

  if (
    instructionQuery.isLoading ||
    questionnaireQuery.isLoading ||
    !instruction
  ) {
    return (
      <div className="px-4 md:px-6">
        <Skeleton className="mb-4 h-10 w-1/3" />
      </div>
    );
  }

  return (
    <div className="px-4 md:px-6">
      <div className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
          <span>{questionnaire?.title}</span>
          <Link
            className="text-blue-500"
            href={`/admin/questionnaire/${instruction.questionnaire_slug}/edit`}
          >
            <ExternalLinkIcon />
          </Link>
        </h1>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              updateInstructionMutation.mutate(instruction);
            }}
          >
            <CheckIcon />
            {t("save")}
          </Button>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button className="flex aspect-square w-6 items-center justify-center rounded-lg text-sm transition-all hover:bg-black/10">
                <DotsVerticalIcon className="text-xl" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="w-48"
              portalProps={{ container: containerRef?.current }}
            >
              <DropdownMenuGroup>
                <DropdownMenuItem
                  onClick={() => {
                    deleteInstructionMutation.mutate();
                  }}
                >
                  {t("delete")}
                </DropdownMenuItem>
              </DropdownMenuGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <span>{t("scribe_instructions")}</span>
      <div className="mt-4 rounded-lg border border-neutral-200 bg-white p-4">
        <label>{t("overall_instructions")}</label>
        <Textarea
          className="mt-2"
          value={instruction?.instructions.instructions || ""}
          onChange={(e) => {
            if (instruction) {
              setInstruction({
                ...instruction,
                instructions: {
                  ...instruction.instructions,
                  instructions: e.target.value,
                },
              });
            }
          }}
        />
      </div>
      <div className="mt-8">
        {questionnaire?.questions.map((question, index) => (
          <QuestionnaireQuestion
            key={index}
            question={question}
            instructions={instruction}
            setInstructions={setInstruction}
            index={index}
          />
        ))}
      </div>
    </div>
  );
}

function QuestionnaireQuestion(props: {
  question: Question;
  instructions: ScribeQuestionnaireInstruction;
  setInstructions: (instructions: ScribeQuestionnaireInstruction) => void;
  parentIndex?: number;
  index: number;
}) {
  const instruction = props.instructions.instructions.questions.find(
    (q) => q.id === props.question.id,
  );

  const { t } = useTranslation(I18NNAMESPACE);

  return (
    <div className="border-l border-l-neutral-300 pl-4">
      <div className="flex items-center justify-between pt-4">
        <div className="block font-semibold">
          <span className="mr-2 font-normal opacity-50">
            {typeof props.parentIndex === "number"
              ? `${props.parentIndex + 1}.`
              : ""}
            {props.index + 1}
          </span>
          {props.question.text}
        </div>
        <button
          className={twMerge(
            "flex items-center gap-2 text-sm",
            instruction && "text-red-500",
          )}
          onClick={() => {
            if (!instruction) {
              props.setInstructions({
                ...props.instructions,
                instructions: {
                  ...props.instructions.instructions,
                  questions: [
                    ...props.instructions.instructions.questions,
                    {
                      id: props.question.id,
                      instructions: "",
                    },
                  ],
                },
              });
            } else {
              props.setInstructions({
                ...props.instructions,
                instructions: {
                  ...props.instructions.instructions,
                  questions: props.instructions.instructions.questions.filter(
                    (q) => q.id !== props.question.id,
                  ),
                },
              });
            }
          }}
        >
          {instruction ? <MinusCircledIcon /> : <PlusCircledIcon />}
          {instruction ? t("remove_instructions") : t("add_instructions")}
        </button>
      </div>
      <div className="pb-4">
        {instruction && (
          <Textarea
            className="mt-4 bg-white"
            placeholder={t("question_instruction_placeholder")}
            value={instruction.instructions || ""}
            onChange={(e) => {
              const updatedInstructions =
                props.instructions.instructions.questions.map((q) =>
                  q.id === props.question.id
                    ? { ...q, instructions: e.target.value }
                    : q,
                );
              props.setInstructions({
                ...props.instructions,
                instructions: {
                  ...props.instructions.instructions,
                  questions: updatedInstructions,
                },
              });
            }}
          />
        )}
      </div>
      {props.question.questions &&
        props.question.questions.map((subQuestion, index) => (
          <QuestionnaireQuestion
            key={index}
            question={subQuestion}
            instructions={props.instructions}
            setInstructions={props.setInstructions}
            parentIndex={props.index}
            index={index}
          />
        ))}
    </div>
  );
}
