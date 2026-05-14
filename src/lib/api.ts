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

export async function apiDelete(path: string): Promise<void> {
  const url = await getBaseUrl();
  const res = await fetch(`${url}${path}`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) throw new Error(`DELETE ${path} failed: ${res.status}`);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const data = await apiGet<{ status: string }>("/health");
    return data.status === "ok";
  } catch {
    return false;
  }
}

// --- Topic API ---

export interface Topic {
  id: string;
  title: string;
  description: string;
  userLevel: number;
  createdAt: string;
  updatedAt: string;
}

export async function getTopics(): Promise<Topic[]> {
  return apiGet<Topic[]>("/topics");
}

export async function createTopic(title: string, userLevel: number): Promise<Topic> {
  return apiPost<Topic>("/topics", { title, userLevel });
}

export async function deleteTopic(id: string): Promise<void> {
  return apiDelete(`/topics/${id}`);
}

// --- Content API ---

export interface Content {
  id: string;
  topicId: string;
  type: number;
  level: number;
  body: string;
  status: number;
  generatedAt: string;
}

export async function getContents(topicId: string): Promise<Content[]> {
  return apiGet<Content[]>(`/topics/${topicId}/contents`);
}

export async function generateContent(topicId: string, type: number, level: number): Promise<Content> {
  return apiPost<Content>(`/topics/${topicId}/contents/generate`, { type, level });
}

// --- Settings API ---

export interface AiSettings {
  model: string;
  language: string;
  hasApiKey: boolean;
}

export async function getSettings(): Promise<AiSettings> {
  return apiGet<AiSettings>("/settings");
}

export async function saveSettings(apiKey: string, model: string, language: string): Promise<void> {
  await apiPost("/settings", { apiKey, model, language });
}

// --- Chat API ---

export interface ChatMessage {
  id: string;
  topicId: string;
  role: number; // 0=User, 1=Assistant
  message: string;
  createdAt: string;
}

export async function getChatHistory(topicId: string): Promise<ChatMessage[]> {
  return apiGet<ChatMessage[]>(`/topics/${topicId}/chat`);
}

export async function sendChatMessage(topicId: string, message: string): Promise<ChatMessage> {
  return apiPost<ChatMessage>(`/topics/${topicId}/chat`, { message });
}

export async function clearChatHistory(topicId: string): Promise<void> {
  return apiDelete(`/topics/${topicId}/chat`);
}
