import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTopic, deleteTopic, getTopics, getReviewSuggestions, type Topic, type TopicSearchParams } from "../../lib/api";
import { useTopicStore, useQueueStore } from "../../lib/store";
import LevelBadge from "../../components/LevelBadge";
import { TopicListSkeleton } from "../../components/SkeletonLoader";

type SortOption = "updated_desc" | "updated_asc" | "title_asc" | "created_desc";

export default function TopicList() {
  const { topics, setTopics, addTopic, removeTopic } = useTopicStore();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [addTitle, setAddTitle] = useState("");
  const [addLevel, setAddLevel] = useState(5);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadKey, setLoadKey] = useState(0);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortOption>("updated_desc");
  const [reviewIds, setReviewIds] = useState<Set<string>>(new Set());
  const [tagPool, setTagPool] = useState<string[]>([]);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    setLoadError(null);
    setLoading(true);
    const params: TopicSearchParams = {};
    if (debouncedQuery) params.q = debouncedQuery;
    if (activeTags.length) params.tags = activeTags;
    if (sort !== "updated_desc") params.sort = sort;
    getTopics(params)
      .then((result) => {
        setTopics(result);
        // 필터 없는 전체 로드일 때만 태그 풀 갱신
        if (!debouncedQuery && !activeTags.length) {
          const tags = Array.from(new Set(result.flatMap((t) => t.tags ?? []))).sort();
          setTagPool(tags);
        }
      })
      .catch(() => setLoadError("토픽 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, [setTopics, loadKey, debouncedQuery, activeTags, sort]);

  useEffect(() => {
    getReviewSuggestions()
      .then((list) => setReviewIds(new Set(list.map((r) => r.id))))
      .catch(() => {});
  }, []);

  const handleAdd = async () => {
    if (!addTitle.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const topic = await createTopic(addTitle.trim(), addLevel);
      addTopic(topic);
      setAddTitle("");
      setLoadKey((k) => k + 1);
    } catch {
      setError("토픽 추가에 실패했습니다.");
    } finally {
      setAdding(false);
    }
  };

  const isLevelInvalid = showAdvanced && (addLevel < 1 || addLevel > 10);

  // tagPool is populated on unfiltered loads so tag buttons stay visible during search
  const allTags = tagPool;

  const toggleTag = (tag: string) => {
    setActiveTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const hasFilter = debouncedQuery || activeTags.length > 0 || sort !== "updated_desc";

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`"${title}" 토픽을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.`)) return;
    try {
      await deleteTopic(id);
      removeTopic(id);
    } catch {
      setError("삭제에 실패했습니다.");
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 720, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 8px", color: "#222" }}>무엇을 배울까요?</h2>
      <p style={{ margin: "0 0 20px", color: "#888", fontSize: 14 }}>주제를 입력하면 AI가 요약·강의·퀴즈·마인드맵을 만들어드립니다.</p>

      {/* Add form */}
      <div style={{
        background: "#fff",
        borderRadius: 8,
        padding: 16,
        marginBottom: 20,
        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
      }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input
            value={addTitle}
            onChange={(e) => setAddTitle(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder="학습할 주제를 입력하세요  예: Python 기초, 머신러닝 원리..."
            aria-label="학습할 주제"
            style={{
              flex: 1,
              padding: "10px 14px",
              border: "1px solid #ddd",
              borderRadius: 6,
              fontSize: 14,
              boxSizing: "border-box",
            }}
          />
          <button
            onClick={handleAdd}
            disabled={adding || !addTitle.trim() || isLevelInvalid}
            style={{
              padding: "10px 20px",
              background: (adding || !addTitle.trim() || isLevelInvalid) ? "#aaa" : "#6c63ff",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: (adding || !addTitle.trim() || isLevelInvalid) ? "not-allowed" : "pointer",
              fontSize: 14,
              whiteSpace: "nowrap",
            }}
          >
            {adding ? "추가 중..." : "시작하기"}
          </button>
        </div>
        <div style={{ marginTop: 8 }}>
          <button
            type="button"
            aria-expanded={showAdvanced}
            onClick={() => setShowAdvanced((v) => !v)}
            style={{ background: "none", border: "none", color: "#6c63ff", fontSize: 12, cursor: "pointer", padding: 0 }}
          >
            {showAdvanced ? "▲ 고급 옵션" : "▼ 고급 옵션"}
          </button>
          {showAdvanced && (
            <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <label htmlFor="level-input" style={{ fontSize: 12, color: "#666" }}>학습 레벨 (1–10)</label>
              <input
                id="level-input"
                type="number"
                min={1}
                max={10}
                value={addLevel}
                onChange={(e) => setAddLevel(Number(e.target.value))}
                aria-invalid={isLevelInvalid}
                aria-describedby={isLevelInvalid ? "level-error" : undefined}
                style={{
                  width: 64,
                  padding: "6px 10px",
                  border: `1px solid ${isLevelInvalid ? "#e53935" : "#ddd"}`,
                  borderRadius: 6,
                  fontSize: 14,
                  outline: isLevelInvalid ? "2px solid #ffcdd2" : undefined,
                }}
              />
              {isLevelInvalid ? (
                <span id="level-error" style={{ fontSize: 11, color: "#e53935" }}>1–10 사이 값을 입력하세요</span>
              ) : (
                <span style={{ fontSize: 12, color: "#999" }}>기본값 5 — AI가 자동으로 조정합니다</span>
              )}
            </div>
          )}
        </div>
        {error && <p style={{ color: "#e53935", fontSize: 12, margin: "8px 0 0" }}>{error}</p>}
      </div>

      {/* Search + Tag filter + Sort */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: allTags.length > 0 ? 8 : 0 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="제목·설명·내용 검색..."
              aria-label="토픽 검색"
              style={{
                width: "100%",
                padding: "8px 36px 8px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 13,
                boxSizing: "border-box",
                background: "#fafafa",
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                style={{
                  position: "absolute",
                  right: 8,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  color: "#aaa",
                  fontSize: 16,
                  lineHeight: 1,
                  padding: "0 2px",
                }}
                aria-label="검색 지우기"
              >
                ×
              </button>
            )}
          </div>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortOption)}
            aria-label="정렬 기준"
            style={{
              padding: "8px 10px",
              border: "1px solid #ddd",
              borderRadius: 6,
              fontSize: 13,
              background: "#fafafa",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <option value="updated_desc">최근 수정순</option>
            <option value="updated_asc">오래된 수정순</option>
            <option value="title_asc">제목순</option>
            <option value="created_desc">최근 추가순</option>
          </select>
        </div>
        {allTags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {allTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                aria-pressed={activeTags.includes(tag)}
                style={{
                  padding: "2px 10px",
                  border: `1px solid ${activeTags.includes(tag) ? "#6c63ff" : "#ddd"}`,
                  borderRadius: 12,
                  background: activeTags.includes(tag) ? "#6c63ff" : "#fff",
                  color: activeTags.includes(tag) ? "#fff" : "#666",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* List */}
      {loading ? (
        <TopicListSkeleton />
      ) : loadError ? (
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <p style={{ color: "#e53935", marginBottom: 12 }}>{loadError}</p>
          <button
            onClick={() => setLoadKey(k => k + 1)}
            style={{
              padding: "8px 16px",
              background: "#6c63ff",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            재시도
          </button>
        </div>
      ) : !hasFilter && topics.length === 0 ? (
        <p style={{ color: "#999", textAlign: "center", padding: "40px 0" }}>
          아직 토픽이 없습니다. 위에서 추가해보세요!
        </p>
      ) : hasFilter && topics.length === 0 ? (
        <p style={{ color: "#999", textAlign: "center", padding: "40px 0" }}>
          {activeTags.length > 0
            ? `"${activeTags.join(", ")}" 태그와 일치하는 토픽이 없습니다.`
            : `"${debouncedQuery}"와 일치하는 토픽이 없습니다.`}
        </p>
      ) : (
        <>
          {hasFilter && (
            <p style={{ fontSize: 12, color: "#888", marginBottom: 8 }}>
              {topics.length}개 표시
            </p>
          )}
          <TopicListWithQueue
            topics={topics}
            reviewIds={reviewIds}
            onOpen={(id) => navigate(`/topics/${id}/studio`)}
            onDelete={(id) => {
              const topic = topics.find((t) => t.id === id);
              handleDelete(id, topic?.title ?? "이 토픽");
            }}
          />
        </>
      )}
    </div>
  );
}

function TopicListWithQueue({
  topics,
  reviewIds,
  onOpen,
  onDelete,
}: {
  topics: Topic[];
  reviewIds: Set<string>;
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
            needsReview={reviewIds.has(topic.id)}
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
  needsReview,
  onOpen,
  onDelete,
}: {
  topic: Topic;
  activeCount: number;
  needsReview: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 8,
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
      display: "flex",
      alignItems: "center",
    }}>
      <button
        onClick={onOpen}
        aria-label={`${topic.title}${needsReview ? " (복습 필요)" : ""}${activeCount > 0 ? ` — 생성 중 ${activeCount}건` : ""} — 학습하기`}
        style={{
          flex: 1,
          background: "none",
          border: "none",
          textAlign: "left",
          cursor: "pointer",
          padding: "12px 16px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          minWidth: 0,
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontWeight: 600, color: "#222", fontSize: 15 }}>{topic.title}</span>
            {needsReview && (
              <span aria-hidden="true" style={{
                padding: "1px 7px",
                background: "#fff0f0",
                border: "1px solid #ffb3b3",
                borderRadius: 10,
                fontSize: 11,
                color: "#c0392b",
                whiteSpace: "nowrap",
              }}>
                복습 필요
              </span>
            )}
          </div>
          {topic.description && (
            <div style={{ fontSize: 12, color: "#888", marginTop: 2 }}>{topic.description}</div>
          )}
        </div>
        {activeCount > 0 && (
          <span aria-hidden="true" style={{
            fontSize: 11,
            color: "#f57c00",
            background: "#fff3e0",
            border: "1px solid #ffcc80",
            borderRadius: 10,
            padding: "2px 8px",
            flexShrink: 0,
          }}>
            ⏳ 생성 중 {activeCount}
          </span>
        )}
        <LevelBadge level={topic.userLevel} />
      </button>
      <button
        onClick={onDelete}
        aria-label={`${topic.title} 삭제`}
        style={{
          padding: "4px 10px",
          margin: "0 12px 0 0",
          background: "transparent",
          border: "1px solid #ddd",
          borderRadius: 4,
          cursor: "pointer",
          color: "#e53935",
          fontSize: 12,
          flexShrink: 0,
        }}
      >
        삭제
      </button>
    </div>
  );
}
