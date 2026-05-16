import { useEffect, useRef } from "react";
import { Transformer } from "markmap-lib";
import { Markmap } from "markmap-view";

interface Props {
  body: string;
}

const transformer = new Transformer();

const isLegacy = (body: string) => {
  const t = body.trim();
  return t.startsWith("{") || t.startsWith("kind");
};

export default function MindmapViewer({ body }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const mmRef = useRef<Markmap | null>(null);

  useEffect(() => {
    if (isLegacy(body) || !svgRef.current) return;
    const { root } = transformer.transform(body);
    if (mmRef.current) {
      mmRef.current.setData(root);
      mmRef.current.fit();
    } else {
      mmRef.current = Markmap.create(svgRef.current, {}, root);
    }
  }, [body]);

  useEffect(() => {
    return () => {
      mmRef.current?.destroy();
      mmRef.current = null;
    };
  }, []);

  if (isLegacy(body)) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 13 }}>
        <p>이전 형식의 마인드맵입니다.</p>
        <p>🔄 <strong>재생성</strong> 버튼을 눌러 새 형식으로 업데이트하세요.</p>
      </div>
    );
  }

  return (
    <svg
      ref={svgRef}
      style={{ width: "100%", height: "520px", display: "block" }}
    />
  );
}
