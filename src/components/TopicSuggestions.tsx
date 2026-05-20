import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { getSuggestedNextTopics, createTopic } from "../lib/api";
import { useLearningQueueStore } from "../lib/store";

interface Props {
  topicId: string;
}

export default function TopicSuggestions({ topicId }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addItem, items: queueItems } = useLearningQueueStore();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loadingTitle, setLoadingTitle] = useState<string | null>(null);
  const [queuedTitles, setQueuedTitles] = useState<Set<string>>(new Set());

  useEffect(() => {
    getSuggestedNextTopics(topicId)
      .then(setSuggestions)
      .catch(() => {});
  }, [topicId]);

  if (suggestions.length === 0) return null;

  async function handleStart(title: string) {
    setLoadingTitle(title);
    setError(null);
    try {
      const topic = await createTopic(title, 5);
      navigate(`/topics/${topic.id}/studio`);
    } catch {
      setError(t('suggestions.error'));
    } finally {
      setLoadingTitle(null);
    }
  }

  async function handleEnqueue(title: string) {
    if (queuedTitles.has(title)) return;
    setLoadingTitle(`q:${title}`);
    setError(null);
    try {
      const inQueue = queueItems.find((i) => i.title === title);
      if (inQueue) {
        setQueuedTitles((s) => new Set(s).add(title));
        return;
      }
      const topic = await createTopic(title, 5);
      addItem({ topicId: topic.id, title: topic.title, addedAt: new Date().toISOString() });
      setQueuedTitles((s) => new Set(s).add(title));
    } catch {
      setError(t('suggestions.error'));
    } finally {
      setLoadingTitle(null);
    }
  }

  return (
    <div style={{
      marginTop: 24,
      padding: "16px 18px",
      background: "#f8f7ff",
      borderRadius: 10,
      border: "1px solid #e0dcff",
    }}>
      <p style={{ margin: "0 0 10px", fontSize: 13, color: "#6c63ff", fontWeight: 600 }}>
        {t('suggestions.next.title')}
      </p>
      {error && (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#d00" }}>{error}</p>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {suggestions.map((title) => {
          const busy = loadingTitle !== null;
          const queued = queuedTitles.has(title);
          return (
            <div key={title} style={{ display: "flex", gap: 4 }}>
              <button
                onClick={() => handleStart(title)}
                disabled={busy}
                style={{
                  padding: "5px 14px",
                  background: "#fff",
                  border: "1px solid #c5bfff",
                  borderRadius: "20px 0 0 20px",
                  fontSize: 13,
                  color: "#6c63ff",
                  cursor: busy ? "default" : "pointer",
                }}
              >
                {loadingTitle === title ? "..." : `${title} →`}
              </button>
              <button
                onClick={() => handleEnqueue(title)}
                disabled={busy || queued}
                title={queued ? t('topic.queue.in') : t('topic.queue.add')}
                style={{
                  padding: "5px 10px",
                  background: queued ? "#e8f5e9" : "#fff",
                  border: `1px solid ${queued ? "#28a745" : "#c5bfff"}`,
                  borderLeft: "none",
                  borderRadius: "0 20px 20px 0",
                  fontSize: 13,
                  color: queued ? "#28a745" : "#6c63ff",
                  cursor: busy || queued ? "default" : "pointer",
                }}
              >
                {loadingTitle === `q:${title}` ? "..." : queued ? "✓" : "📋"}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
