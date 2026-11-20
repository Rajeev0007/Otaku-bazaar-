import type { ReactNode } from "react";

// Small, safe Markdown subset renderer for admin-edited content (product descriptions, policy pages).
// Produces React elements only — never raw HTML — so stored content cannot inject scripts.
// Supported: ## / ### headings, paragraphs, - and 1. lists, > quotes, **bold**, _italic_, `code`, [link](url).

function safeHref(url: string): string | null {
  const u = url.trim();
  if (u.startsWith("/") && !u.startsWith("//")) return u;
  if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u)) return u;
  return null;
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\*\*([^*]+)\*\*|_([^_]+)_|`([^`]+)`|\[([^\]]+)\]\(([^)\s]+)\))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const k = `${keyBase}-${i++}`;
    if (m[2]) out.push(<strong key={k}>{m[2]}</strong>);
    else if (m[3]) out.push(<em key={k}>{m[3]}</em>);
    else if (m[4]) out.push(<code key={k}>{m[4]}</code>);
    else if (m[5] && m[6]) {
      const href = safeHref(m[6]);
      out.push(
        href ? (
          <a key={k} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer" } : {})}>
            {m[5]}
          </a>
        ) : (
          m[5]
        ),
      );
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ source, className }: { source: string; className?: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) {
      i++;
      continue;
    }
    const k = `b${key++}`;
    if (line.startsWith("### ")) {
      blocks.push(<h3 key={k}>{inline(line.slice(4), k)}</h3>);
      i++;
    } else if (line.startsWith("## ")) {
      blocks.push(<h2 key={k}>{inline(line.slice(3), k)}</h2>);
      i++;
    } else if (/^\s*[-*] /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*] /.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*[-*] /, ""));
      blocks.push(<ul key={k}>{items.map((t, n) => <li key={n}>{inline(t, `${k}-${n}`)}</li>)}</ul>);
    } else if (/^\s*\d+\. /.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\. /.test(lines[i]!)) items.push(lines[i++]!.replace(/^\s*\d+\. /, ""));
      blocks.push(<ol key={k}>{items.map((t, n) => <li key={n}>{inline(t, `${k}-${n}`)}</li>)}</ol>);
    } else if (line.startsWith("> ")) {
      const quote: string[] = [];
      while (i < lines.length && lines[i]!.startsWith("> ")) quote.push(lines[i++]!.slice(2));
      blocks.push(<blockquote key={k}>{inline(quote.join(" "), k)}</blockquote>);
    } else {
      const para: string[] = [];
      while (i < lines.length && lines[i]!.trim() && !/^(#{2,3} |\s*[-*] |\s*\d+\. |> )/.test(lines[i]!)) para.push(lines[i++]!);
      blocks.push(<p key={k}>{inline(para.join(" "), k)}</p>);
    }
  }
  return <div className={className ?? "prose-store"}>{blocks}</div>;
}
