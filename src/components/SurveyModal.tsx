import { useEffect, useRef, useState } from "react";
import { saveSurveyAnswers, surveyStream } from "../lib/api";

interface Props {
  topicId: string;
  onClose: () => void;
}

export default function SurveyModal({ topicId, onClose }: Props) {
  const [questions, setQuestions] = useState<string[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [streaming, setStreaming] = useState(true);
  const [saving, setSaving] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    (async () => {
      try {
        for await (const q of surveyStream(topicId, ctrl.signal)) {
          setQuestions((prev) => [...prev, q]);
          setAnswers((prev) => [...prev, ""]);
        }
      } catch {
        // aborted or error
      } finally {
        setStreaming(false);
      }
    })();

    return () => ctrl.abort();
  }, [topicId]);

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await saveSurveyAnswers(topicId, answers);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: "#fff", borderRadius: 12, padding: 28, width: 520, maxWidth: "90vw",
        maxHeight: "80vh", overflow: "auto", boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
          <h3 style={{ margin: 0, color: "#222" }}>학습 목표 파악</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 18, color: "#888" }}>✕</button>
        </div>

        {streaming && questions.length === 0 && (
          <p style={{ color: "#888", fontSize: 14 }}>AI가 질문을 준비하는 중...</p>
        )}

        {questions.map((q, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 500, color: "#333" }}>{q}</p>
            <input
              value={answers[i] ?? ""}
              onChange={(e) => {
                const updated = [...answers];
                updated[i] = e.target.value;
                setAnswers(updated);
              }}
              placeholder="답변 입력..."
              style={{
                width: "100%", padding: "8px 12px", border: "1px solid #ddd",
                borderRadius: 6, fontSize: 13, boxSizing: "border-box",
              }}
            />
          </div>
        ))}

        {streaming && questions.length > 0 && (
          <p style={{ color: "#888", fontSize: 13, margin: "4px 0" }}>⏳ 질문 생성 중...</p>
        )}

        {!streaming && (
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button
              onClick={handleSubmit}
              disabled={saving}
              style={{
                flex: 1, padding: "10px 0", background: "#6c63ff", color: "#fff",
                border: "none", borderRadius: 8, cursor: saving ? "not-allowed" : "pointer",
                fontSize: 14, fontWeight: 600, opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? "저장 중..." : "완료 — 학습 시작"}
            </button>
            <button
              onClick={onClose}
              style={{
                padding: "10px 16px", background: "#f0f0f0", border: "none",
                borderRadius: 8, cursor: "pointer", fontSize: 14,
              }}
            >
              건너뛰기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
