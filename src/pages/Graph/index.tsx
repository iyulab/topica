import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, getRelatedTopics } from "../../lib/api";

interface GraphTopic {
  id: string;
  title: string;
  userLevel: number;
  tags: string[];
  hasEmbedding: boolean;
}

interface NodePos {
  x: number;
  y: number;
  topic: GraphTopic;
}

const W = 700;
const H = 480;
const R = 22;
const MIN_DIST = R * 2 + 10;
const PAD = R + 12;

function computeForceLayout(topics: GraphTopic[]): NodePos[] {
  const n = topics.length;
  if (n === 0) return [];
  if (n === 1) return [{ x: W / 2, y: H / 2, topic: topics[0] }];

  const rx = Math.min(180, W / 2 - PAD);
  const ry = Math.min(160, H / 2 - PAD);
  const px = topics.map((_, i) => W / 2 + Math.cos((2 * Math.PI * i) / n - Math.PI / 2) * rx);
  const py = topics.map((_, i) => H / 2 + Math.sin((2 * Math.PI * i) / n - Math.PI / 2) * ry);

  for (let iter = 0; iter < 200; iter++) {
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const dx = px[j] - px[i];
        const dy = py[j] - py[i];
        const d = Math.sqrt(dx * dx + dy * dy) || 0.01;
        if (d < MIN_DIST) {
          const push = ((MIN_DIST - d) / d) * 0.5;
          px[i] -= dx * push;
          py[i] -= dy * push;
          px[j] += dx * push;
          py[j] += dy * push;
        }
      }
      px[i] += (W / 2 - px[i]) * 0.02;
      py[i] += (H / 2 - py[i]) * 0.02;
      px[i] = Math.max(PAD, Math.min(W - PAD, px[i]));
      py[i] = Math.max(PAD, Math.min(H - PAD, py[i]));
    }
  }

  return topics.map((t, i) => ({ x: px[i], y: py[i], topic: t }));
}

export default function GraphPage() {
  const navigate = useNavigate();
  const [topics, setTopics] = useState<GraphTopic[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [related, setRelated] = useState<{ id: string; score: number }[]>([]);
  const [tagFilter, setTagFilter] = useState<string | null>(null);

  useEffect(() => {
    apiGet<GraphTopic[]>("/graph").then(setTopics).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) { setRelated([]); return; }
    getRelatedTopics(selected)
      .then((r) => setRelated(r.map((x) => ({ id: x.id, score: x.score }))))
      .catch(() => setRelated([]));
  }, [selected]);

  const allTags = [...new Set(topics.flatMap((t) => t.tags))].sort();

  const visibleTopics = tagFilter
    ? topics.filter((t) => t.tags.includes(tagFilter))
    : topics;

  const nodes = useMemo(() => computeForceLayout(visibleTopics), [visibleTopics]);

  const relatedIds = new Set(related.map((r) => r.id));

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: "0 0 16px", color: "#222" }}>토픽 그래프</h2>

      {allTags.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
          <button onClick={() => setTagFilter(null)} style={tagBtnStyle(!tagFilter)}>전체</button>
          {allTags.map((tag) => (
            <button key={tag} onClick={() => setTagFilter(tag === tagFilter ? null : tag)} style={tagBtnStyle(tagFilter === tag)}>
              {tag}
            </button>
          ))}
        </div>
      )}

      {topics.length === 0 ? (
        <p style={{ color: "#aaa" }}>토픽이 없거나 아직 임베딩이 없습니다.</p>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <svg width={W} height={H}>
            {selected && nodes.map((n) => {
              if (!relatedIds.has(n.topic.id)) return null;
              const from = nodes.find((nd) => nd.topic.id === selected);
              if (!from) return null;
              const rel = related.find((r) => r.id === n.topic.id);
              return (
                <line
                  key={n.topic.id}
                  x1={from.x} y1={from.y} x2={n.x} y2={n.y}
                  stroke="#6c63ff" strokeOpacity={rel ? rel.score * 0.8 : 0.4}
                  strokeWidth={2}
                  strokeDasharray="4 3"
                />
              );
            })}

            {nodes.map((n) => {
              const isSelected = n.topic.id === selected;
              const isRelated = relatedIds.has(n.topic.id);
              const hasEmbed = n.topic.hasEmbedding;
              let fill = hasEmbed ? "#e8e5ff" : "#f5f5f5";
              if (isSelected) fill = "#6c63ff";
              if (isRelated) fill = "#c5f0d4";
              const textCol = isSelected ? "#fff" : "#333";

              return (
                <g key={n.topic.id} onClick={() => setSelected(n.topic.id === selected ? null : n.topic.id)} style={{ cursor: "pointer" }}>
                  <circle cx={n.x} cy={n.y} r={R}
                    fill={fill}
                    stroke={isSelected ? "#4a42d4" : isRelated ? "#28a745" : "#ccc"}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                  />
                  <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central"
                    fontSize={10} fontWeight={isSelected ? 700 : 400} fill={textCol}
                    style={{ userSelect: "none" }}
                  >
                    {n.topic.title.length > 10 ? n.topic.title.slice(0, 9) + "…" : n.topic.title}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {selected && (() => {
        const t = topics.find((tp) => tp.id === selected);
        if (!t) return null;
        return (
          <div style={{ marginTop: 16, background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <strong style={{ fontSize: 15 }}>{t.title}</strong>
                <span style={{ marginLeft: 8, fontSize: 12, color: "#888" }}>Lv. {t.userLevel}</span>
                {t.tags.length > 0 && (
                  <div style={{ marginTop: 6, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {t.tags.map((tag) => (
                      <span key={tag} style={{ padding: "2px 8px", background: "#f0eeff", border: "1px solid #d0c8ff", borderRadius: 10, fontSize: 11, color: "#6c63ff" }}>
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => navigate(`/topics/${t.id}/studio`)}
                style={{ padding: "6px 14px", background: "#6c63ff", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13 }}
              >
                스튜디오 열기
              </button>
            </div>
            {related.length > 0 && (
              <p style={{ margin: "10px 0 0", fontSize: 12, color: "#888" }}>
                관련: {related.map((r) => topics.find((tp) => tp.id === r.id)?.title).filter(Boolean).join(", ")}
              </p>
            )}
          </div>
        );
      })()}
    </div>
  );
}

function tagBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: "4px 10px",
    border: `1px solid ${active ? "#6c63ff" : "#ddd"}`,
    borderRadius: 12, background: active ? "#6c63ff" : "#fff",
    color: active ? "#fff" : "#555",
    cursor: "pointer", fontSize: 12,
  };
}
