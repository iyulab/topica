import { useState } from "react";
import { extractJson } from "../lib/jsonUtils";

interface Card {
  front: string;
  back: string;
}

interface Props {
  body: string;
}

export default function FlashcardViewer({ body }: Props) {
  const [flipped, setFlipped] = useState<Set<number>>(new Set());
  const [current, setCurrent] = useState(0);

  const cards = extractJson<Card[]>(body) ?? [];
  if (cards.length === 0 && body.trim()) {
    return <p style={{ color: "#aaa" }}>플래시카드 데이터를 파싱할 수 없습니다.</p>;
  }

  if (cards.length === 0) return <p style={{ color: "#aaa" }}>카드가 없습니다.</p>;

  const card = cards[current];
  const isFlipped = flipped.has(current);

  const toggle = () =>
    setFlipped((prev) => {
      const next = new Set(prev);
      if (next.has(current)) next.delete(current);
      else next.add(current);
      return next;
    });

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 16, fontSize: 13, color: "#888" }}>
        {current + 1} / {cards.length}
      </div>

      <div
        onClick={toggle}
        style={{
          background: isFlipped ? "#6c63ff" : "#fff",
          color: isFlipped ? "#fff" : "#222",
          border: "2px solid #e0e0e0",
          borderRadius: 12,
          padding: "48px 32px",
          textAlign: "center",
          cursor: "pointer",
          minHeight: 160,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 16,
          lineHeight: 1.6,
          transition: "background 0.2s, color 0.2s",
          userSelect: "none",
        }}
      >
        {isFlipped ? card.back : card.front}
      </div>

      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 20 }}>
        <button
          onClick={() => { setCurrent((c) => Math.max(0, c - 1)); setFlipped(new Set()); }}
          disabled={current === 0}
          style={navBtnStyle(current === 0)}
        >
          ← 이전
        </button>
        <button
          onClick={toggle}
          style={navBtnStyle(false)}
        >
          {isFlipped ? "질문 보기" : "답 보기"}
        </button>
        <button
          onClick={() => { setCurrent((c) => Math.min(cards.length - 1, c + 1)); setFlipped(new Set()); }}
          disabled={current === cards.length - 1}
          style={navBtnStyle(current === cards.length - 1)}
        >
          다음 →
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 16, justifyContent: "center" }}>
        {cards.map((_, i) => (
          <div
            key={i}
            onClick={() => { setCurrent(i); setFlipped(new Set()); }}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: i === current ? "#6c63ff" : "#ddd",
              cursor: "pointer",
            }}
          />
        ))}
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
