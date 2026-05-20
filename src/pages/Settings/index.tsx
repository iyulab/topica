import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import i18n from "../../lib/i18n";
import { getSettings, saveSettings, detectOllamaEmbeddingDimension, triggerReindex, type AiSettings } from "../../lib/api";

function providerLabel(provider: string): string {
  switch (provider) {
    case "openai": return "OpenAI";
    case "ollama": return "OpenAI 호환 서버";
    case "local": return "lm-supply (로컬)";
    default: return provider;
  }
}

function detectOsLanguage(): string {
  const lang = navigator.language || "ko";
  return lang.startsWith("ko") ? "ko" : "en";
}

export default function Settings() {
  const { t } = useTranslation();
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
        const lang = s.language || detectOsLanguage();
        i18n.changeLanguage(lang);
        setSettings(s);
        setModel(s.model);
        setLanguage(lang);
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
      i18n.changeLanguage(language);
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
      setSaveError(t('settings.save.error'));
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
      <h2 style={{ margin: "0 0 24px", color: "#222" }}>{t('settings.title')}</h2>

      {settings && (
        <div style={{
          background: isFullyLocal ? "#f0eeff" : "#f5f5f5",
          border: `1px solid ${isFullyLocal ? "#d0c8ff" : "#e0e0e0"}`,
          borderRadius: 8,
          padding: "12px 16px",
          marginBottom: 16,
          fontSize: 13,
        }}>
          <div style={{
            fontWeight: 600,
            color: isFullyLocal ? "#4338ca" : "#595959",
            marginBottom: 4,
          }}>
            {isFullyLocal ? t('settings.local.active') : t('settings.local.external')}
          </div>
          <div style={{ color: "#595959", fontSize: 12 }}>
            {t('settings.chat.provider')} <strong>{providerLabel(settings.chatProvider)}</strong>　{t('settings.embedding.provider')} <strong>{providerLabel(settings.embeddingProvider)}</strong>
          </div>
          {isLocalModelLoading && (
            <div style={{ color: "#9e97e8", fontSize: 12, marginTop: 6, display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ display: "inline-block", width: 10, height: 10, borderRadius: "50%", border: "2px solid #9e97e8", borderTopColor: "transparent", animation: "spin 1s linear infinite" }} />
              {t('settings.local.loading')}
            </div>
          )}
          {isLocalModelReady && (
            <div style={{ color: "#28a745", fontSize: 12, marginTop: 6 }}>
              {t('settings.local.ready')}
            </div>
          )}
          {isLocalModelFailed && (
            <div style={{ color: "#dc3545", fontSize: 12, marginTop: 6 }}>
              {t('settings.local.failed')}
            </div>
          )}
          <div style={{ color: "#595959", fontSize: 11, marginTop: 4 }}>
            {t('settings.local.provider.hint')}
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
              <strong>{t('settings.reindex.warning')}</strong><br />
              {t('settings.reindex.detail')}
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
                  {reindexing ? t('settings.reindex.running') : t('settings.reindex.run')}
                </button>
                <button
                  onClick={() => setReindexRequired(false)}
                  style={{ background: "none", border: "none", color: "#856404", cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 }}
                >
                  {t('settings.reindex.later')}
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
          <span>{t('settings.reindex.done', { topics: reindexDone.topicsReindexed, rag: reindexDone.ragReindexed })}</span>
          <button
            onClick={() => setReindexDone(null)}
            style={{ background: "none", border: "none", color: "#155724", cursor: "pointer", fontSize: 12, textDecoration: "underline", padding: 0 }}
          >
            {t('settings.reindex.close')}
          </button>
        </div>
      )}

      <section style={{ background: "#fff", borderRadius: 8, padding: 24, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 24 }}>
        <h3 style={{ margin: "0 0 16px", fontSize: 16, color: "#333" }}>{t('settings.provider')}</h3>

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
            {t('settings.apikey.missing')}
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
            {t('settings.apikey.set')}
          </div>
        )}

        <form onSubmit={handleSave}>
          <div style={{ marginBottom: 16 }}>
            <label htmlFor="openai-api-key" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              {t('settings.apikey.label')}
            </label>
            <input
              id="openai-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={settings?.hasApiKey ? t('settings.apikey.placeholder.change') : t('settings.apikey.placeholder.new')}
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
            <label htmlFor="openai-model" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              {t('settings.model.label')}
            </label>
            <select
              id="openai-model"
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
            <label htmlFor="embedding-model" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              {t('settings.embedding.label')}
            </label>
            <select
              id="embedding-model"
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
              {t('settings.embedding.hint')}
            </p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="prompt-language" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              {t('settings.language')}
              <span style={{ fontWeight: 400, color: "#888", marginLeft: 8, fontSize: 12 }}>
                ({t('settings.language.os')} {detectOsLanguage() === "ko" ? "한국어" : "English"})
              </span>
            </label>
            <select
              id="prompt-language"
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
              <option value="ko">{t('settings.language.ko')}</option>
              <option value="en">{t('settings.language.en')}</option>
            </select>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#888" }}>
              {t('settings.language.hint')}
            </p>
          </div>

          <hr style={{ border: "none", borderTop: "1px solid #f0f0f0", margin: "20px 0" }} />

          <h4 style={{ margin: "0 0 12px", fontSize: 14, color: "#333" }}>{t('settings.ollama.section')}</h4>
          <p style={{ margin: "0 0 12px", fontSize: 12, color: "#888" }}>
            {t('settings.ollama.hint')}
          </p>

          <div style={{ marginBottom: 16 }}>
            <label htmlFor="ollama-endpoint" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              {t('settings.ollama.endpoint.label')}
            </label>
            <input
              id="ollama-endpoint"
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
            <label htmlFor="ollama-api-key" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              {t('settings.ollama.apikey.label')}
            </label>
            <input
              id="ollama-api-key"
              type="password"
              value={ollamaApiKey}
              onChange={(e) => setOllamaApiKey(e.target.value)}
              placeholder={t('settings.ollama.apikey.placeholder')}
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
            <label htmlFor="ollama-chat-model" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              {t('settings.ollama.chat.label')}
            </label>
            <input
              id="ollama-chat-model"
              type="text"
              value={ollamaModel}
              onChange={(e) => setOllamaModel(e.target.value)}
              placeholder={t('settings.ollama.chat.placeholder')}
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
            <label htmlFor="ollama-embedding-model" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              {t('settings.ollama.embedding.label')}
            </label>
            <input
              id="ollama-embedding-model"
              type="text"
              value={ollamaEmbeddingModel}
              onChange={(e) => { setOllamaEmbeddingModel(e.target.value); setDetectError(null); }}
              placeholder={t('settings.ollama.embedding.placeholder')}
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
              {t('settings.ollama.embedding.hint')}
            </p>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label htmlFor="embedding-dim" style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#555", marginBottom: 6 }}>
              {t('settings.dim.label')}
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
                    setDetectError(e instanceof Error ? e.message : t('settings.dim.detecting'));
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
                {detectingDim ? t('settings.dim.detecting') : t('settings.dim.detect')}
              </button>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "#888" }}>
              {t('settings.dim.hint')}
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
            {saving ? t('settings.saving') : t('settings.save')}
          </button>

          {saved && (
            <span role="status" style={{ marginLeft: 12, fontSize: 13, color: "#28a745" }}>
              {t('settings.saved')}
            </span>
          )}
          {saveError && (
            <span role="alert" style={{ marginLeft: 12, fontSize: 13, color: "#e53935" }}>
              ⚠ {saveError}
            </span>
          )}
        </form>
      </section>
    </div>
  );
}
