import { Controller } from "./components/Controller";
import { useEffect, useRef } from "react";
import { useFeatureFlags } from "./hooks/useFeatureFlags";
import { usePath } from "raviger";
import { useAtom } from "jotai";
import { containerRefAtom } from "./store";
import { Toaster } from "./components/ui/sonner";

export default function App(props: {
  formState: unknown;
  setFormState: (formState: unknown) => void;
}) {
  const path = usePath();
  const container = useRef<HTMLDivElement>(null);
  const [, setContainerRef] = useAtom(containerRefAtom);
  const facilityId = path?.includes("/facility/")
    ? path.split("/facility/")[1].split("/")[0]
    : undefined;
  const featureFlags = useFeatureFlags(facilityId);
  const SCRIBE_ENABLED = featureFlags.includes("SCRIBE_ENABLED");

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
      setContainerRef(container);
    }
  }, [container, setContainerRef]);

  return (
    <div className="scribe-container" ref={container}>
      <Toaster position="top-right" richColors expand theme="light" />
      {SCRIBE_ENABLED && <Controller {...props} />}
    </div>
  );
}
