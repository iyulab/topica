import { useEffect } from "react";
import { checkHealth } from "./lib/api";
import { topicaWs } from "./lib/ws";
import { useAppStore } from "./lib/store";

export default function App() {
  const { isConnected, setConnected } = useAppStore();

  useEffect(() => {
    const init = async () => {
      // Wait for sidecar to start (up to 5 seconds)
      for (let i = 0; i < 10; i++) {
        const ok = await checkHealth();
        if (ok) {
          await topicaWs.connect();
          setConnected(true);
          return;
        }
        await new Promise((r) => setTimeout(r, 500));
      }
    };
    init();
    return () => topicaWs.close();
  }, [setConnected]);

  return (
    <div style={{ padding: 32, fontFamily: "sans-serif" }}>
      <h1>Topica</h1>
      <p>
        Backend:{" "}
        <span style={{ color: isConnected ? "green" : "orange" }}>
          {isConnected ? "Connected" : "Connecting..."}
        </span>
      </p>
    </div>
  );
}
