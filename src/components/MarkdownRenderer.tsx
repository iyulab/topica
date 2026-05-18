import { useRef, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "@iyulab/u-widgets";
import type { UWidgetSpec } from "@iyulab/u-widgets";

interface Props {
  content: string;
  topicIndex?: Record<string, string>; // 토픽명 → topicId
}

/** [[TopicName]] 을 markdown 링크 또는 볼드체로 변환. */
export function preprocessWikiLinks(
  content: string,
  topicIndex: Record<string, string>
): string {
  return content.replace(/\[\[([^\]\n]+)\]\]/g, (_, raw: string) => {
    const pipeIdx = raw.indexOf("|");
    const title = (pipeIdx >= 0 ? raw.slice(0, pipeIdx) : raw).trim();
    const display = (pipeIdx >= 0 ? raw.slice(pipeIdx + 1) : raw).trim();
    const id = topicIndex[title];
    return id ? `[${display}](topic:${id})` : `**${display}**`;
  });
}

function WidgetBlock({ code }: { code: string }) {
  const ref = useRef<HTMLElement>(null);

  const spec = useMemo<UWidgetSpec | null>(() => {
    try {
      return JSON.parse(code.trim()) as UWidgetSpec;
    } catch {
      return null;
    }
  }, [code]);

  useEffect(() => {
    if (ref.current && spec) {
      (ref.current as HTMLElement & { spec: UWidgetSpec }).spec = spec;
    }
  }, [spec]);

  if (!spec) {
    return (
      <pre style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, fontSize: 12, overflowX: "auto" }}>
        {code}
      </pre>
    );
  }

  return <div style={{ margin: "12px 0" }}><u-widget ref={ref} /></div>;
}

export default function MarkdownRenderer({ content, topicIndex = {} }: Props) {
  const navigate = useNavigate();

  const processed = useMemo(
    () => preprocessWikiLinks(content, topicIndex),
    [content, topicIndex]
  );

  return (
    <div style={{ fontSize: 14, lineHeight: 1.8, color: "#333" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (href?.startsWith("topic:")) {
              const topicId = href.slice("topic:".length);
              return (
                <button
                  onClick={() => navigate(`/topics/${topicId}/studio`)}
                  style={{
                    color: "#6c63ff",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    textDecoration: "underline",
                    fontWeight: 600,
                    fontSize: "inherit",
                    fontFamily: "inherit",
                  }}
                >
                  {children}
                </button>
              );
            }
            return (
              <a href={href} target="_blank" rel="noopener noreferrer">
                {children}
              </a>
            );
          },
          code(props) {
            const { className, children } = props;
            const langMatch = className?.match(/language-(\w+)/);
            const lang = langMatch?.[1];
            if (lang === "widget") {
              return <WidgetBlock code={String(children)} />;
            }
            return <code className={className}>{children}</code>;
          },
          table(props) {
            return (
              <div style={{ overflowX: "auto", margin: "12px 0" }}>
                <table style={{ borderCollapse: "collapse", width: "100%", fontSize: 13 }} {...props} />
              </div>
            );
          },
          th(props) {
            return <th style={{ border: "1px solid #ddd", padding: "6px 12px", background: "#f5f5f5", textAlign: "left", fontWeight: 600 }} {...props} />;
          },
          td(props) {
            return <td style={{ border: "1px solid #ddd", padding: "6px 12px" }} {...props} />;
          },
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
}
