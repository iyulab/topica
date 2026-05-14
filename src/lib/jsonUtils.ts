// Extracts JSON from AI responses that may wrap it in markdown code blocks.
export function extractJson<T>(text: string): T | null {
  const trimmed = text.trim();
  const codeBlockMatch = trimmed.match(/```(?:json)?\n?([\s\S]*?)\n?```/);
  const jsonText = codeBlockMatch ? codeBlockMatch[1].trim() : trimmed;
  try {
    return JSON.parse(jsonText) as T;
  } catch {
    return null;
  }
}
