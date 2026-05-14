export default function LevelBadge({ level }: { level: number }) {
  const color = level <= 3 ? "#4caf50" : level <= 6 ? "#ff9800" : "#f44336";
  return (
    <span style={{
      background: color,
      color: "#fff",
      borderRadius: 4,
      padding: "2px 8px",
      fontSize: 11,
      fontWeight: 700,
      flexShrink: 0,
    }}>
      Lv {level}
    </span>
  );
}
