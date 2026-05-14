import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getContents, getTopics, type Content, type Topic } from "../../lib/api";
import { topicaWs, type WsMessage } from "../../lib/ws";
import { useQueueStore } from "../../lib/store";
import LevelBadge from "../../components/LevelBadge";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import FlashcardViewer from "../../components/FlashcardViewer";
import QuizViewer from "../../components/QuizViewer";
import ChatPanel from "../../components/ChatPanel";

export default function Studio() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const contentsRef = useRef(contents);
  contentsRef.current = contents;
  const { activeItems } = useQueueStore();
  const topicActiveItems = activeItems.filter((i) => i.topicId === topicId);

  useEffect(() => {
    if (!topicId) return;
    Promise.all([
      getTopics().then((ts) => ts.find((t) => t.id === topicId) ?? null),
      getContents(topicId),
    ])
      .then(([t, cs]) => {
        setTopic(t);
        setContents(cs);
      })
      .finally(() => setLoading(false));
  }, [topicId]);

  // Refresh contents on WS content_ready for this topic
  useEffect(() => {
    if (!topicId) return;
    const off = topicaWs.on((msg: WsMessage) => {
      if (msg.type === "content_ready" && msg.topicId === topicId) {
        getContents(topicId).then(setContents);
      }
    });
    return off;
  }, [topicId]);

  if (loading) return <div style={{ padding: 24 }}>불러오는 중...</div>;
  if (!topic) return (
    <div style={{ padding: 24 }}>
      <p>토픽을 찾을 수 없습니다.</p>
      <button onClick={() => navigate("/")}>목록으로</button>
    </div>
  );

  const summary = contents.find((c) => c.type === 0);
  const lecture = contents.find((c) => c.type === 1);
  const flashcard = contents.find((c) => c.type === 2);
  const quiz = contents.find((c) => c.type === 3);
  const mindmap = contents.find((c) => c.type === 4);

  const tabs = [
    { label: "요약", content: summary, isGenerating: topicActiveItems.some((i) => i.contentType === "Summary"), renderer: "markdown" },
    { label: "강해", content: lecture, isGenerating: topicActiveItems.some((i) => i.contentType === "Lecture"), renderer: "markdown" },
    { label: "플래시카드", content: flashcard, isGenerating: topicActiveItems.some((i) => i.contentType === "Flashcard"), renderer: "flashcard" },
    { label: "퀴즈", content: quiz, isGenerating: topicActiveItems.some((i) => i.contentType === "Quiz"), renderer: "quiz" },
    { label: "마인드맵", content: mindmap, isGenerating: topicActiveItems.some((i) => i.contentType === "Mindmap"), renderer: "markdown" },
    { label: "채팅", content: null, isGenerating: false, renderer: "chat" },
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <button
        onClick={() => navigate("/")}
        style={{ background: "none", border: "none", color: "#6c63ff", cursor: "pointer", marginBottom: 8, fontSize: 13 }}
      >
        ← 목록으로
      </button>

      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 4 }}>
        <h2 style={{ margin: 0, color: "#222" }}>{topic.title}</h2>
        <LevelBadge level={topic.userLevel} />
      </div>
      {topic.description && (
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "#888" }}>{topic.description}</p>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #ddd" }}>
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveTab(i)}
            style={{
              padding: "8px 16px",
              border: "none",
              background: "none",
              cursor: "pointer",
              borderBottom: activeTab === i ? "2px solid #6c63ff" : "2px solid transparent",
              color: activeTab === i ? "#6c63ff" : "#666",
              fontWeight: activeTab === i ? 600 : 400,
              fontSize: 14,
            }}
          >
            {tab.label}{" "}
            {tab.renderer === "chat" ? "💬" : tab.isGenerating ? "⏳" : tab.content ? "✓" : "—"}
          </button>
        ))}
      </div>

      {/* Content area */}
      {tabs[activeTab].renderer === "chat" ? (
        <div style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          {topicId && <ChatPanel topicId={topicId} />}
        </div>
      ) : tabs[activeTab].content ? (
        <div style={{
          background: "#fff",
          borderRadius: 8,
          padding: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}>
          {tabs[activeTab].renderer === "flashcard" && (
            <FlashcardViewer body={tabs[activeTab].content!.body} />
          )}
          {tabs[activeTab].renderer === "quiz" && (
            <QuizViewer body={tabs[activeTab].content!.body} />
          )}
          {tabs[activeTab].renderer === "markdown" && (
            <MarkdownRenderer content={tabs[activeTab].content!.body} />
          )}
        </div>
      ) : (
        <div style={{
          background: "#fff",
          borderRadius: 8,
          padding: 40,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          textAlign: "center",
          color: "#aaa",
          fontSize: 14,
        }}>
          {tabs[activeTab].isGenerating
            ? "⏳ 생성 중... (완료 시 자동 업데이트됩니다)"
            : "아직 생성되지 않았습니다."}
        </div>
      )}
    </div>
  );
}
