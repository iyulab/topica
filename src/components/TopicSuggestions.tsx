import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getSuggestedNextTopics, createTopic } from "../lib/api";

interface Props {
  topicId: string;
}

export default function TopicSuggestions({ topicId }: Props) {
  const navigate = useNavigate();
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    getSuggestedNextTopics(topicId)
      .then(setSuggestions)
      .catch(() => {});
  }, [topicId]);

  if (suggestions.length === 0) return null;

  async function handleStart(title: string) {
    try {
      const topic = await createTopic(title, 5);
      navigate(`/topics/${topic.id}/studio`);
    } catch {
      // 토픽 생성 실패 시 무시
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
        이 내용에서 언급된 토픽 — 이어서 배워볼까요?
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {suggestions.map((title) => (
          <button
            key={title}
            onClick={() => handleStart(title)}
            style={{
              padding: "5px 14px",
              background: "#fff",
              border: "1px solid #c5bfff",
              borderRadius: 20,
              fontSize: 13,
              color: "#6c63ff",
              cursor: "pointer",
              transition: "background 0.15s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = "#f0eeff")}
            onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
          >
            {title} →
          </button>
        ))}
      </div>
    </div>
  );
}
