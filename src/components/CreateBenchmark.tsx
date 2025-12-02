import useAuthUser from "@/hooks/useAuthUser";
import { ScribeModel } from "@/types";
import { Button } from "./ui/button";
import { useTranslation } from "react-i18next";
import { I18NNAMESPACE } from "@/utils/constants";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "./ui/dialog";
import { useContainerRef } from "@/hooks/useContainerRef";
import { useStorage } from "@/hooks/useStorage";
import { CreatedBenchmark } from "@/pages/Benchmark";

export default function CreateBenchmark(props: {
  scribe: ScribeModel;
  formState: unknown;
}) {
  const { t } = useTranslation(I18NNAMESPACE);
  const containerRef = useContainerRef();
  const [createdBenchmarks, setCreatedBenchmarks] = useStorage(
    "scribe-created-benchmarks",
  );

  const { scribe, formState } = props;

  const user = useAuthUser();

  const handleCreateBenchmark = async () => {
    if (!scribe) {
      alert(t("no_scribe_to_benchmark"));
      return;
    }

    const form: any = formState ? formState : [];
    const qIds = form.map((f: any) => f.questionnaire.id);
    const newBenchmark: CreatedBenchmark = {
      id: crypto.randomUUID(),
      createdAt: new Date(),
      questionnaireIds: qIds,
      expectedResult: form,
    };
    setCreatedBenchmarks((prev) => [...prev, newBenchmark]);
  };

  if (!user?.is_superuser) return null;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button>{t("create_benchmark")}</Button>
      </DialogTrigger>
      <DialogContent portalProps={{ container: containerRef?.current }}>
        <DialogTitle className="text-lg font-semibold">
          {t("create_benchmark")}?
        </DialogTitle>
        <p>{t("create_benchmark_information")}</p>
        <Button onClick={handleCreateBenchmark}>{t("create_benchmark")}</Button>
      </DialogContent>
    </Dialog>
  );
}
