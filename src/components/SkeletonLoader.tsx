import { type CSSProperties } from "react";

function SkeletonBlock({ width = "100%", height = 16, style }: { width?: number | string; height?: number; style?: CSSProperties }) {
  return (
    <div style={{
      width,
      height,
      borderRadius: 4,
      background: "linear-gradient(90deg, #e8e8e8 25%, #f5f5f5 50%, #e8e8e8 75%)",
      backgroundSize: "200% 100%",
      animation: "skeleton-shimmer 1.4s infinite",
      ...style,
    }} />
  );
}

export function TopicListSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      {[1, 2, 3].map((i) => (
        <div key={i} style={{
          background: "#fff",
          borderRadius: 8,
          padding: "12px 16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
          display: "flex",
          alignItems: "center",
          gap: 12,
        }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
            <SkeletonBlock width="60%" height={16} />
            <SkeletonBlock width="40%" height={12} />
          </div>
          <SkeletonBlock width={36} height={20} style={{ borderRadius: 10 }} />
          <SkeletonBlock width={48} height={28} style={{ borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

export function ContentSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 8 }}>
      <SkeletonBlock height={20} width="50%" />
      <SkeletonBlock height={14} />
      <SkeletonBlock height={14} width="90%" />
      <SkeletonBlock height={14} width="80%" />
      <SkeletonBlock height={14} />
      <SkeletonBlock height={14} width="70%" />
    </div>
  );
}
