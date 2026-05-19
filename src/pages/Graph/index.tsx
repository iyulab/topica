import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { apiGet, getRelatedTopics, getWikiLinks, createTopic, type WikiLinkGraph } from "../../lib/api";
import { useLearningQueueStore } from "../../lib/store";

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

const CLUSTER_FILLS   = ['#e8f0fe','#fde8f4','#e8fee8','#fef9e8','#e8fef9','#f0e8fe','#fee8e8','#e8fefe'];
const CLUSTER_STROKES = ['#4285f4','#ea4c89','#34a853','#fbbc04','#00b0ff','#9c27b0','#ea4335','#00bcd4'];

function computeTagClusters(topics: GraphTopic[]): {
  assignments: Map<string, number>;
  clusterTags: Map<number, string>;
} {
  const tagToCluster = new Map<string, number>();
  const clusterTags = new Map<number, string>();
  let next = 0;
  const assignments = new Map<string, number>();

  for (const t of topics) {
    const primary = t.tags[0] ?? t.tags[1];
    if (!primary) { assignments.set(t.id, -1); continue; }
    if (!tagToCluster.has(primary)) {
      tagToCluster.set(primary, next);
      clusterTags.set(next, primary);
      next++;
    }
    assignments.set(t.id, tagToCluster.get(primary)!);
  }
  return { assignments, clusterTags };
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

const ALL_LEVELS = Array.from({ length: 10 }, (_, i) => i + 1);

export default function GraphPage() {
  const navigate = useNavigate();
  const { addItem } = useLearningQueueStore();
  const [ghostToast, setGhostToast] = useState<string | null>(null);
  const [topics, setTopics] = useState<GraphTopic[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [related, setRelated] = useState<{ id: string; score: number }[]>([]);
  const [wikiLinks, setWikiLinks] = useState<WikiLinkGraph | null>(null);
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [hideNoEmbed, setHideNoEmbed] = useState(false);
  const [minLevel, setMinLevel] = useState(1);
  const [maxLevel, setMaxLevel] = useState(10);

  useEffect(() => {
    apiGet<GraphTopic[]>("/graph").then(setTopics).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) { setRelated([]); setWikiLinks(null); return; }
    getRelatedTopics(selected)
      .then((r) => setRelated(r.map((x) => ({ id: x.id, score: x.score }))))
      .catch(() => setRelated([]));
    getWikiLinks(selected)
      .then(setWikiLinks)
      .catch(() => setWikiLinks(null));
  }, [selected]);

  const allTags = [...new Set(topics.flatMap((t) => t.tags))].sort();

  const visibleTopics = useMemo(() => topics.filter((t) => {
    if (tagFilter && !t.tags.includes(tagFilter)) return false;
    if (hideNoEmbed && !t.hasEmbedding) return false;
    if (t.userLevel < minLevel || t.userLevel > maxLevel) return false;
    return true;
  }), [topics, tagFilter, hideNoEmbed, minLevel, maxLevel]);

  const nodes = useMemo(() => computeForceLayout(visibleTopics), [visibleTopics]);

  const { assignments: clusterAssignments, clusterTags } = useMemo(
    () => computeTagClusters(topics),
    [topics]
  );

  // Clear selection when selected topic is filtered out
  useEffect(() => {
    if (selected && !visibleTopics.some((t) => t.id === selected)) {
      setSelected(null);
    }
  }, [visibleTopics, selected]);

  async function handleGhostClick(title: string) {
    try {
      const topic = await createTopic(title, 5);
      addItem({ topicId: topic.id, title: topic.title, addedAt: new Date().toISOString() });
      setGhostToast(`"${title}" 학습 큐에 추가됨`);
      setTimeout(() => setGhostToast(null), 2500);
    } catch {
      setGhostToast("토픽 생성에 실패했습니다.");
      setTimeout(() => setGhostToast(null), 2500);
    }
  }

  const relatedIds = new Set(related.map((r) => r.id));
  const wikiExistingIds = new Set((wikiLinks?.existing ?? []).map((e) => e.id));

  // Ghost nodes for missing [[링크]] topics — placed in a bottom strip (max 6)
  const ghostNodes = useMemo(() => {
    if (!wikiLinks || wikiLinks.missing.length === 0 || !selected) return [];
    const visible = wikiLinks.missing.slice(0, 6);
    const count = visible.length;
    const spacing = Math.min(90, (W - PAD * 2) / count);
    const startX = W / 2 - ((count - 1) * spacing) / 2;
    return visible.map((title, i) => ({
      x: Math.max(PAD + 10, Math.min(W - PAD - 10, startX + i * spacing)),
      y: H - 24,
      title,
    }));
  }, [wikiLinks, selected]);

  return (
    <div style={{ padding: 24 }}>
      <h2 style={{ margin: "0 0 16px", color: "#222" }}>토픽 그래프</h2>
      {ghostToast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 999,
          background: "#333", color: "#fff", padding: "10px 18px",
          borderRadius: 8, fontSize: 13, boxShadow: "0 2px 8px rgba(0,0,0,0.2)",
        }}>
          {ghostToast}
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center", marginBottom: 16 }}>
        {allTags.length > 0 && (
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 12, color: "#888", marginRight: 2 }}>태그:</span>
            <button onClick={() => setTagFilter(null)} aria-pressed={!tagFilter} style={tagBtnStyle(!tagFilter)}>전체</button>
            {allTags.map((tag) => (
              <button key={tag} onClick={() => setTagFilter(tag === tagFilter ? null : tag)} aria-pressed={tagFilter === tag} style={tagBtnStyle(tagFilter === tag)}>
                {tag}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: "#888" }}>레벨:</span>
          <select
            aria-label="최소 레벨"
            value={minLevel}
            onChange={(e) => { const v = Number(e.target.value); setMinLevel(v); if (v > maxLevel) setMaxLevel(v); }}
            style={{ padding: "3px 6px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12 }}
          >
            {ALL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>
          <span style={{ fontSize: 12, color: "#aaa" }}>~</span>
          <select
            aria-label="최대 레벨"
            value={maxLevel}
            onChange={(e) => { const v = Number(e.target.value); setMaxLevel(v); if (v < minLevel) setMinLevel(v); }}
            style={{ padding: "3px 6px", border: "1px solid #ddd", borderRadius: 6, fontSize: 12 }}
          >
            {ALL_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, color: "#555", cursor: "pointer" }}>
            <input type="checkbox" checked={hideNoEmbed} onChange={(e) => setHideNoEmbed(e.target.checked)} />
            임베딩 있는 토픽만
          </label>
        </div>
      </div>

      {topics.length === 0 ? (
        <p style={{ color: "#aaa" }}>토픽이 없습니다. 토픽 목록에서 토픽을 추가해보세요.</p>
      ) : visibleTopics.length === 0 ? (
        <p style={{ color: "#aaa" }}>현재 필터 조건에 해당하는 토픽이 없습니다.</p>
      ) : (
        <div style={{ background: "#fff", borderRadius: 12, padding: 12, boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
          <svg width={W} height={H} role="img" aria-label="토픽 관계 그래프">
            {selected && (() => {
              const from = nodes.find((nd) => nd.topic.id === selected);
              if (!from) return null;
              return <>
                {/* Embedding-similarity edges */}
                {nodes.map((n) => {
                  if (!relatedIds.has(n.topic.id)) return null;
                  const rel = related.find((r) => r.id === n.topic.id);
                  return (
                    <line key={`emb-${n.topic.id}`}
                      x1={from.x} y1={from.y} x2={n.x} y2={n.y}
                      stroke="#6c63ff" strokeOpacity={rel ? rel.score * 0.8 : 0.4}
                      strokeWidth={2} strokeDasharray="4 3"
                    />
                  );
                })}
                {/* Wiki-link edges to existing topics */}
                {nodes.map((n) => {
                  if (!wikiExistingIds.has(n.topic.id)) return null;
                  return (
                    <line key={`wiki-${n.topic.id}`}
                      x1={from.x} y1={from.y} x2={n.x} y2={n.y}
                      stroke="#e67e22" strokeOpacity={0.6}
                      strokeWidth={1.5}
                    />
                  );
                })}
                {/* Ghost node edges (missing topics) */}
                {ghostNodes.map((g) => (
                  <line key={`ghost-edge-${g.title}`}
                    x1={from.x} y1={from.y} x2={g.x} y2={g.y}
                    stroke="#aaa" strokeOpacity={0.5}
                    strokeWidth={1} strokeDasharray="4 3"
                  />
                ))}
              </>;
            })()}

            {nodes.map((n) => {
              const isSelected = n.topic.id === selected;
              const isRelated = relatedIds.has(n.topic.id);
              const isWikiLinked = wikiExistingIds.has(n.topic.id);
              const clusterId = clusterAssignments.get(n.topic.id) ?? -1;
              const ci = clusterId >= 0 ? clusterId % CLUSTER_FILLS.length : -1;
              let fill = ci >= 0 ? CLUSTER_FILLS[ci] : "#f5f5f5";
              let strokeColor = ci >= 0 ? CLUSTER_STROKES[ci] : "#ccc";
              if (isSelected)    { fill = "#6c63ff"; strokeColor = "#4a42d4"; }
              if (isRelated)     { fill = "#c5f0d4"; strokeColor = "#28a745"; }
              if (isWikiLinked && !isSelected && !isRelated) { fill = "#fef3e2"; strokeColor = "#e67e22"; }
              const textCol = isSelected ? "#fff" : "#333";

              return (
                <g
                  key={n.topic.id}
                  role="button"
                  tabIndex={0}
                  aria-label={`${n.topic.title} (레벨 ${n.topic.userLevel})${isSelected ? " — 선택됨" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => setSelected(n.topic.id === selected ? null : n.topic.id)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setSelected(n.topic.id === selected ? null : n.topic.id); } }}
                  style={{ cursor: "pointer" }}
                >
                  <circle cx={n.x} cy={n.y} r={R}
                    fill={fill}
                    stroke={strokeColor}
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

            {/* Ghost nodes — missing [[링크]] topics (click to create + enqueue) */}
            {ghostNodes.map((g) => (
              <g key={`ghost-${g.title}`}
                role="button"
                tabIndex={0}
                aria-label={`${g.title} — 클릭하면 학습 큐에 추가`}
                style={{ cursor: "pointer" }}
                onClick={() => handleGhostClick(g.title)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleGhostClick(g.title); } }}
              >
                <title>{g.title} — 클릭하면 학습 큐에 추가</title>
                <circle cx={g.x} cy={g.y} r={R - 4}
                  fill="#f5f5f5" stroke="#bbb" strokeWidth={1.5} strokeDasharray="4 3"
                />
                <text x={g.x} y={g.y} textAnchor="middle" dominantBaseline="central"
                  fontSize={9} fill="#999" style={{ userSelect: "none" }}
                >
                  {g.title.length > 9 ? g.title.slice(0, 8) + "…" : g.title}
                </text>
                <text x={g.x} y={g.y + 14} textAnchor="middle"
                  fontSize={8} fill="#bbb" style={{ userSelect: "none" }}
                >+큐</text>
              </g>
            ))}
          </svg>
          <div style={{ marginTop: 10, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
            {clusterTags.size > 0 && [...clusterTags.entries()]
              .map(([id, tag]) => ({ id, tag, count: visibleTopics.filter((t) => clusterAssignments.get(t.id) === id).length }))
              .filter(({ count }) => count > 0)
              .map(({ id, tag, count }) => {
                const ci = id % CLUSTER_FILLS.length;
                return (
                  <span key={id} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#555" }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: CLUSTER_STROKES[ci], display: "inline-block" }} />
                    {tag} ({count})
                  </span>
                );
              })}
            {selected && (wikiLinks?.existing.length ?? 0) > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#e67e22" }}>
                <span style={{ width: 18, height: 2, background: "#e67e22", display: "inline-block", borderRadius: 1 }} />
                [[링크]] 연결
              </span>
            )}
            {selected && ghostNodes.length > 0 && (
              <span style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#999" }}>
                <svg width={18} height={6}><line x1={0} y1={3} x2={18} y2={3} stroke="#aaa" strokeWidth={1.5} strokeDasharray="4 3" /></svg>
                미학습 경로
              </span>
            )}
          </div>
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
              <div style={{ marginTop: 10 }}>
                <span style={{ fontSize: 12, color: "#888" }}>관련 토픽 (클릭 시 탐색):</span>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
                  {related.map((r) => {
                    const rt = topics.find((tp) => tp.id === r.id);
                    if (!rt) return null;
                    return (
                      <button
                        key={r.id}
                        onClick={() => setSelected(r.id)}
                        title={`유사도: ${(r.score * 100).toFixed(0)}%`}
                        style={{
                          padding: "3px 10px",
                          background: "#e8f5e9",
                          border: "1px solid #28a745",
                          borderRadius: 10,
                          fontSize: 12,
                          color: "#155724",
                          cursor: "pointer",
                        }}
                      >
                        {rt.title} <span style={{ opacity: 0.6 }}>{(r.score * 100).toFixed(0)}%</span>
                      </button>
                    );
                  })}
                </div>
              </div>
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
