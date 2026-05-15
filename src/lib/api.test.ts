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
});
