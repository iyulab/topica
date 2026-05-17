import { useEffect, useRef, useState } from "react";
import { getChatHistory, sendChatMessage, clearChatHistory, type ChatMessage } from "../lib/api";
import MarkdownRenderer from "./MarkdownRenderer";

interface Props {
  topicId: string;
}

export default function ChatPanel({ topicId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getChatHistory(topicId)
      .then(setMessages)
      .finally(() => setLoading(false));
  }, [topicId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const optimistic: ChatMessage = {
      id: `tmp-${Date.now()}`,
      topicId,
      role: 0,
      message: text,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);
    setInput("");
    setSending(true);

    try {
      const response = await sendChatMessage(topicId, text);
      setMessages((prev) => [...prev, response]);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== optimistic.id));
      setInput(text);
    } finally {
      setSending(false);
    }
  };

  const handleClear = async () => {
    if (!confirm("대화 내용을 모두 삭제하시겠습니까?")) return;
    await clearChatHistory(topicId);
    setMessages([]);
  };

  if (loading) return <div style={{ padding: 20, color: "#aaa", fontSize: 13 }}>대화 내역 불러오는 중...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: 500 }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 8 }}>
        {messages.length > 0 && (
          <button
            onClick={handleClear}
            style={{ fontSize: 12, color: "#999", background: "none", border: "none", cursor: "pointer" }}
          >
            대화 초기화
          </button>
        )}
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, paddingBottom: 12 }}>
        {messages.length === 0 && (
          <div style={{ textAlign: "center", color: "#bbb", fontSize: 13, padding: "40px 0" }}>
            이 토픽에 대해 무엇이든 물어보세요.
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            style={{
              display: "flex",
              justifyContent: msg.role === 0 ? "flex-end" : "flex-start",
            }}
          >
            <div style={{
              maxWidth: "80%",
              padding: "10px 14px",
              borderRadius: msg.role === 0 ? "12px 12px 4px 12px" : "12px 12px 12px 4px",
              background: msg.role === 0 ? "#6c63ff" : "#f0f0f0",
              color: msg.role === 0 ? "#fff" : "#222",
              fontSize: 14,
              lineHeight: 1.5,
              animation: "chat-msg-enter 0.2s ease-out",
            }}>
              {msg.role === 1 ? (
                <div style={{ color: "#222" }}>
                  <MarkdownRenderer content={msg.message} />
                </div>
              ) : (
                msg.message
              )}
            </div>
          </div>
        ))}
        {sending && (
          <div style={{ display: "flex", justifyContent: "flex-start" }}>
            <div style={{
              padding: "10px 14px",
              borderRadius: "12px 12px 12px 4px",
              background: "#f0f0f0",
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}>
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: "#999",
                    display: "inline-block",
                    animation: `typing-dot 1.2s ease-in-out ${i * 0.2}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div style={{ display: "flex", gap: 8, borderTop: "1px solid #eee", paddingTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="질문을 입력하세요... (Enter로 전송)"
          disabled={sending}
          style={{
            flex: 1,
            padding: "10px 12px",
            border: "1px solid #ddd",
            borderRadius: 8,
            fontSize: 14,
            outline: "none",
          }}
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || sending}
          style={{
            padding: "10px 16px",
            background: !input.trim() || sending ? "#ccc" : "#6c63ff",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: !input.trim() || sending ? "not-allowed" : "pointer",
            fontSize: 14,
            fontWeight: 600,
          }}
        >
          전송
        </button>
      </div>
    </div>
  );
}
