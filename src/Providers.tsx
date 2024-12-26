import App from "@/App";
import { FeatureFlagsProvider } from "@/utils/hooks/useFeatureFlags";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export default function Providers() {
  return (
    <QueryClientProvider client={queryClient}>
      <FeatureFlagsProvider>
        <App />
      </FeatureFlagsProvider>
    </QueryClientProvider>
  );
}
