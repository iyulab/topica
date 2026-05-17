import { useEffect, useRef, useState } from "react";
import { getSettings, saveSettings, detectOllamaEmbeddingDimension, triggerReindex, type AiSettings } from "../../lib/api";

function providerLabel(provider: string): string {
  switch (provider) {
    case "openai": return "OpenAI";
    case "ollama": return "Ollama (로컬)";
    case "local": return "lm-supply (로컬)";
    default: return provider;
  }
}

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
  const [embeddingDimension, setEmbeddingDimension] = useState(1536);
  const [ollamaEndpoint, setOllamaEndpoint] = useState("http://localhost:11434");
  const [ollamaModel, setOllamaModel] = useState("");
  const [ollamaEmbeddingModel, setOllamaEmbeddingModel] = useState("");
  const [ollamaApiKey, setOllamaApiKey] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reindexRequired, setReindexRequired] = useState(false);
  const [reindexing, setReindexing] = useState(false);
  const [reindexDone, setReindexDone] = useState<{ topicsReindexed: number; ragReindexed: number } | null>(null);
  const [detectingDim, setDetectingDim] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveButtonRef = useRef<HTMLButtonElement>(null);

  const loadSettings = () =>
    getSettings()
      .then((s) => {
        setSettings(s);
        setModel(s.model);
        setLanguage(s.language || detectOsLanguage());
        setEmbeddingModel(s.embeddingModel || "text-embedding-3-small");
        setEmbeddingDimension(s.embeddingDimension || 1536);
        setOllamaEndpoint(s.ollamaEndpoint || "http://localhost:11434");
        setOllamaModel(s.ollamaModel || "");
        setOllamaEmbeddingModel(s.ollamaEmbeddingModel || "");
        return s;
      })
      .catch(() => {
        const fallback: AiSettings = {
          model: "gpt-4o-mini",
          language: detectOsLanguage(),
          hasApiKey: false,
          embeddingModel: "text-embedding-3-small",
          embeddingDimension: 1536,
          ollamaEndpoint: "http://localhost:11434",
          ollamaModel: "",
          ollamaEmbeddingModel: "",
          chatProvider: "local",
          embeddingProvider: "local",
        };
        setSettings(fallback);
        return fallback;
      });

  useEffect(() => {
    loadSettings();
  }, []);

  // Poll model status while local models are loading
  useEffect(() => {
    if (!settings) return;
    const isLocalProvider = settings.chatProvider === "local" || settings.embeddingProvider === "local";
    const isStillLoading = settings.localChatLoading || settings.localEmbeddingLoading;
    if (!isLocalProvider || !isStillLoading) return;

    const id = setInterval(() => {
      getSettings().then((s) => setSettings((prev) => prev ? { ...prev, ...s } : s));
    }, 3000);
    return () => clearInterval(id);
  }, [settings?.localChatLoading, settings?.localEmbeddingLoading, settings?.chatProvider, settings?.embeddingProvider]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setSaveError(null);
    try {
      const result = await saveSettings(apiKey, model, language, embeddingModel, embeddingDimension, ollamaEndpoint, ollamaModel, ollamaEmbeddingModel, ollamaApiKey);
      setSettings((s) => {
        if (!s) return null;
        const newHasApiKey = !!apiKey || (s.hasApiKey && !apiKey);
        const newChatProvider: "openai" | "ollama" | "local" =
          newHasApiKey ? "openai" : ollamaModel ? "ollama" : "local";
        const newEmbeddingProvider: "openai" | "ollama" | "local" =
          newHasApiKey ? "openai" : ollamaEmbeddingModel ? "ollama" : "local";
        return {
          ...s,
          hasApiKey: newHasApiKey,
          model, language, embeddingModel, embeddingDimension,
          ollamaEndpoint, ollamaModel, ollamaEmbeddingModel,
          chatProvider: newChatProvider,
          embeddingProvider: newEmbeddingProvider,
        };
      });
      setApiKey("");
      setSaved(true);
      setReindexRequired(result.reindexRequired);
      setTimeout(() => setSaved(false), 3000);
      saveButtonRef.current?.focus();
    } catch {
      setSaveError("저장에 실패했습니다. 백엔드 연결을 확인하세요.");
    } finally {
      setSaving(false);
    }
  };

  const isFullyLocal = !!settings && settings.chatProvider === "local" && settings.embeddingProvider === "local";
  const isLocalModelLoading = isFullyLocal && (settings.localChatLoading || settings.localEmbeddingLoading);
  const isLocalModelReady = isFullyLocal && settings.localChatReady && settings.localEmbeddingReady;
  const isLocalModelFailed = isFullyLocal && (settings.localChatFailed || settings.localEmbeddingFailed);

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "0 auto" }}>
      <h2 style={{ margin: "0 0 24px", color: "#222" }}>설정</h2>

      {settings && (
        <div style={{
          background: isFullyLocal
            ? "#f0eeff"
            : "#f5f5f5",
          border: `1px solid ${
            isFullyLocal
              ? "#d0c8ff"
              : "#e0e0e0"
          }`,
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
          fontSize: 13,
        }}>
          <div style={{
            fontWeight: 600,
            color: isFullyLocal
              ? "#4338ca"
              : "#595959",
            marginBottom: 4,
          }}>
            {isFullyLocal
              ? "✦ 로컬 AI 활성 (자동 선택)"
              : "● 외부 AI 제공자 사용 중"}
          </div>
          <div style={{ color: "#595959", fontSize: 12 }}>
            채팅: <strong>{providerLabel(settings.chatProvider)}</strong>　임베딩: <strong>{providerLabel(settings.embeddingProvider)}</strong>
          </div>
          {isLocalModelLoading && (
            <div style={{ color: "#9e97e8", fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: "2px solid #9e97e8", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
              로컬 모델 로딩 중... (초기 실행 시 다운로드 시간이 필요합니다)
            </div>
          )}
          {isLocalModelReady && (
            <div style={{ color: "#28a745", fontSize: 12, marginTop: 6 }}>
              ✓ 로컬 모델 준비 완료
            </div>
          )}
          {isLocalModelFailed && (
            <div style={{ color: "#dc3545", fontSize: 12, marginTop: 6 }}>
              ⚠ 로컬 모델 로드 실패 — 로그를 확인하세요
            </div>
          )}
          <div style={{ color: "#595959", fontSize: 11, marginTop: 4 }}>
            API 키 또는 Ollama 설정 시 해당 제공자가 우선 적용됩니다.
          </div>
        </div>
      )}

      {reindexRequired && (
        <div style={{
          background: "#fff3cd",
          border: "1px solid #ffc107",
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
          fontSize: 13,
          color: "#856404",
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <strong>임베딩 모델 또는 차원이 변경되었습니다.</strong><br />
              기존 임베딩 데이터와 차원이 달라 RAG 검색 및 토픽 유사도 결과가 부정확할 수 있습니다.
              <div style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center" }}>
                <button
                  disabled={reindexing}
                  onClick={async () => {
                    setReindexing(true);
                    setReindexDone(null);
                    try {
                      const result = await triggerReindex();
                      setReindexDone(result);
                      setReindexRequired(false);
                    } finally {
                      setReindexing(false);
                    }
                  }}
                  style={{
                    background: reindexing ? "#e6c87a" : "#ffc107",
                    color: "#856404",
                    border: "1px solid #d4a017",
                    borderRadius: 6,
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: reindexing ? "not-allowed" : "pointer",
                  }}
                >
                  {reindexing ? "재색인 중..." : "재색인 실행"}
                </button>
                <button
                  onClick={() => setReindexRequired(false)}
                  style={{ background: "none", border: "none", color: "#856404", cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 }}
                >
                  나중에
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {reindexDone && (
        <div style={{
          background: "#d4edda",
          border: "1px solid #28a745",
          borderRadius: 8,
          padding: "10px 16px",
          marginBottom: 16,
          fontSize: 13,
          color: "#155724",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}>
          <span>✓ 재색인 완료 — 토픽 {reindexDone.topicsReindexed}개, RAG {reindexDone.ragReindexed}개 갱신</span>
          <button
            onClick={() => setReindexDone(null)}
            style={{ background: "none", border: "none", color: "#155724", cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 }}
          >
            닫기
          </button>
        </div>
      )}

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
            ⚠️ API 키가 설정되지 않았습니다. 로컬 AI(자동 선택)로 콘텐츠를 생성합니다. 초기 모델 다운로드 시 시간이 걸릴 수 있습니다.
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
              API 키 (선택)
            </label>
            <input
              type="password"
              value={ollamaApiKey}
              onChange={(e) => setOllamaApiKey(e.target.value)}
              placeholder="인증이 필요한 경우 입력 (예: GPUStack, LM Studio)"
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

          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              Ollama 임베딩 모델
            </label>
            <input
              type="text"
              value={ollamaEmbeddingModel}
              onChange={(e) => { setOllamaEmbeddingModel(e.target.value); setDetectError(null); }}
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

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="embedding-dim" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              임베딩 차원 수
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                id="embedding-dim"
                type="number"
                value={embeddingDimension}
                onChange={(e) => setEmbeddingDimension(parseInt(e.target.value, 10) || 1536)}
                min={64}
                max={8192}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid #ddd",
                  borderRadius: 6,
                  fontSize: 14,
                  boxSizing: "border-box",
                }}
              />
              <button
                type="button"
                disabled={detectingDim || !ollamaEmbeddingModel}
                onClick={async () => {
                  setDetectingDim(true);
                  setDetectError(null);
                  try {
                    const dim = await detectOllamaEmbeddingDimension(ollamaEndpoint, ollamaEmbeddingModel);
                    setEmbeddingDimension(dim);
                  } catch (e) {
                    setDetectError(e instanceof Error ? e.message : "차원 감지 실패");
                  } finally {
                    setDetectingDim(false);
                  }
                }}
                style={{
                  padding: "8px 14px",
                  background: detectingDim || !ollamaEmbeddingModel ? "#ccc" : "#6c63ff",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  fontSize: 13,
                  cursor: detectingDim || !ollamaEmbeddingModel ? "not-allowed" : "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {detectingDim ? "감지 중..." : "자동 감지"}
              </button>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#888" }}>
              OpenAI text-embedding-3-small: 1536 / nomic-embed-text: 768 / mxbai-embed-large: 1024
            </p>
            {detectError && (
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "#dc3545" }}>
                ⚠ {detectError}
              </p>
            )}
          </div>

          <button
            ref={saveButtonRef}
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
          {saveError && (
            <span style={{ marginLeft: 12, fontSize: 13, color: "#e53935" }}>
              ⚠ {saveError}
            </span>
          )}
        </form>
      </section>
    </div>
  );
}
