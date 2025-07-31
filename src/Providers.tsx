import App from "@/App";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "./style/index.css";

const queryClient = new QueryClient();

export default function Providers(props: {
  formState: unknown;
  setFormState: (formState: unknown) => void;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <App {...props} />
    </QueryClientProvider>
  );
}
