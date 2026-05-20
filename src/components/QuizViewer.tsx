import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
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
    return <p style={{ color: "#aaa" }}>{t('quiz.parse.error')}</p>;
  }

  if (questions.length === 0) return <p style={{ color: "#aaa" }}>{t('quiz.empty')}</p>;

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
        <h3 style={{ fontSize: 20, margin: "0 0 8px" }}>{t('quiz.complete')}</h3>
        <div style={{ fontSize: 32, fontWeight: 700, color: "#6c63ff", marginBottom: 4 }}>
          {t('quiz.score', { score, total: questions.length })}
        </div>
        <div style={{ fontSize: 15, color: "#888", marginBottom: 20 }}>{t('quiz.percent', { percent })}</div>
        {evalResult.levelChanged && (
          <div style={{
            background: "#e8f5e9", border: "1px solid #4caf50",
            borderRadius: 8, padding: "10px 16px", marginBottom: 20,
            fontSize: 13, color: "#2e7d32", display: "inline-block",
          }}>
            {t('quiz.level.changed', { level: evalResult.newLevel })}
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
            {t('quiz.retry')}
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
        <span>{t('quiz.progress', { current: current + 1, total: questions.length })}</span>
        <span>{t('quiz.score', { score, total: questions.length })}</span>
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
            ? t('quiz.level.changed', { level: evalResult.newLevel })
            : t('quiz.level.same', { level: evalResult.newLevel })}
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

            const answerLabel = answered
              ? i === q.answer ? t('quiz.answer.correct') : i === chosen ? t('quiz.answer.wrong') : ""
              : "";
            return (
              <button
                key={i}
                onClick={() => !answered && setSelected((m) => new Map(m).set(current, i))}
                aria-disabled={answered}
                aria-pressed={!answered ? chosen === i : undefined}
                aria-label={`${String.fromCharCode(65 + i)}. ${opt}${answerLabel}`}
                style={{
                  background: bg, border, borderRadius: 6, padding: "10px 14px",
                  cursor: answered ? "default" : "pointer", fontSize: 14, color,
                  display: "flex", alignItems: "center", gap: 10,
                  width: "100%", textAlign: "left",
                }}
              >
                <span aria-hidden="true" style={{ fontWeight: 600, minWidth: 20 }}>{String.fromCharCode(65 + i)}.</span>
                {opt}
              </button>
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
          {t('quiz.prev')}
        </button>

        {allAnswered && topicId && contentId && !submitted && (
          <button
            onClick={handleSubmit}
            style={{
              padding: "8px 20px", background: "#6c63ff", color: "#fff",
              border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600,
            }}
          >
            {t('quiz.submit')}
          </button>
        )}

        <button onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))} disabled={current === questions.length - 1} style={navBtnStyle(current === questions.length - 1)}>
          {t('quiz.next')}
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
