import ReactMarkdown from "react-markdown";

interface Props {
  content: string;
}

export default function MarkdownRenderer({ content }: Props) {
  return (
    <div style={{ fontSize: 14, lineHeight: 1.8, color: "#333" }}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
