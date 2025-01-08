import { useEffect } from "react";
import { Controller } from "./components/Controller";
import { usePath } from "raviger";
import { useFeatureFlags } from "./hooks/useFeatureFlags";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import translation from "./locale/en.json";
import { Toaster } from "./components/ui/toaster";

export default function App(props: {
  formState: unknown;
  setFormState: unknown;
}) {
  const path = usePath();
  const facilityId = path?.includes("/facility/")
    ? path.split("/facility/")[1].split("/")[0]
    : undefined;
  const featureFlags = useFeatureFlags(facilityId);
  const SCRIBE_ENABLED = featureFlags.includes("SCRIBE_ENABLED");

  i18n.use(initReactI18next).init({
    resources: {
      en: {
        translation,
      },
    },
    lng: localStorage.getItem("i18nextLng") || "en",
    fallbackLng: "en",
    interpolation: {
      escapeValue: false,
    },
    saveMissing: false,
  });

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

  return (
    <div>
      <Toaster />
      {SCRIBE_ENABLED && <Controller {...props} />}
    </div>
  );
}
