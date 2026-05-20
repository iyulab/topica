import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface Card {
  front: string;
  back: string;
}

interface Props {
  body: string;
  onComplete?: (flashcardsStudied: number, durationSeconds: number) => void;
}

export default function FlashcardViewer({ body, onComplete }: Props) {
  const { t } = useTranslation();
  const [isFlipped, setIsFlipped] = useState(false);
  const [current, setCurrent] = useState(0);
  const [studied, setStudied] = useState<Set<number>>(new Set());
  const startTimeRef = useRef<number>(Date.now());

  let cards: Card[] = [];
  try { cards = JSON.parse(body) as Card[]; } catch { /* ignore */ }

  const goTo = (idx: number) => {
    setCurrent(idx);
    setIsFlipped(false);
  };
  const prev = () => { if (current > 0) goTo(current - 1); };
  const next = () => { if (current < cards.length - 1) goTo(current + 1); };
  const flip = () => {
    if (!isFlipped) setStudied((s) => new Set(s).add(current));
    setIsFlipped((v) => !v);
  };

  useEffect(() => {
    setCurrent(0);
    setIsFlipped(false);
    setStudied(new Set());
    startTimeRef.current = Date.now();
  }, [body]);

  const allDone = cards.length > 0 && studied.size === cards.length;
  useEffect(() => {
    if (allDone) onComplete?.(cards.length, Math.round((Date.now() - startTimeRef.current) / 1000));
  }, [allDone]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cards.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [current, cards.length]);

  if (cards.length === 0 && body.trim()) {
    return <p style={{ color: "#aaa" }}>{t('flashcard.parse.error')}</p>;
  }
  if (cards.length === 0) return <p style={{ color: "#aaa" }}>{t('flashcard.empty')}</p>;

  const card = cards[current];
  const studiedCount = studied.size;

  return (
    <div>
      {/* Completion banner */}
      {allDone && (
        <div style={{
          background: "#e8f5e9", border: "1px solid #4caf50",
          borderRadius: 8, padding: "12px 20px", marginBottom: 16,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          fontSize: 14,
        }}>
          <span style={{ color: "#2e7d32", fontWeight: 600 }}>{t('flashcard.all.done')}</span>
          <button
            onClick={() => { setStudied(new Set()); goTo(0); }}
            style={{
              background: "none", border: "1px solid #4caf50", borderRadius: 5,
              color: "#2e7d32", cursor: "pointer", fontSize: 12, padding: "4px 10px",
            }}
          >
            {t('flashcard.restart')}
          </button>
        </div>
      )}

      {/* Progress */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: "#888" }}>{t('flashcard.progress', { current: current + 1, total: cards.length })}</span>
        <span style={{ fontSize: 12, color: studiedCount === cards.length ? "#43a047" : "#888" }}>
          {t('flashcard.studied', { count: studiedCount })}
        </span>
      </div>

      {/* Flip card */}
      <div
        role="button"
        tabIndex={0}
        aria-label={isFlipped
          ? t('flashcard.aria.back', { text: card.back })
          : t('flashcard.aria.front', { text: card.front })}
        onClick={flip}
        onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); flip(); } }}
        style={{ perspective: 1000, cursor: "pointer", minHeight: 200, userSelect: "none" }}
      >
        <div
          style={{
            position: "relative",
            width: "100%",
            minHeight: 200,
            transition: "transform 0.45s",
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
          }}
        >
          {/* Front */}
          <div style={cardFaceStyle(false)}>
            {card.front}
          </div>
          {/* Back */}
          <div style={cardFaceStyle(true)}>
            {card.back}
          </div>
        </div>
      </div>

      {/* Keyboard hint */}
      <p style={{ textAlign: "center", fontSize: 11, color: "#bbb", margin: "8px 0 0" }}>
        {t('flashcard.keyboard.hint')}
      </p>

      {/* Nav buttons */}
      <div style={{ display: "flex", justifyContent: "center", gap: 12, marginTop: 12 }}>
        <button onClick={prev} disabled={current === 0} style={navBtnStyle(current === 0)}>
          {t('flashcard.prev')}
        </button>
        <button onClick={flip} style={navBtnStyle(false)}>
          {isFlipped ? t('flashcard.show.question') : t('flashcard.show.answer')}
        </button>
        <button onClick={next} disabled={current === cards.length - 1} style={navBtnStyle(current === cards.length - 1)}>
          {t('flashcard.next')}
        </button>
      </div>

      {/* Dot navigator */}
      <div role="group" aria-label={t('flashcard.dots.aria')} style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 16, justifyContent: "center" }}>
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={studied.has(i)
              ? t('flashcard.dot.done.aria', { num: i + 1 })
              : t('flashcard.dot.aria', { num: i + 1 })}
            aria-current={i === current ? "true" : undefined}
            style={{
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: i === current ? "#6c63ff" : studied.has(i) ? "#43a047" : "#ddd",
              cursor: "pointer",
              transition: "background 0.2s",
              border: "none",
              padding: 0,
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function cardFaceStyle(isBack: boolean): React.CSSProperties {
  return {
    position: "absolute",
    width: "100%",
    minHeight: 200,
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    transform: isBack ? "rotateY(180deg)" : undefined,
    background: isBack ? "#6c63ff" : "#fff",
    border: `2px solid ${isBack ? "#6c63ff" : "#e0e0e0"}`,
    borderRadius: 12,
    padding: "48px 32px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
    lineHeight: 1.6,
    color: isBack ? "#fff" : "#222",
    boxSizing: "border-box",
    textAlign: "center",
  };
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
