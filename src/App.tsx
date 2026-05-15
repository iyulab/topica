import { useEffect } from "react";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/Router";
import { checkHealth } from "./lib/api";
import { topicaWs, type WsMessage } from "./lib/ws";
import { useAppStore, useQueueStore } from "./lib/store";

export default function App() {
  const { setConnected } = useAppStore();
  const { startItem, finishItem, failItem } = useQueueStore();

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

  useEffect(() => {
    return topicaWs.on((msg: WsMessage) => {
      if (msg.type === "queue_started") {
        startItem({ topicId: msg.topicId as string, contentType: msg.contentType as string });
      } else if (msg.type === "content_ready") {
        finishItem(msg.topicId as string, msg.contentType as string);
      } else if (msg.type === "queue_failed") {
        failItem(msg.topicId as string, msg.contentType as string, (msg.errorMessage as string) ?? "생성 실패");
      }
    });
  }, [startItem, finishItem, failItem]);

  return <RouterProvider router={router} />;
}
