import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn().mockResolvedValue(5174),
}));

describe("api.ts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("checkHealth returns true when backend returns ok", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: "ok" }),
    });

    const { checkHealth } = await import("./api");
    const result = await checkHealth();
    expect(result).toBe(true);
  });

  it("checkHealth returns false on network error", async () => {
    globalThis.fetch = vi.fn().mockRejectedValueOnce(new Error("Network error"));

    const { checkHealth } = await import("./api");
    const result = await checkHealth();
    expect(result).toBe(false);
  });

  it("saveSettings returns reindexRequired from response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "ok", reindexRequired: true }),
    });

    const { saveSettings } = await import("./api");
    const result = await saveSettings("", "gpt-4o-mini", "ko", "text-embedding-3-small", 1536, "http://localhost:11434", "", "nomic-embed-text");
    expect(result.reindexRequired).toBe(true);
  });

  it("detectOllamaEmbeddingDimension returns dimension from response", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ dimension: 768 }),
    });

    const { detectOllamaEmbeddingDimension } = await import("./api");
    const dim = await detectOllamaEmbeddingDimension("http://localhost:11434", "nomic-embed-text");
    expect(dim).toBe(768);
  });

  it("getSettings returns chatProvider and embeddingProvider fields", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hasApiKey: false,
        model: "gpt-4o-mini",
        language: "ko",
        embeddingModel: "text-embedding-3-small",
        embeddingDimension: 1536,
        ollamaEndpoint: "http://localhost:11434",
        ollamaModel: "",
        ollamaEmbeddingModel: "",
        chatProvider: "local",
        embeddingProvider: "local",
      }),
    });

    const { getSettings } = await import("./api");
    const settings = await getSettings();
    expect(settings.chatProvider).toBe("local");
    expect(settings.embeddingProvider).toBe("local");
    expect(settings.hasApiKey).toBe(false);
  });

  it("triggerReindex returns counts", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({ message: "재색인 완료", topicsReindexed: 3, ragReindexed: 2 }),
    });

    const { triggerReindex } = await import("./api");
    const result = await triggerReindex();
    expect(result.topicsReindexed).toBe(3);
    expect(result.ragReindexed).toBe(2);
  });

  it("getSettings chatProvider is openai when api key is set", async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        hasApiKey: true,
        model: "gpt-4o-mini",
        language: "ko",
        embeddingModel: "text-embedding-3-small",
        embeddingDimension: 1536,
        ollamaEndpoint: "http://localhost:11434",
        ollamaModel: "",
        ollamaEmbeddingModel: "",
        chatProvider: "openai",
        embeddingProvider: "openai",
      }),
    });

    const { getSettings } = await import("./api");
    const settings = await getSettings();
    expect(settings.chatProvider).toBe("openai");
    expect(settings.embeddingProvider).toBe("openai");
    expect(settings.hasApiKey).toBe(true);
  });
});
