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

export function CardSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 16, padding: "20px 0" }}>
      <SkeletonBlock height={180} width="100%" style={{ borderRadius: 12, maxWidth: 480 }} />
      <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
        {[1, 2, 3, 4, 5].map((i) => (
          <SkeletonBlock key={i} width={10} height={10} style={{ borderRadius: "50%" }} />
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <SkeletonBlock width={80} height={32} style={{ borderRadius: 6 }} />
        <SkeletonBlock width={80} height={32} style={{ borderRadius: 6 }} />
      </div>
    </div>
  );
}

export function QuizSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16, paddingTop: 8 }}>
      <SkeletonBlock height={18} width="80%" />
      <div style={{ display: "flex", flexDirection: "column", gap: 8, paddingLeft: 8 }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <SkeletonBlock width={18} height={18} style={{ borderRadius: "50%", flexShrink: 0 }} />
            <SkeletonBlock height={14} width={`${60 + i * 7}%`} />
          </div>
        ))}
      </div>
    </div>
  );
}
