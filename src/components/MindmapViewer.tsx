import MarkdownRenderer from "./MarkdownRenderer";

interface MindMapNode {
  label: string;
  children?: MindMapNode[];
}

interface LayoutNode {
  node: MindMapNode;
  x: number;
  y: number;
  level: number;
  parentX?: number;
  parentY?: number;
  color: string;
}

const COLORS = ["#6c63ff", "#ff6584", "#43a047", "#f57c00", "#0288d1", "#8e24aa", "#00897b"];
const R = [0, 185, 340];

function computeLayout(root: MindMapNode, cx: number, cy: number): LayoutNode[] {
  const nodes: LayoutNode[] = [{ node: root, x: cx, y: cy, level: 0, color: "#6c63ff" }];
  const children = root.children ?? [];

  children.forEach((child, i) => {
    const color = COLORS[i % COLORS.length];
    const angle = (2 * Math.PI * i) / children.length - Math.PI / 2;
    const x1 = cx + R[1] * Math.cos(angle);
    const y1 = cy + R[1] * Math.sin(angle);
    nodes.push({ node: child, x: x1, y: y1, level: 1, parentX: cx, parentY: cy, color });

    const subs = child.children ?? [];
    if (subs.length === 0) return;
    const span = Math.min(Math.PI * 0.5, (Math.PI * 0.55 * subs.length) / 3);
    subs.forEach((sub, j) => {
      const subAngle = subs.length === 1 ? angle : angle + span * ((j / (subs.length - 1)) - 0.5);
      const x2 = cx + R[2] * Math.cos(subAngle);
      const y2 = cy + R[2] * Math.sin(subAngle);
      nodes.push({ node: sub, x: x2, y: y2, level: 2, parentX: x1, parentY: y1, color });
    });
  });

  return nodes;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max - 1) + "…" : s;
}

interface Props {
  body: string;
}

export default function MindmapViewer({ body }: Props) {
  let root: MindMapNode | null = null;
  try {
    const trimmed = body.trim();
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start !== -1 && end !== -1) {
      root = JSON.parse(trimmed.slice(start, end + 1)) as MindMapNode;
    }
  } catch { /* fallback below */ }

  if (!root) return <MarkdownRenderer content={body} />;

  const W = 720;
  const H = 500;
  const cx = W / 2;
  const cy = H / 2;
  const layout = computeLayout(root, cx, cy);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: "block", margin: "0 auto" }}>
        {/* Connection lines */}
        {layout.filter((n) => n.parentX !== undefined).map((n, i) => (
          <line
            key={`line-${i}`}
            x1={n.parentX}
            y1={n.parentY}
            x2={n.x}
            y2={n.y}
            stroke={n.color}
            strokeWidth={n.level === 1 ? 2 : 1.5}
            strokeOpacity={n.level === 1 ? 0.5 : 0.35}
          />
        ))}

        {/* Nodes */}
        {layout.map((n, i) => {
          const isRoot = n.level === 0;
          const isBranch = n.level === 1;
          const r = isRoot ? 38 : isBranch ? 26 : 20;
          const maxChars = isRoot ? 15 : 13;
          const label = truncate(n.node.label, maxChars);
          const words = label.split(" ");
          const half = Math.ceil(words.length / 2);

          return (
            <g key={`node-${i}`}>
              <title>{n.node.label}</title>
              <circle
                cx={n.x}
                cy={n.y}
                r={r}
                fill={isRoot || isBranch ? n.color : "#fff"}
                stroke={n.color}
                strokeWidth={isRoot ? 0 : 1.5}
                opacity={isRoot ? 1 : isBranch ? 0.88 : 1}
              />
              {words.length > 2 ? (
                <text
                  textAnchor="middle"
                  fontSize={isRoot ? 12 : isBranch ? 10 : 9}
                  fill={isRoot || isBranch ? "#fff" : n.color}
                  fontWeight={isRoot ? 700 : isBranch ? 600 : 400}
                  style={{ userSelect: "none" }}
                >
                  <tspan x={n.x} y={n.y} dy="-0.55em">{words.slice(0, half).join(" ")}</tspan>
                  <tspan x={n.x} dy="1.2em">{words.slice(half).join(" ")}</tspan>
                </text>
              ) : (
                <text
                  x={n.x}
                  y={n.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={isRoot ? 12 : isBranch ? 10 : 9}
                  fill={isRoot || isBranch ? "#fff" : n.color}
                  fontWeight={isRoot ? 700 : isBranch ? 600 : 400}
                  style={{ userSelect: "none" }}
                >
                  {label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <p style={{ textAlign: "center", fontSize: 11, color: "#bbb", margin: "8px 0 0" }}>
        마인드맵 — 재생성으로 내용 갱신
      </p>
    </div>
  );
}
