import SidebarIcon from "@/components/Icon";
import { PaginationControls } from "@/components/Pagination";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useContainerRef } from "@/hooks/useContainerRef";
import { ScribeQuestionnaireInstructionsCreateRequest } from "@/types";
import { API } from "@/utils/api";
import { I18NNAMESPACE } from "@/utils/constants";
import { debounce } from "@/utils/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import dayjs from "dayjs";
import { navigate, useQueryParams } from "raviger";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

export default function QuestionnaireInstructionsList() {
  const { t } = useTranslation(I18NNAMESPACE);

  const [{ page: initPage }, setQueryParams] = useQueryParams();
  const containerRef = useContainerRef();
  const page = initPage || 1;
  const [search, setSearch] = useState("");
  const [newInstruction, setNewInstruction] = useState({
    questionnaire_id: "",
  });

  const instructionsQuery = useQuery({
    queryKey: ["scribe-questionnaire-instructions", page, search],
    queryFn: () =>
      API.questionnaireInstructions.list({
        ordering: "-created_date",
        questionnaire_title: search || undefined,
        offset: (Number(page) - 1) * 10,
        limit: 10,
      }),
  });

  const questionnaireQuery = useQuery({
    queryKey: ["questionnaires"],
    queryFn: () => API.questionnaire.list(),
  });

  const createQuestionnaireInstructionMutation = useMutation({
    mutationFn: (data: ScribeQuestionnaireInstructionsCreateRequest) =>
      API.questionnaireInstructions.create(data),
    onSuccess: (data) => {
      toast.success(t("instruction_added_successfully"));
      setNewInstruction({ questionnaire_id: "" });
      navigate(`/admin/scribe/questionnaire-instructions/${data.external_id}`);
    },
    onError: (data: any) => {
      toast.error(
        data?.error?.non_field_errors?.[0] || t("error_adding_instruction"),
      );
    },
  });

  const handleSearch = debounce((value: string) => {
    setSearch(value);
    setQueryParams({ page: 1 });
  }, 500);
  const instructions = instructionsQuery.data?.results;
  const questionnaires = questionnaireQuery.data?.results;

  return (
    <div className="px-4 md:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-50">
          {t("questionnaire_instructions")}
        </h1>
        <Sheet>
          <SheetTrigger asChild>
            <Button>{t("add_instructions")}</Button>
          </SheetTrigger>
          <SheetContent
            portalProps={{ container: containerRef?.current }}
            className=""
          >
            <SheetTitle className="p-4">{t("add_instructions")}</SheetTitle>
            <SheetDescription className="sr-only">
              Add new questionnaire instruction
            </SheetDescription>
            <div className="p-4 pt-0">
              <label>{t("questionnaire")}</label>
              <Select
                value={newInstruction.questionnaire_id || ""}
                onValueChange={(value) => {
                  setNewInstruction({
                    ...newInstruction,
                    questionnaire_id: value,
                  });
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("questionnaire")} />
                </SelectTrigger>
                <SelectContent>
                  {questionnaires?.map((questionnaire) => (
                    <SelectItem
                      key={questionnaire.id}
                      value={questionnaire.id || ""}
                    >
                      {questionnaire.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <SheetFooter className="p-0">
                <SheetClose>
                  <Button
                    disabled={!newInstruction.questionnaire_id}
                    onClick={() => {
                      createQuestionnaireInstructionMutation.mutate({
                        add_questionnaire_id: newInstruction.questionnaire_id,
                        instructions: {
                          instructions: "",
                          questions: [],
                        },
                      });
                    }}
                    className="mt-4 w-full"
                  >
                    {t("add_instructions")}
                  </Button>
                </SheetClose>
              </SheetFooter>
            </div>
          </SheetContent>
        </Sheet>
      </div>
      <div className="mt-4 flex flex-col gap-2">
        <div className="flex flex-col items-center justify-between gap-2 md:flex-row">
          <Input
            placeholder={t("search_by_questionnaire_title")}
            className="w-full bg-white md:max-w-64 md:min-w-24"
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>
        <Table className="overflow-hidden rounded-lg border bg-white shadow-sm">
          <TableHeader>
            <TableRow>
              <TableHead>{t("questionnaire")}</TableHead>
              <TableHead>{t("created_at")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {instructions?.map((instruction) => (
              <TableRow
                onClick={() =>
                  navigate(
                    `/admin/scribe/questionnaire-instructions/${instruction.external_id}`,
                  )
                }
                key={instruction.external_id}
                className="cursor-pointer"
              >
                <TableCell>{instruction.questionnaire_title}</TableCell>
                <TableCell>
                  {dayjs(instruction.created_date).format(
                    "D MMMM YYYY; hh:mm a",
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {instructionsQuery.isLoading && (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-[50px] rounded-lg" />
            <Skeleton className="h-[50px] rounded-lg" />
            <Skeleton className="h-[50px] rounded-lg" />
          </div>
        )}
        {instructionsQuery.isFetched && history?.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-4 rounded-lg opacity-50">
            <div className="text-8xl">
              <SidebarIcon />
            </div>
            {t("no_instructions_found")}
          </div>
        )}
        {instructionsQuery.data &&
          (instructionsQuery.data.next || instructionsQuery.data.previous) && (
            <PaginationControls
              data={instructionsQuery.data}
              onPageChange={(url) => navigate(url)}
            />
          )}
      </div>
    </div>
  );
}
