import { useEffect, useRef, useState } from "react";
import { submitEval } from "../lib/api";

interface Question {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface Props {
  body: string;
  topicId?: string;
  contentId?: string;
  onLevelChange?: (newLevel: number) => void;
  onComplete?: (score: number, total: number, durationSeconds: number) => void;
}

export default function QuizViewer({ body, topicId, contentId, onLevelChange, onComplete }: Props) {
  const [selected, setSelected] = useState<Map<number, number>>(new Map());
  const [current, setCurrent] = useState(0);
  const [submitted, setSubmitted] = useState(false);
  const [evalResult, setEvalResult] = useState<{ newLevel: number; levelChanged: boolean } | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  let questions: Question[] = [];
  try { questions = JSON.parse(body) as Question[]; } catch { /* ignore */ }

  const score = [...selected.entries()].filter(([i, v]) => questions[i]?.answer === v).length;

  useEffect(() => {
    setCurrent(0);
    setSelected(new Map());
    setSubmitted(false);
    setEvalResult(null);
    startTimeRef.current = Date.now();
  }, [body]);

  useEffect(() => {
    if (submitted) onComplete?.(score, questions.length, Math.round((Date.now() - startTimeRef.current) / 1000));
  }, [submitted]); // eslint-disable-line react-hooks/exhaustive-deps

  if (questions.length === 0 && body.trim()) {
    return <p style={{ color: "#aaa" }}>퀴즈 데이터를 파싱할 수 없습니다.</p>;
  }

  if (questions.length === 0) return <p style={{ color: "#aaa" }}>문제가 없습니다.</p>;

  if (submitted && evalResult) {
    const percent = Math.round((score / questions.length) * 100);
    const emoji = percent >= 80 ? "🎉" : percent >= 60 ? "👍" : "💪";
    const handleRetry = () => {
      setSelected(new Map());
      setCurrent(0);
      setSubmitted(false);
      setEvalResult(null);
      startTimeRef.current = Date.now();
    };
    return (
      <div style={{ textAlign: "center", padding: "32px 0" }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>{emoji}</div>
        <h3 style={{ fontSize: 20, margin: "0 0 8px" }}>퀴즈 완료!</h3>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#6c63ff", marginBottom: 4 }}>
          {score} / {questions.length}
        </div>
        <div style={{ fontSize: 15, color: "#888", marginBottom: 20 }}>{percent}% 정답</div>
        {evalResult.levelChanged && (
          <div style={{
            background: "#e8f5e9", border: "1px solid #4caf50",
            borderRadius: 8, padding: "10px 16px", marginBottom: 20,
            fontSize: 13, color: "#2e7d32", display: "inline-block",
          }}>
            🎯 레벨이 {evalResult.newLevel}로 조정되었습니다
          </div>
        )}
        <div>
          <button
            onClick={handleRetry}
            style={{
              padding: "10px 24px", background: "#6c63ff", color: "#fff",
              border: "none", borderRadius: 6, cursor: "pointer", fontSize: 14, fontWeight: 600,
            }}
          >
            다시 도전
          </button>
        </div>
      </div>
    );
  }

  const q = questions[current];
  const chosen = selected.get(current);
  const answered = chosen !== undefined;
  const allAnswered = selected.size === questions.length;

  const handleSubmit = async () => {
    if (!topicId || !contentId || submitted) return;
    try {
      const result = await submitEval(topicId, contentId, score, questions.length);
      setEvalResult(result);
      setSubmitted(true);
      if (result.levelChanged) onLevelChange?.(result.newLevel);
    } catch {
      // silently ignore
    }
  };

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 13, color: "#888" }}>
        <span>문제 {current + 1} / {questions.length}</span>
        <span>점수: {score}/{questions.length}</span>
      </div>

      {evalResult && (
        <div style={{
          marginBottom: 16, padding: "10px 16px",
          background: evalResult.levelChanged ? "#e8f5e9" : "#f5f5f5",
          border: `1px solid ${evalResult.levelChanged ? "#4caf50" : "#ddd"}`,
          borderRadius: 8, fontSize: 13,
          color: evalResult.levelChanged ? "#2e7d32" : "#666",
        }}>
          {evalResult.levelChanged
            ? `🎯 레벨이 ${evalResult.newLevel}로 조정되었습니다`
            : `현재 레벨 유지 (Lv. ${evalResult.newLevel})`}
        </div>
      )}

      <div style={{ background: "#f8f8ff", borderRadius: 8, padding: "20px 24px", marginBottom: 16 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "#222", margin: "0 0 16px" }}>{q.question}</p>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {q.options.map((opt, i) => {
            let bg = "#fff";
            let border = "1px solid #ddd";
            let color = "#333";
            if (answered) {
              if (i === q.answer) { bg = "#d4edda"; border = "1px solid #28a745"; color = "#155724"; }
              else if (i === chosen) { bg = "#f8d7da"; border = "1px solid #dc3545"; color = "#721c24"; }
            } else if (chosen === i) {
              bg = "#e8e5ff"; border = "1px solid #6c63ff";
            }

            return (
              <div
                key={i}
                onClick={() => !answered && setSelected((m) => new Map(m).set(current, i))}
                style={{
                  background: bg, border, borderRadius: 6, padding: "10px 14px",
                  cursor: answered ? "default" : "pointer", fontSize: 14, color,
                  display: "flex", alignItems: "center", gap: 10,
                }}
              >
                <span style={{ fontWeight: 600, minWidth: 20 }}>{String.fromCharCode(65 + i)}.</span>
                {opt}
              </div>
            );
          })}
        </div>

        {answered && (
          <div style={{ marginTop: 12, padding: "10px 14px", background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 6, fontSize: 13, color: "#856404" }}>
            💡 {q.explanation}
          </div>
        )}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <button onClick={() => setCurrent((c) => Math.max(0, c - 1))} disabled={current === 0} style={navBtnStyle(current === 0)}>
          ← 이전
        </button>

        {allAnswered && topicId && contentId && !submitted && (
          <button
            onClick={handleSubmit}
            style={{
              padding: "8px 20px", background: "#6c63ff", color: "#fff",
              border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}
          >
            결과 제출
          </button>
        )}

        <button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))} disabled={current === questions.length - 1} style={navBtnStyle(current === questions.length - 1)}>
          다음 →
        </button>
      </div>
    </div>
  );
}

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 16px", border: "1px solid #ddd", borderRadius: 6,
    background: disabled ? "#f5f5f5" : "#fff",
    color: disabled ? "#ccc" : "#333",
    cursor: disabled ? "not-allowed" : "pointer", fontSize: 13,
  };
}
