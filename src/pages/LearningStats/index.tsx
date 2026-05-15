import { useEffect, useState } from "react";
import { UWidget } from "@iyulab/u-widgets/react";
import type { UWidgetSpec } from "@iyulab/u-widgets";
import { getLearningStats, type LearningStats } from "../../lib/api";

function Widget({ spec }: { spec: UWidgetSpec }) {
  return <UWidget spec={spec} />;
}

export default function LearningStats() {
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getLearningStats()
      .then(data => { if (!cancelled) setStats(data); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) return <div style={{ padding: 24, color: "#aaa" }}>통계 불러오는 중…</div>;
  if (!stats) return <div style={{ padding: 24, color: "#e53e3e" }}>통계를 불러올 수 없습니다.</div>;

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
    </div>
  );
}
