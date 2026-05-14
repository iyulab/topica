import { useEffect, useState } from "react";
import { topicaWs, type WsMessage } from "../lib/ws";

interface Toast {
  id: string;
  message: string;
}

export default function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const off = topicaWs.on((msg: WsMessage) => {
      if (msg.type === "content_ready") {
        const type = msg.contentType as string;
        const label = type === "Summary" ? "요약" : type === "Lecture" ? "강해" : type;
        const toast: Toast = {
          id: Date.now().toString(),
          message: `${label} 생성 완료!`,
        };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 4000);
      }
    });
    return off;
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: "fixed",
      bottom: 24,
      right: 24,
      display: "flex",
      flexDirection: "column",
      gap: 8,
      zIndex: 1000,
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            background: "#323232",
            color: "#fff",
            padding: "10px 16px",
            borderRadius: 6,
            fontSize: 13,
            boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>✓</span>
          {toast.message}
        </div>
      ))}
    </div>
  );
}
