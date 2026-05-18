import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { UWidget } from "@iyulab/u-widgets/react";
import type { UWidgetSpec } from "@iyulab/u-widgets";
import { getLearningStats, getTopics, getWikiLinks, type LearningStats } from "../../lib/api";

interface PathSuggestion {
  id: string;
  title: string;
}

function Widget({ spec }: { spec: UWidgetSpec }) {
  return <UWidget spec={spec} />;
}

export default function LearningStats() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [pathSuggestions, setPathSuggestions] = useState<PathSuggestion[]>([]);

  useEffect(() => {
    let cancelled = false;
    setStats(null);
    setLoading(true);
    getLearningStats()
      .then(data => { if (!cancelled) setStats(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [retryKey]);

  useEffect(() => {
    if (!stats || stats.scoreByTopic.length === 0) { setPathSuggestions([]); return; }
    let cancelled = false;

    (async () => {
      try {
        const allTopics = await getTopics();
        const studiedTitles = new Set(stats.scoreByTopic.map(t => t.title));
        const studiedTopics = allTopics.filter(t => studiedTitles.has(t.title));

        const connectedIds = new Map<string, string>(); // id → title
        await Promise.all(studiedTopics.map(async (t) => {
          const wl = await getWikiLinks(t.id).catch(() => ({ existing: [], missing: [] }));
          for (const e of wl.existing) {
            if (!studiedTitles.has(e.title)) connectedIds.set(e.id, e.title);
          }
        }));

        if (!cancelled) {
          setPathSuggestions([...connectedIds.entries()].map(([id, title]) => ({ id, title })));
        }
      } catch { /* ignore */ }
    })();

    return () => { cancelled = true; };
  }, [stats]);

  if (loading) return <div style={{ padding: 24, color: "#aaa" }}>통계 불러오는 중…</div>;
  if (!stats) return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 24 }}>학습 통계</h2>
      <div style={{ color: "#e53e3e", marginBottom: 12 }}>통계를 불러올 수 없습니다.</div>
      <button
        onClick={() => setRetryKey(k => k + 1)}
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
  );

  const today = new Date();
  const streak7dData = [...stats.streak7d].reverse().map((count, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return { day: d.toLocaleDateString("ko-KR", { weekday: "short" }), sessions: count };
  });

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 24 }}>학습 통계</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Widget spec={{
          widget: "metric",
          data: { value: stats.totalTopicsStudied, unit: "토픽", label: "학습한 토픽" }
        }} />
        <Widget spec={{
          widget: "metric",
          data: { value: stats.totalStudyMinutes, unit: "분", label: "총 학습 시간" }
        }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Widget spec={{
          widget: "gauge",
          data: {
            value: Math.min(stats.todaySessionCount, 5),
            min: 0,
            max: 5,
            label: `오늘 학습 (${stats.todaySessionCount}회 / 목표 5회)`
          }
        }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Widget spec={{
          widget: "chart.bar",
          data: streak7dData,
          mapping: { x: "day", y: "sessions" },
          options: { locale: "ko-KR" }
        }} />
      </div>

      {stats.scoreByTopic.length > 0 && (
        <Widget spec={{
          widget: "chart.bar",
          data: stats.scoreByTopic.map(t => ({ topic: t.title, score: Math.round(t.avgScore) })),
          mapping: { x: "topic", y: "score" },
          options: { yFormat: { type: "number", suffix: "점" } }
        }} />
      )}

      {stats.totalTopicsStudied === 0 && (
        <p style={{ textAlign: "center", color: "#aaa", marginTop: 32 }}>
          아직 학습 기록이 없습니다. 플래시카드나 퀴즈를 완료하면 여기에 표시됩니다.
        </p>
      )}

      {pathSuggestions.length > 0 && (
        <div style={{
          marginTop: 24,
          padding: "16px 18px",
          background: "#f8f7ff",
          borderRadius: 10,
          border: "1px solid #e0dcff",
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 13, color: "#6c63ff", fontWeight: 600 }}>
            학습 경로 — 이어서 탐구할 수 있는 토픽
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {pathSuggestions.map(({ id, title }) => (
              <button
                key={id}
                onClick={() => navigate(`/topics/${id}/studio`)}
                style={{
                  padding: "5px 14px",
                  background: "#fff",
                  border: "1px solid #c5bfff",
                  borderRadius: 20,
                  fontSize: 13,
                  color: "#6c63ff",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#f0eeff")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
              >
                {title} →
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
