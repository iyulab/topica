import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/Router";
import { checkHealth } from "./lib/api";
import { topicaWs } from "./lib/ws";
import { useAppStore } from "./lib/store";

export default function App() {
  const { setConnected } = useAppStore();

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      for (let i = 0; i < 10; i++) {
        if (cancelled) return;
        const ok = await checkHealth();
        if (cancelled) return;
        if (ok) {
          await topicaWs.connect();
          setConnected(true);
          return;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    };

    init();

    return () => {
      cancelled = true;
      topicaWs.close();
      setConnected(false);
    };
  }, [setConnected]);

  return <RouterProvider router={router} />;
}
