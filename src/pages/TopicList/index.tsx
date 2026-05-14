import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTopic, deleteTopic, getTopics, type Topic } from "../../lib/api";
import { useTopicStore, useQueueStore } from "../../lib/store";
import LevelBadge from "../../components/LevelBadge";

export default function TopicList() {
  const { topics, setTopics, addTopic, removeTopic } = useTopicStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addLevel, setAddLevel] = useState(5);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    getTopics()
      .then(setTopics)
      .catch(() => setError("토픽 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [setTopics]);

  const handleAdd = async () => {
    if (!addTitle.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const topic = await createTopic(addTitle.trim(), addLevel);
      addTopic(topic);
      setAddTitle("");
    } catch {
      setError("토픽 추가에 실패했습니다.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTopic(id);
      removeTopic(id);
    } catch {
      setError("삭제에 실패했습니다.");
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 20px", color: "#222" }}>토픽 목록</h2>

      {/* Add form */}
      <div style={{
        background: "#fff",
        borderRadius: 8,
        padding: 16,
        marginBottom: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>
              학습할 토픽
            </label>
            <input
              value={addTitle}
              onChange={(e) => setAddTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAdd()}
              placeholder="예: Python 기초, 머신러닝 원리..."
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
                boxSizing: "border-box",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: "#666", display: "block", marginBottom: 4 }}>
              레벨 (1-10)
            </label>
            <input
              type="number"
              min={1}
              max={10}
              value={addLevel}
              onChange={(e) => setAddLevel(Number(e.target.value))}
              style={{
                width: 64,
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
              }}
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={adding || !addTitle.trim()}
            style={{
              padding: "8px 20px",
              background: adding ? "#aaa" : "#6c63ff",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: adding ? "not-allowed" : "pointer",
              fontSize: 14,
              height: 38,
            }}
          >
            {adding ? "추가 중..." : "+ 추가"}
          </button>
        </div>
        {error && <p style={{ color: "#e53935", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}
      </div>

      {/* List */}
      {loading ? (
        <p style={{ color: "#666", textAlign: "center" }}>불러오는 중...</p>
      ) : topics.length === 0 ? (
        <p style={{ color: "#999", textAlign: "center", padding: "40px 0" }}>
          아직 토픽이 없습니다. 위에서 추가해보세요!
        </p>
      ) : (
        <TopicListWithQueue
          topics={topics}
          onOpen={(id) => navigate(`/topics/${id}/studio`)}
          onDelete={handleDelete}
        />
      )}
    </div>
  );
}

function TopicListWithQueue({
  topics,
  onOpen,
  onDelete,
}: {
  topics: Topic[];
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const { activeItems } = useQueueStore();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {topics.map((topic) => {
        const activeCount = activeItems.filter((i) => i.topicId === topic.id).length;
        return (
          <TopicCard
            key={topic.id}
            topic={topic}
            activeCount={activeCount}
            onOpen={() => onOpen(topic.id)}
            onDelete={() => onDelete(topic.id)}
          />
        );
      })}
    </div>
  );
}

function TopicCard({
  topic,
  activeCount,
  onOpen,
  onDelete,
}: {
  topic: Topic;
  activeCount: number;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      style={{
        background: "#fff",
        borderRadius: 8,
        padding: "12px 16px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        display: "flex",
        alignItems: "center",
        gap: 12,
        cursor: "pointer",
      }}
      onClick={onOpen}
    >
      <div style={{ flex: 1 }}>
        <div style={{ fontWeight: 600, color: "#222", fontSize: 15 }}>{topic.title}</div>
        {topic.description && (
          <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{topic.description}</div>
        )}
      </div>
      {activeCount > 0 && (
        <span style={{
          fontSize: 11,
          color: "#f57c00",
          background: "#fff3e0",
          border: "1px solid #ffcc80",
          borderRadius: 10,
          padding: "2px 8px",
        }}>
          ⏳ 생성 중 {activeCount}
        </span>
      )}
      <LevelBadge level={topic.userLevel} />
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        style={{
          padding: "4px 10px",
          background: "transparent",
          border: "1px solid #ddd",
          borderRadius: 4,
          cursor: "pointer",
          color: "#e53935",
          fontSize: 12,
        }}
      >
        삭제
      </button>
    </div>
  );
}
