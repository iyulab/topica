import { useRef, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "@iyulab/u-widgets";
import type { UWidgetSpec } from "@iyulab/u-widgets";

interface Props {
  content: string;
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

export default function MarkdownRenderer({ content }: Props) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.8, color: "#333" }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
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
        {content}
      </ReactMarkdown>
    </div>
  );
}
