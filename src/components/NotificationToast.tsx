import { useEffect, useState } from "react";
import { topicaWs, type WsMessage } from "../lib/ws";
import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";

interface Toast {
  id: string;
  message: string;
}

async function sendOsNotification(title: string, body: string) {
  try {
    let granted = await isPermissionGranted();
    if (!granted) {
      const permission = await requestPermission();
      granted = permission === "granted";
    }
    if (granted) {
      sendNotification({ title, body });
    }
  } catch {
    // OS 알림 실패 시 앱 내 토스트만 표시
  }
}

const CONTENT_TYPE_LABELS: Record<string, string> = {
  Summary: "요약",
  Lecture: "강의",
  Flashcard: "플래시카드",
  Quiz: "퀴즈",
  Mindmap: "마인드맵",
};

export default function NotificationToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    const off = topicaWs.on((msg: WsMessage) => {
      if (msg.type === "content_ready") {
        const type = msg.contentType as string;
        const label = CONTENT_TYPE_LABELS[type] ?? type;
        const message = `${label} 생성 완료!`;

        const toast: Toast = { id: Date.now().toString(), message };
        setToasts((prev) => [...prev, toast]);
        setTimeout(() => {
          setToasts((prev) => prev.filter((t) => t.id !== toast.id));
        }, 4000);

        sendOsNotification("Topica", message);
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
