import { Link, Outlet, useLocation } from "react-router-dom";
import { useAppStore, useQueueStore } from "../lib/store";
import NotificationToast from "../components/NotificationToast";

export default function Layout() {
  const { isConnected } = useAppStore();
  const { activeItems } = useQueueStore();
  const { pathname } = useLocation();

  return (
    <div style={{ display: "flex", height: "100vh", fontFamily: "system-ui, sans-serif" }}>
      {/* Sidebar */}
      <nav style={{
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
        <NavLink to="/" active={pathname === "/"} label="토픽 목록" />
        <NavLink to="/settings" active={pathname === "/settings"} label="설정" />
        {activeItems.length > 0 && (
          <div style={{ padding: "8px 16px", fontSize: 12, color: "#ffd54f", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⏳</span>
            생성 중 {activeItems.length}건
          </div>
        )}
        <div style={{ marginTop: "auto", padding: "12px 16px", fontSize: 12, color: "#888" }}>
          백엔드: <span style={{ color: isConnected ? "#4caf50" : "#ff9800" }}>
            {isConnected ? "연결됨" : "연결 중..."}
          </span>
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

function NavLink({ to, label, active }: { to: string; label: string; active: boolean }) {
  return (
    <Link
      to={to}
      style={{
        display: "block",
        padding: "8px 16px",
        color: active ? "#fff" : "#aaa",
        background: active ? "#2d2d4e" : "transparent",
        textDecoration: "none",
        borderLeft: active ? "3px solid #6c63ff" : "3px solid transparent",
        fontSize: 14,
      }}
    >
      {label}
    </Link>
  );
}
