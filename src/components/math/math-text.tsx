import katex from "katex";
import { useMemo } from "react";

function renderInline(src: string) {
  try {
    return katex.renderToString(src, { throwOnError: false, displayMode: false });
  } catch {
    return src;
  }
}

export function MathText({ text, className }: { text: string; className?: string }) {
  const html = useMemo(() => {
    const parts = text.split(/(\$\$[\s\S]+?\$\$|\$[^$\n]+\$)/g);
    return parts
      .map((part) => {
        if (part.startsWith("$$") && part.endsWith("$$")) {
          try {
            return katex.renderToString(part.slice(2, -2), { throwOnError: false, displayMode: true });
          } catch {
            return part;
          }
        }
        if (part.startsWith("$") && part.endsWith("$")) {
          return renderInline(part.slice(1, -1));
        }
        return part
          .replace(/&/g, "&")
          .replace(/</g, "<")
          .replace(/>/g, ">")
          .replace(/\n/g, "<br/>");
      })
      .join("");
  }, [text]);
  return <div className={className} dangerouslySetInnerHTML={{ __html: html }} />;
}
