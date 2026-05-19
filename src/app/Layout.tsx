import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";
import { BookOpen, Network, BarChart2, Settings, type LucideIcon } from "lucide-react";
import { useAppStore, useQueueStore, useLearningQueueStore } from "../lib/store";
import NotificationToast from "../components/NotificationToast";

export default function Layout() {
  const { isConnected } = useAppStore();
  const { activeItems } = useQueueStore();
  const { items: queueItems, removeItem } = useLearningQueueStore();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* Sidebar */}
      <nav aria-label="주 메뉴" style={{
        width: 200,
        background: "#1a1a2e",
        color: "#e0e0e0",
        display: "flex",
        flexDirection: "column",
        padding: "16px 0",
        gap: 4,
        flexShrink: 0,
      }}>
        <div style={{ padding: "0 16px 16px", fontSize: 18, fontWeight: 700, color: "#fff" }}>
          Topica
        </div>
        <NavLink to="/" active={pathname === "/"} label="토픽 목록" icon={BookOpen} />
        <NavLink to="/graph" active={pathname === "/graph"} label="토픽 그래프" icon={Network} />
        <NavLink to="/stats" active={pathname === "/stats"} label="학습 통계" icon={BarChart2} />
        <NavLink to="/settings" active={pathname === "/settings"} label="설정" icon={Settings} />
        {activeItems.length > 0 && (
          <div style={{ padding: "8px 16px", fontSize: 12, color: "#ffd54f", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
            생성 중 {activeItems.length}건
          </div>
        )}

        {queueItems.length > 0 && (
          <div style={{ margin: "8px 0", borderTop: "1px solid #2d2d4e", paddingTop: 8 }}>
            <div style={{ padding: "4px 16px 6px", fontSize: 11, color: "#888", fontWeight: 600, letterSpacing: "0.05em" }}>
              📋 학습 큐 ({queueItems.length})
            </div>
            {queueItems.slice(0, 4).map((item) => (
              <div key={item.topicId} style={{ display: "flex", alignItems: "center", padding: "3px 10px 3px 16px", gap: 4 }}>
                <button
                  onClick={() => navigate(`/topics/${item.topicId}/studio`)}
                  style={{
                    flex: 1, background: "none", border: "none", color: "#c5bfff",
                    fontSize: 12, textAlign: "left", cursor: "pointer", padding: "2px 0",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}
                  title={item.title}
                >
                  {item.title}
                </button>
                <button
                  onClick={() => removeItem(item.topicId)}
                  style={{ background: "none", border: "none", color: "#555", cursor: "pointer", fontSize: 12, padding: "2px 4px", flexShrink: 0 }}
                  title="큐에서 제거"
                >×</button>
              </div>
            ))}
            {queueItems.length > 4 && (
              <div style={{ padding: "2px 16px", fontSize: 11, color: "#666" }}>
                +{queueItems.length - 4}개 더...
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: "auto", padding: "12px 16px", fontSize: 12, color: "#888" }}>
          백엔드: <span style={{ color: isConnected ? "#4caf50" : "#ff9800" }}>
            {isConnected ? "연결됨" : "연결 중..."}
          </span>
          {!isConnected && (
            <button
              onClick={() => window.location.reload()}
              style={{
                display: "block",
                marginTop: 6,
                background: "none",
                border: "1px solid #555",
                color: "#ccc",
                borderRadius: 4,
                padding: "3px 8px",
                fontSize: 11,
                cursor: "pointer",
              }}
            >
              재연결
            </button>
          )}
        </div>
      </nav>

      {/* Main content */}
      <main style={{ flex: 1, overflow: "auto", background: "#f5f5f5" }}>
        <Outlet />
      </main>

      <NotificationToast />
    </div>
  );
}

function NavLink({ to, label, active, icon: Icon }: { to: string; label: string; active: boolean; icon: LucideIcon }) {
  return (
    <Link
      to={to}
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 16px",
        color: active ? "#fff" : "#aaa",
        background: active ? "#2d2d4e" : "transparent",
        textDecoration: "none",
        borderLeft: active ? "3px solid #6c63ff" : "3px solid transparent",
        fontSize: 14,
      }}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </Link>
  );
}
