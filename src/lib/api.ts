import { invoke } from "@tauri-apps/api/core";

let baseUrl: string | null = null;

async function getBaseUrl(): Promise<string> {
  if (baseUrl) return baseUrl;
  try {
    const port: number = await invoke("get_backend_port");
    baseUrl = `http://127.0.0.1:${port}`;
  } catch {
    const port = import.meta.env.VITE_BACKEND_PORT ?? "5174";
    baseUrl = `http://127.0.0.1:${port}`;
  }
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

export async function apiPut<T>(path: string, body: unknown): Promise<T> {
  const url = await getBaseUrl();
  const res = await fetch(`${url}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PUT ${path} failed: ${res.status}`);
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
  tags?: string[];
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
  embeddingModel: string;
  embeddingDimension: number;
  ollamaEndpoint: string;
  ollamaModel: string;
  ollamaEmbeddingModel: string;
  chatProvider: "local" | "ollama" | "openai";
  embeddingProvider: "local" | "ollama" | "openai";
  localChatLoading?: boolean;
  localChatReady?: boolean;
  localChatFailed?: boolean;
  localEmbeddingLoading?: boolean;
  localEmbeddingReady?: boolean;
  localEmbeddingFailed?: boolean;
}

export async function getSettings(): Promise<AiSettings> {
  return apiGet<AiSettings>("/settings");
}

export async function saveSettings(
  apiKey: string,
  model: string,
  language: string,
  embeddingModel: string,
  embeddingDimension: number,
  ollamaEndpoint: string,
  ollamaModel: string,
  ollamaEmbeddingModel: string,
  ollamaApiKey: string
): Promise<{ reindexRequired: boolean }> {
  return apiPut<{ message: string; reindexRequired: boolean }>(
    "/settings",
    { apiKey, model, language, embeddingModel, embeddingDimension, ollamaEndpoint, ollamaModel, ollamaEmbeddingModel, ollamaApiKey }
  );
}

export async function triggerReindex(): Promise<{ topicsReindexed: number; ragReindexed: number }> {
  return apiPost<{ message: string; topicsReindexed: number; ragReindexed: number }>("/settings/reindex");
}

export async function detectOllamaEmbeddingDimension(endpoint: string, model: string): Promise<number> {
  const params = new URLSearchParams({ endpoint, model });
  const result = await apiGet<{ dimension: number }>(`/ollama/embedding-dimension?${params}`);
  return result.dimension;
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

export async function* streamChatMessage(
  topicId: string,
  message: string,
  signal?: AbortSignal
): AsyncGenerator<{ delta?: string; done?: boolean; msg?: ChatMessage }> {
  const url = await getBaseUrl();
  const res = await fetch(`${url}/topics/${topicId}/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Chat stream failed: ${res.status}`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const data = line.replace(/^data: /, "").trim();
      if (!data) continue;
      try {
        const parsed = JSON.parse(data) as { delta?: string; done?: boolean; message?: ChatMessage };
        if (parsed.done) {
          yield { done: true, msg: parsed.message };
          return;
        }
        if (parsed.delta) yield { delta: parsed.delta };
      } catch {
        // ignore malformed
      }
    }
  }
}

// --- Survey API ---

export async function* surveyStream(topicId: string, signal?: AbortSignal): AsyncGenerator<string> {
  const url = await getBaseUrl();
  const res = await fetch(`${url}/topics/${topicId}/survey`, { signal });
  if (!res.ok || !res.body) throw new Error("Survey stream failed");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split("\n\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const data = line.replace(/^data: /, "").trim();
      if (!data) continue;
      try {
        const parsed = JSON.parse(data) as { question?: string; done?: boolean };
        if (parsed.done) return;
        if (parsed.question) yield parsed.question;
      } catch {
        // ignore malformed
      }
    }
  }
}

export async function saveSurveyAnswers(topicId: string, answers: string[]): Promise<void> {
  await apiPost(`/topics/${topicId}/survey/answers`, { answers });
}

// --- Eval API ---

export interface EvalResult {
  newLevel: number;
  levelChanged: boolean;
}

export async function submitEval(
  topicId: string,
  contentId: string,
  score: number,
  total: number
): Promise<EvalResult> {
  return apiPost<EvalResult>(`/topics/${topicId}/eval`, { contentId, score, total });
}

export interface LevelRecommendation {
  recommendedLevel: number;
  hasHistory: boolean;
  avgScore: number | null;
  reason: string;
}

export async function getLevelRecommendation(topicId: string): Promise<LevelRecommendation> {
  return apiGet<LevelRecommendation>(`/topics/${topicId}/eval/recommendation`);
}

// --- Tag API ---

export async function getTags(topicId: string): Promise<string[]> {
  return apiGet<string[]>(`/topics/${topicId}/tags`);
}

// --- Graph API ---

export interface RelatedTopic {
  id: string;
  score: number;
  topic: Topic;
}

export async function getRelatedTopics(topicId: string): Promise<RelatedTopic[]> {
  return apiGet<RelatedTopic[]>(`/topics/${topicId}/related`);
}

export async function getSuggestedNextTopics(topicId: string): Promise<string[]> {
  return apiGet<string[]>(`/topics/${topicId}/suggested-next`);
}

export interface WikiLinkGraph {
  existing: { id: string; title: string }[];
  missing: string[];
}

export async function getWikiLinks(topicId: string): Promise<WikiLinkGraph> {
  return apiGet<WikiLinkGraph>(`/topics/${topicId}/wiki-links`);
}

// --- Learning Session API ---

export interface LearningStats {
  totalTopicsStudied: number;
  totalStudyMinutes: number;
  todaySessionCount: number;
  streak7d: number[];
  scoreByTopic: { title: string; avgScore: number }[];
}

export async function postLearningSession(
  topicId: string,
  durationSeconds: number,
  quizScore: number | null,
  flashcardsStudied: number
): Promise<void> {
  await apiPost("/learning-sessions", { topicId, durationSeconds, quizScore, flashcardsStudied });
}

export async function getLearningStats(): Promise<LearningStats> {
  return apiGet<LearningStats>("/learning-sessions/stats");
}

export interface PathSuggestion {
  id: string;
  title: string;
}

export async function getPathSuggestions(): Promise<PathSuggestion[]> {
  return apiGet<PathSuggestion[]>("/learning-sessions/path-suggestions");
}

export interface LearningGraphData {
  nodes: { id: string; title: string; studied: boolean }[];
  edges: { source: string; target: string }[];
}

export async function getLearningGraphData(): Promise<LearningGraphData> {
  return apiGet<LearningGraphData>("/learning-sessions/graph-data");
}
