import { invoke } from "@tauri-apps/api/core";

let baseUrl: string | null = null;

async function getBaseUrl(): Promise<string> {
  if (baseUrl) return baseUrl;
  const port: number = await invoke("get_backend_port");
  baseUrl = `http://127.0.0.1:${port}`;
  return baseUrl;
}

export async function apiGet<T>(path: string): Promise<T> {
  const url = await getBaseUrl();
  const res = await fetch(`${url}${path}`);
  if (!res.ok) throw new Error(`GET ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const url = await getBaseUrl();
  const res = await fetch(`${url}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} failed: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const data = await apiGet<{ status: string }>("/health");
    return data.status === "ok";
  } catch {
    return false;
  }
}
