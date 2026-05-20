import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { UWidget } from "@iyulab/u-widgets/react";
import type { UWidgetSpec } from "@iyulab/u-widgets";
import {
  getLearningStats, getPathSuggestions, getLearningGraphData, getReviewSuggestions,
  type LearningStats, type PathSuggestion, type LearningGraphData, type ReviewSuggestion,
} from "../../lib/api";
import i18n from "../../lib/i18n";

// --- Learning Path Graph SVG ---

const GW = 640;
const GH = 320;
const NR = 20;
const GHOST_R = 16;
const MIN_D = NR * 2 + 14;
const PAD = NR + 14;

interface GraphNode { id: string; title: string; studied: boolean; x: number; y: number; }

function computeLayout(graph: LearningGraphData): GraphNode[] {
  const studied = graph.nodes.filter(n => n.studied);
  const ghost = graph.nodes.filter(n => !n.studied);
  const result: GraphNode[] = [];

  const placeRadial = (items: { id: string; title: string; studied: boolean }[], cx: number, cy: number, rx: number, ry: number) => {
    const n = items.length;
    return items.map((item, i) => ({
      ...item,
      x: n === 1 ? cx : cx + Math.cos((2 * Math.PI * i) / n - Math.PI / 2) * rx,
      y: n === 1 ? cy : cy + Math.sin((2 * Math.PI * i) / n - Math.PI / 2) * ry,
    }));
  };

  const studiedRx = Math.min(100, GW / 2 - PAD - 20);
  const studiedRy = Math.min(90, GH / 2 - PAD - 20);
  const studiedNodes = placeRadial(studied, GW / 2, GH / 2, studiedRx, studiedRy);

  const ghostRx = Math.min(160, GW / 2 - PAD);
  const ghostRy = Math.min(130, GH / 2 - PAD);
  const ghostNodes = placeRadial(ghost, GW / 2, GH / 2, ghostRx, ghostRy);

  const px = studiedNodes.map(n => n.x);
  const py = studiedNodes.map(n => n.y);
  for (let iter = 0; iter < 100; iter++) {
    for (let i = 0; i < px.length; i++) {
      for (let j = i + 1; j < px.length; j++) {
        const dx = px[j] - px[i]; const dy = py[j] - py[i];
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (d < MIN_D) {
          const push = ((MIN_D - d) / d) * 0.4;
          px[i] -= dx * push; py[i] -= dy * push;
          px[j] += dx * push; py[j] += dy * push;
        }
      }
      px[i] = Math.max(PAD, Math.min(GW - PAD, px[i]));
      py[i] = Math.max(PAD, Math.min(GH - PAD, py[i]));
    }
  }
  studiedNodes.forEach((n, i) => { n.x = px[i]; n.y = py[i]; });

  result.push(...studiedNodes, ...ghostNodes);
  return result;
}

function LearningPathGraph({ graph, onGhostClick }: {
  graph: LearningGraphData;
  onGhostClick: (id: string, title: string) => void;
}) {
  const { t } = useTranslation();
  const nodes = useMemo(() => computeLayout(graph), [graph]);
  const nodeMap = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);

  if (nodes.length === 0) return null;

  return (
    <svg
      viewBox={`0 0 ${GW} ${GH}`}
      role="img"
      aria-label={t('stats.graph.aria')}
      style={{ width: "100%", maxWidth: GW, display: "block", margin: "0 auto", overflow: "visible" }}
    >
      {/* Edges */}
      {graph.edges.map((e, i) => {
        const src = nodeMap.get(e.source);
        const tgt = nodeMap.get(e.target);
        if (!src || !tgt) return null;
        return (
          <line
            key={i}
            x1={src.x} y1={src.y} x2={tgt.x} y2={tgt.y}
            stroke="#c5bfff" strokeWidth={1.5} strokeDasharray="4 3"
            strokeOpacity={0.7}
          />
        );
      })}

      {/* Nodes */}
      {nodes.map(n => n.studied ? (
        <g
          key={n.id}
          role="button"
          tabIndex={0}
          aria-label={t('stats.node.studied.aria', { title: n.title })}
          style={{ cursor: "pointer" }}
          onClick={() => onGhostClick(n.id, n.title)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onGhostClick(n.id, n.title); } }}
        >
          <circle cx={n.x} cy={n.y} r={NR} fill="#6c63ff" stroke="#fff" strokeWidth={2} />
          <text
            x={n.x} y={n.y + NR + 11}
            textAnchor="middle" fontSize={10} fill="#444"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {n.title.length > 10 ? n.title.slice(0, 9) + "…" : n.title}
          </text>
        </g>
      ) : (
        <g
          key={n.id}
          role="button"
          tabIndex={0}
          aria-label={t('stats.node.explorable.aria', { title: n.title })}
          style={{ cursor: "pointer" }}
          onClick={() => onGhostClick(n.id, n.title)}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onGhostClick(n.id, n.title); } }}
        >
          <circle
            cx={n.x} cy={n.y} r={GHOST_R}
            fill="none" stroke="#aaa" strokeWidth={1.5} strokeDasharray="4 3"
          />
          <text
            x={n.x} y={n.y + GHOST_R + 11}
            textAnchor="middle" fontSize={9} fill="#888"
            style={{ userSelect: "none", pointerEvents: "none" }}
          >
            {n.title.length > 10 ? n.title.slice(0, 9) + "…" : n.title}
          </text>
        </g>
      ))}
    </svg>
  );
}

// --- Stats page ---

function Widget({ spec }: { spec: UWidgetSpec }) {
  return <UWidget spec={spec} />;
}

export default function LearningStats() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [stats, setStats] = useState<LearningStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [pathSuggestions, setPathSuggestions] = useState<PathSuggestion[]>([]);
  const [graphData, setGraphData] = useState<LearningGraphData | null>(null);
  const [reviewSuggestions, setReviewSuggestions] = useState<ReviewSuggestion[]>([]);

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
    let cancelled = false;
    getPathSuggestions()
      .then(data => { if (!cancelled) setPathSuggestions(data); })
      .catch(() => { if (!cancelled) setPathSuggestions([]); });
    getLearningGraphData()
      .then(data => { if (!cancelled) setGraphData(data); })
      .catch(() => { if (!cancelled) setGraphData(null); });
    getReviewSuggestions()
      .then(data => { if (!cancelled) setReviewSuggestions(data); })
      .catch(() => { if (!cancelled) setReviewSuggestions([]); });
    return () => { cancelled = true; };
  }, []);

  const locale = i18n.language === "ko" ? "ko-KR" : "en-US";

  if (loading) return <div style={{ padding: 24, color: "#aaa" }}>{t('stats.loading')}</div>;
  if (!stats) return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 24 }}>{t('stats.title')}</h2>
      <div style={{ color: "#e53e3e", marginBottom: 12 }}>{t('stats.load.error')}</div>
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
        {t('stats.retry')}
      </button>
    </div>
  );

  const today = new Date();
  const streak7dData = [...stats.streak7d].reverse().map((count, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (6 - i));
    return { day: d.toLocaleDateString(locale, { weekday: "short" }), sessions: count };
  });

  const hasGraphData = graphData && graphData.edges.length > 0;

  return (
    <div style={{ padding: 24, maxWidth: 800, margin: "0 auto" }}>
      <h2 style={{ marginBottom: 24 }}>{t('stats.title')}</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
        <Widget spec={{
          widget: "metric",
          data: { value: stats.totalTopicsStudied, unit: t('stats.topics.unit'), label: t('stats.topics.label') }
        }} />
        <Widget spec={{
          widget: "metric",
          data: { value: stats.totalStudyMinutes, unit: t('stats.time.unit'), label: t('stats.time.label') }
        }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Widget spec={{
          widget: "gauge",
          data: {
            value: Math.min(stats.todaySessionCount, 5),
            min: 0,
            max: 5,
            label: t('stats.today.label', { count: stats.todaySessionCount }),
          }
        }} />
      </div>

      <div style={{ marginBottom: 16 }}>
        <Widget spec={{
          widget: "chart.bar",
          data: streak7dData,
          mapping: { x: "day", y: "sessions" },
          options: { locale },
        }} />
      </div>

      {stats.scoreByTopic.length > 0 && (
        <Widget spec={{
          widget: "chart.bar",
          data: stats.scoreByTopic.map(tp => ({ topic: tp.title, score: Math.round(tp.avgScore) })),
          mapping: { x: "topic", y: "score" },
          options: { yFormat: { type: "number", suffix: t('stats.score.suffix') } }
        }} />
      )}

      {hasGraphData && (
        <div style={{
          marginTop: 24,
          padding: "16px 18px",
          background: "#f8f7ff",
          borderRadius: 10,
          border: "1px solid #e0dcff",
        }}>
          <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6c63ff", fontWeight: 600 }}>
            {t('stats.graph.title')}
          </p>
          <div style={{ display: "flex", gap: 16, marginBottom: 10, fontSize: 11, color: "#888" }}>
            <span>
              <svg width="12" height="12" style={{ verticalAlign: "middle", marginRight: 4 }}>
                <circle cx="6" cy="6" r="6" fill="#6c63ff" />
              </svg>
              {t('stats.graph.studied')}
            </span>
            <span>
              <svg width="12" height="12" style={{ verticalAlign: "middle", marginRight: 4 }}>
                <circle cx="6" cy="6" r="5" fill="none" stroke="#aaa" strokeWidth="1.5" strokeDasharray="3 2" />
              </svg>
              {t('stats.graph.explorable')}
            </span>
          </div>
          <LearningPathGraph
            graph={graphData}
            onGhostClick={(id) => navigate(`/topics/${id}/studio`)}
          />
        </div>
      )}

      {pathSuggestions.length > 0 && (
        <div style={{
          marginTop: 16,
          padding: "14px 18px",
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #e0dcff",
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#888" }}>
            {t('stats.path.title')}
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

      {reviewSuggestions.length > 0 && (
        <div style={{
          marginTop: 16,
          padding: "14px 18px",
          background: "#fff",
          borderRadius: 10,
          border: "1px solid #ffd6d6",
        }}>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "#888" }}>
            {t('stats.review.title')}
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {reviewSuggestions.map(({ id, title, avgScore }) => (
              <button
                key={id}
                onClick={() => navigate(`/topics/${id}/studio`)}
                style={{
                  padding: "5px 14px",
                  background: "#fff",
                  border: "1px solid #ffb3b3",
                  borderRadius: 20,
                  fontSize: 13,
                  color: "#c0392b",
                  cursor: "pointer",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fff5f5")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}
                title={t('stats.score.title', { score: avgScore })}
              >
                {title} ({avgScore}%)
              </button>
            ))}
          </div>
        </div>
      )}

      {stats.totalTopicsStudied === 0 && (
        <p style={{ textAlign: "center", color: "#aaa", marginTop: 32 }}>
          {t('stats.empty.full')}
        </p>
      )}
    </div>
  );
}
