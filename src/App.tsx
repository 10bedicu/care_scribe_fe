import { Controller } from "./components/Controller";
import { useEffect, useRef } from "react";
import { usePath } from "raviger";
import { Toaster } from "./components/ui/sonner";
import { useQuota } from "./hooks/useQuota";
import { useContainerRef } from "./hooks/useContainerRef";

export default function App(props: {
  formState: unknown;
  setFormState: (formState: unknown) => void;
}) {
  const path = usePath();
  const container = useRef<HTMLDivElement>(null);
  const containerRef = useContainerRef();
  const facilityId = path?.includes("/facility/")
    ? path.split("/facility/")[1].split("/")[0]
    : undefined;
  const quota = useQuota(facilityId);
  const SCRIBE_ENABLED = !!quota.quotas?.length;

  useEffect(() => {
    if (!SCRIBE_ENABLED) return;
    const pageElement = document.querySelector(
      '[data-cui-page="true"]',
    ) as HTMLElement;
    if (pageElement) {
      pageElement.style.setProperty("padding-bottom", "100px", "important");
    }

    return () => {
      if (pageElement) {
        pageElement.style.paddingBottom = "";
      }
    };
  }, []);

  useEffect(() => {
    if (container.current) {
      containerRef.current = container.current;
    }
  }, [container, containerRef]);

  return (
    <div className="scribe-container" ref={container}>
      <Toaster position="top-right" richColors expand theme="light" />
      {SCRIBE_ENABLED && <Controller {...props} />}
    </div>
  );
}
