import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { generateContent, getContents, getLevelRecommendation, getRelatedTopics, getTags, getTopics, postLearningSession, type Content, type LevelRecommendation, type RelatedTopic, type Topic } from "../../lib/api";
import { topicaWs, type WsMessage } from "../../lib/ws";
import { useQueueStore } from "../../lib/store";
import LevelBadge from "../../components/LevelBadge";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import FlashcardViewer from "../../components/FlashcardViewer";
import MindmapViewer from "../../components/MindmapViewer";
import QuizViewer from "../../components/QuizViewer";
import ChatPanel from "../../components/ChatPanel";
import SurveyModal from "../../components/SurveyModal";
import { ContentSkeleton } from "../../components/SkeletonLoader";
import TopicSuggestions from "../../components/TopicSuggestions";

export default function Studio() {
  const { topicId } = useParams<{ topicId: string }>();
  const navigate = useNavigate();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [contents, setContents] = useState<Content[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);
  const contentsRef = useRef(contents);
  contentsRef.current = contents;
  const [showSurvey, setShowSurvey] = useState(false);
  const [regenerating, setRegenerating] = useState<number | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [relatedTopics, setRelatedTopics] = useState<RelatedTopic[]>([]);
  const [allTopics, setAllTopics] = useState<{ id: string; title: string }[]>([]);
  const [recommendation, setRecommendation] = useState<LevelRecommendation | null>(null);
  const { activeItems, failedItems } = useQueueStore();
  const topicActiveItems = activeItems.filter((i) => i.topicId === topicId);
  const topicFailedItems = failedItems.filter((f) => f.topicId === topicId);

  useEffect(() => {
    if (!topicId) return;
    Promise.all([
      getTopics().then((ts) => {
        setAllTopics(ts.map((t) => ({ id: t.id, title: t.title })));
        return ts.find((t) => t.id === topicId) ?? null;
      }),
      getContents(topicId),
      getTags(topicId).catch(() => [] as string[]),
      getRelatedTopics(topicId).catch(() => [] as RelatedTopic[]),
      getLevelRecommendation(topicId).catch(() => null),
    ])
      .then(([t, cs, tgs, rel, rec]) => {
        setTopic(t);
        setContents(cs);
        setTags(tgs);
        setRelatedTopics(rel);
        setRecommendation(rec);
      })
      .finally(() => setLoading(false));
  }, [topicId]);

  // Refresh on WS content_ready for this topic
  useEffect(() => {
    if (!topicId) return;
    const off = topicaWs.on((msg: WsMessage) => {
      if (msg.type === "content_ready" && msg.topicId === topicId) {
        getContents(topicId).then(setContents);
        // If Summary ready, tags/related may now exist
        if ((msg.contentType as string) === "Summary") {
          getTags(topicId).then(setTags).catch(() => {});
          getRelatedTopics(topicId).then(setRelatedTopics).catch(() => {});
        }
      }
    });
    return off;
  }, [topicId]);

  const topicIndex = useMemo(
    () => Object.fromEntries(allTopics.map((t) => [t.title, t.id])),
    [allTopics]
  );

  if (loading) return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <ContentSkeleton />
    </div>
  );
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
    { label: "요약", content: summary, isGenerating: topicActiveItems.some((i) => i.contentType === "Summary"), isFailed: topicFailedItems.find((f) => f.contentType === "Summary"), renderer: "markdown" },
    { label: "강의", content: lecture, isGenerating: topicActiveItems.some((i) => i.contentType === "Lecture"), isFailed: topicFailedItems.find((f) => f.contentType === "Lecture"), renderer: "markdown" },
    { label: "플래시카드", content: flashcard, isGenerating: topicActiveItems.some((i) => i.contentType === "Flashcard"), isFailed: topicFailedItems.find((f) => f.contentType === "Flashcard"), renderer: "flashcard" },
    { label: "퀴즈", content: quiz, isGenerating: topicActiveItems.some((i) => i.contentType === "Quiz"), isFailed: topicFailedItems.find((f) => f.contentType === "Quiz"), renderer: "quiz" },
    { label: "마인드맵", content: mindmap, isGenerating: topicActiveItems.some((i) => i.contentType === "Mindmap"), isFailed: topicFailedItems.find((f) => f.contentType === "Mindmap"), renderer: "mindmap" },
    { label: "채팅", content: null, isGenerating: false, isFailed: undefined, renderer: "chat" },
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
        {recommendation?.hasHistory && recommendation.recommendedLevel !== topic.userLevel && (
          <span
            title={recommendation.reason}
            style={{
              padding: "2px 8px", background: "#fff9e6", border: "1px solid #f0c040",
              borderRadius: 10, fontSize: 11, color: "#b07800", cursor: "help",
            }}
          >
            📊 추천 Lv. {recommendation.recommendedLevel}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            onClick={() => exportTopicMarkdown(topic, contents, tags)}
            style={{
              padding: "4px 12px", border: "1px solid #ddd",
              borderRadius: 6, background: "none", color: "#666",
              cursor: "pointer", fontSize: 12,
            }}
            title="Markdown 파일로 내보내기"
          >
            ↓ 내보내기
          </button>
          <button
            onClick={() => setShowSurvey(true)}
            style={{
              padding: "4px 12px", border: "1px solid #6c63ff",
              borderRadius: 6, background: "none", color: "#6c63ff",
              cursor: "pointer", fontSize: 12,
            }}
          >
            🎯 학습 목표 설문
          </button>
        </div>
      </div>

      {showSurvey && topicId && (
        <SurveyModal topicId={topicId} onClose={() => setShowSurvey(false)} />
      )}
      {recommendation && !recommendation.hasHistory && (
        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#aaa" }}>
          💡 {recommendation.reason}
        </p>
      )}
      {topic.description && (
        <p style={{ margin: "0 0 8px", fontSize: 13, color: "#888" }}>{topic.description}</p>
      )}
      {tags.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {tags.map((tag) => (
            <span key={tag} style={{
              padding: "2px 10px", background: "#f0eeff", border: "1px solid #d0c8ff",
              borderRadius: 12, fontSize: 12, color: "#6c63ff",
            }}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #ddd", alignItems: "flex-end" }}>
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
            {tab.renderer === "chat" ? "💬" : tab.isGenerating ? "⏳" : tab.isFailed ? "⚠️" : tab.content ? "✓" : "—"}
          </button>
        ))}
        {tabs[activeTab].renderer !== "chat" && topicId && (
          <button
            onClick={async () => {
              setRegenerating(activeTab);
              try {
                const updated = await generateContent(topicId, activeTab, topic!.userLevel);
                setContents((cs) => {
                  const filtered = cs.filter((c) => c.type !== activeTab);
                  return [...filtered, updated];
                });
              } finally {
                setRegenerating(null);
              }
            }}
            disabled={regenerating === activeTab || tabs[activeTab].isGenerating}
            style={{
              marginLeft: "auto",
              padding: "4px 10px",
              border: "1px solid #ddd",
              borderRadius: 6,
              background: "none",
              color: "#888",
              cursor: regenerating === activeTab ? "not-allowed" : "pointer",
              fontSize: 12,
            }}
          >
            {regenerating === activeTab ? "⏳" : "🔄"} 재생성
          </button>
        )}
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
            <FlashcardViewer
              body={tabs[activeTab].content!.body}
              onComplete={(count, duration) => {
                if (topicId) postLearningSession(topicId, duration, null, count).catch(() => {});
              }}
            />
          )}
          {tabs[activeTab].renderer === "quiz" && (
            <QuizViewer
              body={tabs[activeTab].content!.body}
              topicId={topicId}
              contentId={tabs[activeTab].content!.id}
              onLevelChange={(newLevel) => {
                setTopic((t) => t ? { ...t, userLevel: newLevel } : t);
                if (topicId) getLevelRecommendation(topicId).then(setRecommendation).catch(() => {});
              }}
              onComplete={(score, total, duration) => {
                if (topicId) {
                  const pct = Math.round((score / total) * 100);
                  postLearningSession(topicId, duration, pct, 0).catch(() => {});
                }
              }}
            />
          )}
          {tabs[activeTab].renderer === "mindmap" && (
            <MindmapViewer body={tabs[activeTab].content!.body} />
          )}
          {tabs[activeTab].renderer === "markdown" && (
            <MarkdownRenderer content={tabs[activeTab].content!.body} topicIndex={topicIndex} />
          )}
          {tabs[activeTab].renderer === "markdown" && (activeTab === 0 || activeTab === 1) && topicId && (
            <>
              {!tabs[activeTab].content!.body.includes("[[") && allTopics.length > 1 && (
                <div style={{
                  marginTop: 16,
                  padding: "10px 14px",
                  background: "#fffbe6",
                  border: "1px solid #ffe58f",
                  borderRadius: 8,
                  fontSize: 12,
                  color: "#7d5c00",
                }}>
                  💡 이 콘텐츠는 다른 토픽과의 연결 정보가 없습니다. 🔄 재생성하면 관련 토픽 링크가 추가됩니다.
                </div>
              )}
              <TopicSuggestions topicId={topicId} />
            </>
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
          {tabs[activeTab].isGenerating ? (
            <div style={{ textAlign: "left" }}>
              <div style={{ color: "#6c63ff", fontSize: 13, marginBottom: 12 }}>✦ AI가 콘텐츠를 생성하고 있습니다...</div>
              <ContentSkeleton />
            </div>
          ) : tabs[activeTab].isFailed ? (
            <div>
              <div style={{ color: "#d00", marginBottom: 8 }}>❌ 생성 실패</div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>{tabs[activeTab].isFailed!.errorMessage}</div>
              <button
                onClick={async () => {
                  if (!topicId) return;
                  setRegenerating(activeTab);
                  try {
                    const updated = await generateContent(topicId, activeTab, topic!.userLevel);
                    setContents((cs) => {
                      const filtered = cs.filter((c) => c.type !== activeTab);
                      return [...filtered, updated];
                    });
                  } finally {
                    setRegenerating(null);
                  }
                }}
                disabled={regenerating === activeTab}
                style={{
                  padding: "6px 16px", background: "#fff3f3", border: "1px solid #d00",
                  borderRadius: 6, color: "#d00", cursor: "pointer", fontSize: 13,
                }}
              >
                {regenerating === activeTab ? "⏳" : "⚠️"} 재시도
              </button>
            </div>
          ) : (
            "아직 생성되지 않았습니다."
          )}
        </div>
      )}

      {relatedTopics.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 13, color: "#888", fontWeight: 600 }}>관련 토픽</h4>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {relatedTopics.map((rel) => (
              <button
                key={rel.id}
                onClick={() => navigate(`/topics/${rel.id}/studio`)}
                style={{
                  padding: "6px 14px", background: "#fff", border: "1px solid #ddd",
                  borderRadius: 20, cursor: "pointer", fontSize: 13, color: "#333",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                {rel.topic.title}
                <span style={{ fontSize: 11, color: "#aaa" }}>{Math.round(rel.score * 100)}%</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const CONTENT_LABELS = ["요약", "강의", "플래시카드", "퀴즈", "마인드맵"];

function exportTopicMarkdown(topic: { title: string; description: string; userLevel: number }, contents: { type: number; body: string }[], tags: string[]) {
  const lines: string[] = [
    `# ${topic.title}`,
    "",
  ];
  if (topic.description) lines.push(`> ${topic.description}`, "");
  lines.push(`**레벨:** ${topic.userLevel}/10`);
  if (tags.length > 0) lines.push(`**태그:** ${tags.join(", ")}`);
  lines.push("", "---", "");

  for (const c of contents) {
    const label = CONTENT_LABELS[c.type] ?? `콘텐츠 ${c.type}`;
    lines.push(`## ${label}`, "");
    if (c.type === 2 || c.type === 3) {
      // Flashcard / Quiz: try pretty-print JSON
      try {
        const parsed = JSON.parse(c.body);
        lines.push("```json", JSON.stringify(parsed, null, 2), "```");
      } catch {
        lines.push(c.body);
      }
    } else {
      lines.push(c.body);
    }
    lines.push("", "---", "");
  }

  const markdown = lines.join("\n");
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${topic.title.replace(/[^\w가-힣\s]/g, "_")}.md`;
  a.click();
  URL.revokeObjectURL(url);
}
