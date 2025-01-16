import App from "@/App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FeatureFlagsProvider } from "./hooks/useFeatureFlags";
import "./style/index.css";
import { ScribePositionProvider } from "./utils/controller-position";

const queryClient = new QueryClient();

export default function Providers(props: {
  formState: unknown;
  setFormState: unknown;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsProvider>
        <ScribePositionProvider>
          <App {...props} />
        </ScribePositionProvider>
      </FeatureFlagsProvider>
    </QueryClientProvider>
  );
}
