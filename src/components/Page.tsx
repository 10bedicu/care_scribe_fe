import { containerRefAtom } from "@/store";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAtom } from "jotai";
import { useEffect, useRef } from "react";
import { Toaster } from "./ui/sonner";

const queryClient = new QueryClient();

export default function Page(props: { children: React.ReactNode }) {
  const [, setContainerRef] = useAtom(containerRefAtom);

  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (container.current) {
      setContainerRef(container);
    }
  }, [container, setContainerRef]);

  return (
    <QueryClientProvider client={queryClient}>
      <Toaster position="top-right" richColors expand theme="light" />
      <div className="scribe-container" ref={container}>
        {props.children}
      </div>
    </QueryClientProvider>
  );
}
