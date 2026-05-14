import { useState } from "react";
import { extractJson } from "../lib/jsonUtils";

interface Question {
  question: string;
  options: string[];
  answer: number;
  explanation: string;
}

interface Props {
  body: string;
}

export default function QuizViewer({ body }: Props) {
  const [selected, setSelected] = useState<Map<number, number>>(new Map());
  const [current, setCurrent] = useState(0);

  const questions = extractJson<Question[]>(body) ?? [];
  if (questions.length === 0 && body.trim()) {
    return <p style={{ color: "#aaa" }}>퀴즈 데이터를 파싱할 수 없습니다.</p>;
  }

  if (questions.length === 0) return <p style={{ color: "#aaa" }}>문제가 없습니다.</p>;

  const q = questions[current];
  const chosen = selected.get(current);
  const answered = chosen !== undefined;

  const score = [...selected.entries()].filter(([i, v]) => questions[i]?.answer === v).length;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16, fontSize: 13, color: "#888" }}>
        <span>문제 {current + 1} / {questions.length}</span>
        <span>점수: {score}/{questions.length}</span>
      </div>

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
                  background: bg,
                  border,
                  borderRadius: 6,
                  padding: "10px 14px",
                  cursor: answered ? "default" : "pointer",
                  fontSize: 14,
                  color,
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
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

      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          style={navBtnStyle(current === 0)}
        >
          ← 이전
        </button>
        <button
          onClick={() => setCurrent((c) => Math.min(questions.length - 1, c + 1))}
          disabled={current === questions.length - 1}
          style={navBtnStyle(current === questions.length - 1)}
        >
          다음 →
        </button>
      </div>
    </div>
  );
}

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    padding: "8px 16px",
    border: "1px solid #ddd",
    borderRadius: 6,
    background: disabled ? "#f5f5f5" : "#fff",
    color: disabled ? "#ccc" : "#333",
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
  };
}
