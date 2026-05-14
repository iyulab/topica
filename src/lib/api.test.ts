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
});
