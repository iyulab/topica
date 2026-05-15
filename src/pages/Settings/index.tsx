import { useEffect, useState } from "react";
import { getSettings, saveSettings, type AiSettings } from "../../lib/api";

function detectOsLanguage(): string {
  const lang = navigator.language || "ko";
  return lang.startsWith("ko") ? "ko" : "en";
}

export default function Settings() {
  const [settings, setSettings] = useState<AiSettings | null>(null);
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [language, setLanguage] = useState<string>(detectOsLanguage());
  const [embeddingModel, setEmbeddingModel] = useState("text-embedding-3-small");
  const [ollamaEndpoint, setOllamaEndpoint] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("");
  const [ollamaEmbeddingModel, setOllamaEmbeddingModel] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings()
      .then((s) => {
        setSettings(s);
        setModel(s.model);
        setLanguage(s.language || detectOsLanguage());
        setEmbeddingModel(s.embeddingModel || "text-embedding-3-small");
        setOllamaEndpoint(s.ollamaEndpoint || "http://localhost:11434");
        setOllamaModel(s.ollamaModel || "");
        setOllamaEmbeddingModel(s.ollamaEmbeddingModel || "");
      })
      .catch(() => setSettings({ model: "gpt-4o-mini", language: detectOsLanguage(), hasApiKey: false, embeddingModel: "text-embedding-3-small", ollamaEndpoint: "http://localhost:11434", ollamaModel: "", ollamaEmbeddingModel: "" }));
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    try {
      await saveSettings(apiKey, model, language, embeddingModel, ollamaEndpoint, ollamaModel, ollamaEmbeddingModel);
      setSettings((s) => s ? { ...s, hasApiKey: !!apiKey || (s.hasApiKey && !apiKey), model, language, embeddingModel, ollamaEndpoint, ollamaModel, ollamaEmbeddingModel } : null);
      setApiKey("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 24px", color: "#222" }}>설정</h2>

      <section style={{ background: "#fff", borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "#333" }}>AI 제공자</h3>

        {settings && !settings.hasApiKey && (
          <div style={{
            background: "#fff3cd",
            border: "1px solid #ffc107",
            borderRadius: 6,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#856404",
          }}>
            ⚠️ API 키가 설정되지 않았습니다. 콘텐츠 생성이 스텁 모드로 실행됩니다.
          </div>
        )}

        {settings?.hasApiKey && (
          <div style={{
            background: "#d4edda",
            border: "1px solid #28a745",
            borderRadius: 6,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: "#155724",
          }}>
            ✓ API 키가 설정되어 있습니다.
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              OpenAI API 키
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings?.hasApiKey ? "새 키 입력 (기존 키 변경 시)" : "sk-..."}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              모델
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
                background: "#fff",
              }}
            >
              <option value="gpt-4o-mini">gpt-4o-mini (권장)</option>
              <option value="gpt-4o">gpt-4o</option>
              <option value="gpt-4-turbo">gpt-4-turbo</option>
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              임베딩 모델
            </label>
            <select
              value={embeddingModel}
              onChange={(e) => setEmbeddingModel(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
                background: "#fff",
              }}
            >
              <option value="text-embedding-3-small">text-embedding-3-small (권장, 저비용)</option>
              <option value="text-embedding-3-large">text-embedding-3-large (고성능)</option>
              <option value="text-embedding-ada-002">text-embedding-ada-002 (구형)</option>
            </select>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#888" }}>
              변경 시 기존 임베딩은 다음 Summary 생성 시 자동 갱신됩니다.
            </p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              프롬프트 언어
              <span style={{ fontWeight: 400, color: "#888", marginLeft: 8, fontSize: 12 }}>
                (OS 기본값: {detectOsLanguage() === "ko" ? "한국어" : "English"})
              </span>
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
                background: "#fff",
              }}
            >
              <option value="ko">한국어 — AI가 한국어 프롬프트로 콘텐츠 생성</option>
              <option value="en">English — AI uses English prompts for content</option>
            </select>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#888" }}>
              영어 프롬프트는 일반적으로 더 풍부한 AI 응답을 생성합니다.
            </p>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "20px 0" }} />

          <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#333" }}>로컬 모델 (Ollama)</h4>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#888" }}>
            API 키 없이 로컬 Ollama 모델을 사용합니다. API 키가 설정된 경우 OpenAI가 우선합니다.
          </p>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              Ollama 엔드포인트
            </label>
            <input
              type="text"
              value={ollamaEndpoint}
              onChange={(e) => setOllamaEndpoint(e.target.value)}
              placeholder="http://localhost:11434"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              Ollama 채팅 모델
            </label>
            <input
              type="text"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder="예: llama3, mistral, gemma3 (비워두면 비활성화)"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              Ollama 임베딩 모델
            </label>
            <input
              type="text"
              value={ollamaEmbeddingModel}
              onChange={(e) => setOllamaEmbeddingModel(e.target.value)}
              placeholder="예: nomic-embed-text, mxbai-embed-large (비워두면 비활성화)"
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #ddd",
                borderRadius: 6,
                fontSize: 14,
                boxSizing: "border-box",
                fontFamily: "monospace",
              }}
            />
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#888" }}>
              API 키가 없을 때 임베딩(RAG 검색·토픽 유사도)에 사용됩니다.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving}
            style={{
              background: saving ? "#9e97e8" : "#6c63ff",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: saving ? "not-allowed" : "pointer",
            }}
          >
            {saving ? "저장 중..." : "저장"}
          </button>

          {saved && (
            <span style={{ marginLeft: 12, fontSize: 13, color: "#28a745" }}>
              ✓ 저장되었습니다 (즉시 적용됨)
            </span>
          )}
        </form>
      </section>
    </div>
  );
}
