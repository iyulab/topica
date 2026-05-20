import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";

interface Props {
  body: string;
}

const isLegacy = (body: string) => {
  const t = body.trim();
  return t.startsWith("{") || t.startsWith("#");
};

export default function MindmapViewer({ body }: Props) {
  const { t } = useTranslation();
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
        <p>{t('mindmap.legacy')}</p>
        <p>🔄 {t('mindmap.legacy.hint')}</p>
      </div>
    );
  }

  if (failed) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 13 }}>
        <p>{t('mindmap.failed')}</p>
        <p>🔄 {t('mindmap.failed.hint')}</p>
      </div>
    );
  }

  if (!svg) {
    return (
      <div style={{ padding: 24, textAlign: "center", color: "#aaa", fontSize: 13 }}>
        {t('mindmap.rendering')}
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
