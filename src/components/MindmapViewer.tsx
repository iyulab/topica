import { useEffect, useState } from "react";
import DOMPurify from "dompurify";

interface Props {
  body: string;
}

const isLegacy = (body: string) => {
  const t = body.trim();
  return t.startsWith("{") || t.startsWith("#");
};

export default function MindmapViewer({ body }: Props) {
  const [svg, setSvg] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (isLegacy(body)) return;
    setSvg(null);
    setFailed(false);
    import("@iyulab/declart-web").then(({ render }) => {
      try {
        const clean = DOMPurify.sanitize(render(body, "default"), {
          USE_PROFILES: { svg: true, svgFilters: true },
        });
        setSvg(clean);
      } catch {
        setFailed(true);
      }
    }).catch(() => setFailed(true));
  }, [body]);

  if (isLegacy(body)) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 13 }}>
        <p>이전 형식의 마인드맵입니다.</p>
        <p>🔄 <strong>재생성</strong> 버튼을 눌러 새 형식으로 업데이트하세요.</p>
      </div>
    );
  }

  if (failed) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 13 }}>
        <p>마인드맵을 렌더링할 수 없습니다.</p>
        <p>🔄 <strong>재생성</strong> 버튼을 눌러 다시 시도하세요.</p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>
        렌더링 중…
      </div>
    );
  }

  return (
    <div
      dangerouslySetInnerHTML={{ __html: svg }}
      style={{ width: "100%", overflowX: "auto" }}
    />
  );
}
