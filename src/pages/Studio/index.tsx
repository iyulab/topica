import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { generateContent, getContents, getLevelRecommendation, getRelatedTopics, getTags, getTopics, postLearningSession, streamContent, type Content, type LevelRecommendation, type RelatedTopic, type Topic } from "../../lib/api";
import { topicaWs, type WsMessage } from "../../lib/ws";
import { useQueueStore } from "../../lib/store";
import LevelBadge from "../../components/LevelBadge";
import MarkdownRenderer from "../../components/MarkdownRenderer";
import FlashcardViewer from "../../components/FlashcardViewer";
import MindmapViewer from "../../components/MindmapViewer";
import QuizViewer from "../../components/QuizViewer";
import ChatPanel from "../../components/ChatPanel";
import SurveyModal from "../../components/SurveyModal";
import { CardSkeleton, ContentSkeleton, QuizSkeleton } from "../../components/SkeletonLoader";
import TopicSuggestions from "../../components/TopicSuggestions";

export default function Studio() {
  const { t } = useTranslation();
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
  const [streamingText, setStreamingText] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const generationRef = useRef(0);
  const [showPrevious, setShowPrevious] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [relatedTopics, setRelatedTopics] = useState<RelatedTopic[]>([]);
  const [allTopics, setAllTopics] = useState<{ id: string; title: string }[]>([]);
  const [recommendation, setRecommendation] = useState<LevelRecommendation | null>(null);
  const { activeItems, failedItems } = useQueueStore();
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
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

  useEffect(() => {
    if (!topicId) return;
    const off = topicaWs.on((msg: WsMessage) => {
      if (msg.type === "content_ready" && msg.topicId === topicId) {
        getContents(topicId).then(setContents);
        if ((msg.contentType as string) === "Summary") {
          getTags(topicId).then(setTags).catch(() => {});
          getRelatedTopics(topicId).then(setRelatedTopics).catch(() => {});
        }
      }
    });
    return off;
  }, [topicId]);

  useEffect(() => () => { streamAbortRef.current?.abort(); }, []);

  const topicIndex = useMemo(
    () => Object.fromEntries(allTopics.map((t) => [t.title, t.id])),
    [allTopics]
  );

  const handleRegenerate = async (tabIndex: number) => {
    if (!topicId || !topic) return;
    streamAbortRef.current?.abort();
    streamAbortRef.current = null;
    const myGen = ++generationRef.current;
    setRegenerating(tabIndex);
    setStreamingText(null);
    setShowPrevious(false);
    if (tabIndex === 0 || tabIndex === 1 || tabIndex === 2 || tabIndex === 3) {
      const abort = new AbortController();
      streamAbortRef.current = abort;
      const isJsonType = tabIndex === 2 || tabIndex === 3;
      if (isJsonType) setStreamingText("");
      try {
        for await (const chunk of streamContent(topicId, tabIndex, topic.userLevel, abort.signal)) {
          if (chunk.done && chunk.content) {
            setContents((cs) => [...cs.filter((c) => c.type !== tabIndex), chunk.content!]);
            setStreamingText(null);
          } else if (chunk.delta && !isJsonType) {
            setStreamingText((prev) => (prev ?? "") + chunk.delta);
          }
        }
      } finally {
        if (generationRef.current === myGen) {
          setRegenerating(null);
          setStreamingText(null);
          streamAbortRef.current = null;
        }
      }
    } else {
      try {
        const updated = await generateContent(topicId, tabIndex, topic.userLevel);
        setContents((cs) => [...cs.filter((c) => c.type !== tabIndex), updated]);
      } finally {
        if (generationRef.current === myGen) {
          setRegenerating(null);
        }
      }
    }
  };

  if (loading) return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <ContentSkeleton />
    </div>
  );
  if (!topic) return (
    <div style={{ padding: 24 }}>
      <p>{t('studio.notfound')}</p>
      <button onClick={() => navigate("/")}>{t('studio.back')}</button>
    </div>
  );

  const summary = contents.find((c) => c.type === 0);
  const lecture = contents.find((c) => c.type === 1);
  const flashcard = contents.find((c) => c.type === 2);
  const quiz = contents.find((c) => c.type === 3);
  const mindmap = contents.find((c) => c.type === 4);

  const tabs = [
    { label: t('studio.tab.summary'), content: summary, isGenerating: topicActiveItems.some((i) => i.contentType === "Summary"), isFailed: topicFailedItems.find((f) => f.contentType === "Summary"), renderer: "markdown" },
    { label: t('studio.tab.lecture'), content: lecture, isGenerating: topicActiveItems.some((i) => i.contentType === "Lecture"), isFailed: topicFailedItems.find((f) => f.contentType === "Lecture"), renderer: "markdown" },
    { label: t('studio.tab.flashcard'), content: flashcard, isGenerating: topicActiveItems.some((i) => i.contentType === "Flashcard"), isFailed: topicFailedItems.find((f) => f.contentType === "Flashcard"), renderer: "flashcard" },
    { label: t('studio.tab.quiz'), content: quiz, isGenerating: topicActiveItems.some((i) => i.contentType === "Quiz"), isFailed: topicFailedItems.find((f) => f.contentType === "Quiz"), renderer: "quiz" },
    { label: t('studio.tab.mindmap'), content: mindmap, isGenerating: topicActiveItems.some((i) => i.contentType === "Mindmap"), isFailed: topicFailedItems.find((f) => f.contentType === "Mindmap"), renderer: "mindmap" },
    { label: "💬", content: null, isGenerating: false, isFailed: undefined, renderer: "chat" },
  ];

  const contentLabels = [
    t('studio.tab.summary'),
    t('studio.tab.lecture'),
    t('studio.tab.flashcard'),
    t('studio.tab.quiz'),
    t('studio.tab.mindmap'),
  ];

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <button
        onClick={() => navigate("/")}
        style={{ background: "none", border: "none", color: "#6c63ff", cursor: "pointer", marginBottom: 8, fontSize: 13 }}
      >
        {t('studio.back')}
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
            {t('studio.level.recommend', { level: recommendation.recommendedLevel })}
          </span>
        )}
        <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
          <button
            onClick={() => exportTopicMarkdown(topic, contents, tags, contentLabels)}
            style={{
              padding: "4px 12px", border: "1px solid #ddd",
              borderRadius: 6, background: "none", color: "#666",
              cursor: "pointer", fontSize: 12,
            }}
            title={t('studio.export.title')}
          >
            {t('studio.export')}
          </button>
          <button
            onClick={() => setShowSurvey(true)}
            style={{
              padding: "4px 12px", border: "1px solid #6c63ff",
              borderRadius: 6, background: "none", color: "#6c63ff",
              cursor: "pointer", fontSize: 12,
            }}
          >
            🎯 {t('studio.survey')}
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
      <div
        role="tablist"
        aria-label={t('studio.tabs.label')}
        onKeyDown={(e) => {
          const count = tabs.length;
          let next = activeTab;
          if (e.key === "ArrowRight") next = (activeTab + 1) % count;
          else if (e.key === "ArrowLeft") next = (activeTab - 1 + count) % count;
          else if (e.key === "Home") next = 0;
          else if (e.key === "End") next = count - 1;
          else return;
          e.preventDefault();
          setActiveTab(next);
          setShowPrevious(false);
          tabRefs.current[next]?.focus();
        }}
        style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "1px solid #ddd", alignItems: "flex-end" }}
      >
        {tabs.map((tab, i) => (
          <button
            key={i}
            ref={(el) => { tabRefs.current[i] = el; }}
            role="tab"
            id={`tab-${i}`}
            aria-selected={activeTab === i}
            aria-controls="tabpanel"
            tabIndex={activeTab === i ? 0 : -1}
            onClick={() => { setActiveTab(i); setShowPrevious(false); window.scrollTo({ top: 0, behavior: "smooth" }); }}
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
            <span aria-hidden="true">
              {tab.renderer === "chat" ? "" : tab.isGenerating ? "⏳" : tab.isFailed ? "⚠️" : tab.content ? "✓" : "—"}
            </span>
          </button>
        ))}
        {tabs[activeTab].renderer !== "chat" && topicId && (
          <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
            {tabs[activeTab].content?.previousBody && regenerating !== activeTab && (
              <button
                onClick={() => setShowPrevious((v) => !v)}
                style={{
                  padding: "4px 10px", border: "1px solid #ddd",
                  borderRadius: 6, background: showPrevious ? "#f0eeff" : "none",
                  color: showPrevious ? "#6c63ff" : "#888", cursor: "pointer", fontSize: 12,
                }}
              >
                {showPrevious ? t('studio.current') : t('studio.previous')}
              </button>
            )}
            <button
              onClick={() => handleRegenerate(activeTab)}
              disabled={regenerating === activeTab || tabs[activeTab].isGenerating}
              style={{
                padding: "4px 10px", border: "1px solid #ddd",
                borderRadius: 6, background: "none",
                color: "#888", cursor: regenerating === activeTab ? "not-allowed" : "pointer", fontSize: 12,
              }}
            >
              {regenerating === activeTab ? "⏳" : "🔄"} {t('studio.regenerate')}
            </button>
          </div>
        )}
      </div>

      {/* Content area */}
      <div id="tabpanel" role="tabpanel" aria-labelledby={`tab-${activeTab}`}>
      {tabs[activeTab].renderer === "chat" ? (
        <div style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          {topicId && <ChatPanel topicId={topicId} />}
        </div>
      ) : regenerating === activeTab && streamingText !== null ? (
        <div style={{ background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div style={{ color: "#6c63ff", fontSize: 12, marginBottom: 12 }}>{t('studio.streaming')}</div>
          {tabs[activeTab].renderer === "flashcard" ? (
            <CardSkeleton />
          ) : tabs[activeTab].renderer === "quiz" ? (
            <QuizSkeleton />
          ) : (
            <MarkdownRenderer content={streamingText} topicIndex={topicIndex} />
          )}
        </div>
      ) : tabs[activeTab].content ? (
        <div style={{
          background: "#fff",
          borderRadius: 8,
          padding: 20,
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
        }}>
          {tabs[activeTab].renderer === "flashcard" && (
            <>
              {showPrevious && tabs[activeTab].content!.previousBody && (
                <div style={{ marginBottom: 8, padding: "4px 10px", background: "#fff9e6", border: "1px solid #ffe58f", borderRadius: 6, fontSize: 12, color: "#7d5c00" }}>
                  {t('studio.previous.label')} — {t('studio.tab.flashcard')}
                </div>
              )}
              <FlashcardViewer
                body={showPrevious && tabs[activeTab].content!.previousBody ? tabs[activeTab].content!.previousBody! : tabs[activeTab].content!.body}
                onComplete={(count, duration) => {
                  if (topicId) postLearningSession(topicId, duration, null, count).catch(() => {});
                }}
              />
            </>
          )}
          {tabs[activeTab].renderer === "quiz" && (
            <>
              {showPrevious && tabs[activeTab].content!.previousBody && (
                <div style={{ marginBottom: 8, padding: "4px 10px", background: "#fff9e6", border: "1px solid #ffe58f", borderRadius: 6, fontSize: 12, color: "#7d5c00" }}>
                  {t('studio.previous.label')} — {t('studio.tab.quiz')}
                </div>
              )}
              <QuizViewer
                body={showPrevious && tabs[activeTab].content!.previousBody ? tabs[activeTab].content!.previousBody! : tabs[activeTab].content!.body}
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
            </>
          )}
          {tabs[activeTab].renderer === "mindmap" && (
            <MindmapViewer body={showPrevious && tabs[activeTab].content!.previousBody ? tabs[activeTab].content!.previousBody! : tabs[activeTab].content!.body} />
          )}
          {tabs[activeTab].renderer === "markdown" && (
            <>
              {showPrevious && tabs[activeTab].content!.previousBody && (
                <div style={{ marginBottom: 8, padding: "4px 10px", background: "#fff9e6", border: "1px solid #ffe58f", borderRadius: 6, fontSize: 12, color: "#7d5c00" }}>
                  {t('studio.previous.label')}
                </div>
              )}
              <MarkdownRenderer
                content={showPrevious && tabs[activeTab].content!.previousBody ? tabs[activeTab].content!.previousBody! : tabs[activeTab].content!.body}
                topicIndex={topicIndex}
              />
            </>
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
                  {t('studio.nolinks')}
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
              <div style={{ color: "#6c63ff", fontSize: 13, marginBottom: 12 }}>{t('studio.streaming')}</div>
              <ContentSkeleton />
            </div>
          ) : tabs[activeTab].isFailed ? (
            <div>
              <div style={{ color: "#d00", marginBottom: 8 }}>{t('studio.failed')}</div>
              <div style={{ fontSize: 12, color: "#888", marginBottom: 16 }}>{tabs[activeTab].isFailed!.errorMessage}</div>
              <button
                onClick={() => handleRegenerate(activeTab)}
                disabled={regenerating === activeTab}
                style={{
                  padding: "6px 16px", background: "#fff3f3", border: "1px solid #d00",
                  borderRadius: 6, color: "#d00", cursor: "pointer", fontSize: 13,
                }}
              >
                {regenerating === activeTab ? "⏳" : "⚠️"} {t('studio.retry')}
              </button>
            </div>
          ) : (
            t('studio.empty')
          )}
        </div>
      )}
      </div>

      {relatedTopics.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h4 style={{ margin: "0 0 12px", fontSize: 13, color: "#888", fontWeight: 600 }}>{t('studio.related')}</h4>
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

function exportTopicMarkdown(
  topic: { title: string; description: string; userLevel: number },
  contents: { type: number; body: string }[],
  tags: string[],
  labels: string[],
) {
  const lines: string[] = [`# ${topic.title}`, ""];
  if (topic.description) lines.push(`> ${topic.description}`, "");
  lines.push(`**Lv.** ${topic.userLevel}/10`);
  if (tags.length > 0) lines.push(`**Tags:** ${tags.join(", ")}`);
  lines.push("", "---", "");

  for (const c of contents) {
    const label = labels[c.type] ?? `Content ${c.type}`;
    lines.push(`## ${label}`, "");
    if (c.type === 2 || c.type === 3) {
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
