import { useEffect, useRef, useState } from "react";

interface Props {
  body: string;
}

export default function MindmapViewer({ body }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isLegacyJson = body.trim().startsWith("{");

  useEffect(() => {
    if (isLegacyJson) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    import("@iyulab/declart")
      .then(({ render }) => {
        if (cancelled) return;
        if (!containerRef.current) return;
        try {
          const doc = new DOMParser().parseFromString(render(body), "image/svg+xml");
          const parseError = doc.querySelector("parsererror");
          if (parseError) throw new Error("SVG 파싱 실패: " + (parseError.textContent?.slice(0, 100) ?? ""));
          containerRef.current.replaceChildren(doc.documentElement);
          setError(null);
        } catch (e) {
          if (!cancelled) setError(e instanceof Error ? e.message : "렌더링 실패");
        }
        if (!cancelled) setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "WASM 로드 실패");
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [body, isLegacyJson]);

  if (isLegacyJson) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 13 }}>
        <p>이전 형식의 마인드맵입니다.</p>
        <p>🔄 <strong>재생성</strong> 버튼을 눌러 새 형식으로 업데이트하세요.</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>마인드맵 렌더링 중…</div>;
  }

  if (error) {
    return (
      <div style={{ padding: 16, background: "#fff3cd", borderRadius: 8, fontSize: 13, color: "#856404" }}>
        <strong>마인드맵 렌더링 오류:</strong> {error}
        <pre style={{ marginTop: 8, fontSize: 11, whiteSpace: "pre-wrap" }}>{body.slice(0, 300)}</pre>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      style={{ overflowX: "auto", display: "flex", justifyContent: "center" }}
    />
  );
}
