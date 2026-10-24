import Link from "next/link";
import type { ReactNode } from "react";

export interface CitationSource {
  n: number;
  documentId: string;
  documentTitle: string;
  pageStart: number;
  pageEnd: number;
  section?: string | null;
  excerpt?: string;
}

// A small, safe markdown renderer (no HTML injection) that turns [S3] markers
// into links to the cited page of the source document.
export function CitedMarkdown({
  text,
  sources,
  workspaceId,
}: {
  text: string;
  sources: CitationSource[];
  workspaceId: string;
}) {
  const byN = new Map(sources.map((s) => [s.n, s]));
  const blocks = text.split(/\n{2,}/);
  return (
    <div className="space-y-3 leading-7">
      {blocks.map((block, i) => renderBlock(block, i, byN, workspaceId))}
    </div>
  );
}

function renderBlock(block: string, key: number, byN: Map<number, CitationSource>, ws: string): ReactNode {
  const lines = block.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return null;
  const heading = /^(#{1,4})\s+(.*)$/.exec(lines[0]);
  if (heading && lines.length === 1) {
    const cls = heading[1].length <= 2 ? "text-lg font-semibold mt-4" : "font-semibold mt-3";
    return <h3 key={key} className={cls}>{inline(heading[2], byN, ws)}</h3>;
  }
  if (lines.every((l) => /^\s*([-*•]|\d+[.)])\s+/.test(l))) {
    const ordered = /^\s*\d/.test(lines[0]);
    const items = lines.map((l, j) => (
      <li key={j}>{inline(l.replace(/^\s*([-*•]|\d+[.)])\s+/, ""), byN, ws)}</li>
    ));
    return ordered ? (
      <ol key={key} className="ml-5 list-decimal space-y-1">{items}</ol>
    ) : (
      <ul key={key} className="ml-5 list-disc space-y-1">{items}</ul>
    );
  }
  if (lines.length >= 2 && lines.every((l) => l.trim().startsWith("|"))) {
    const rows = lines
      .filter((l) => !/^\s*\|?\s*:?-{2,}/.test(l))
      .map((l) => l.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
    const [head, ...body] = rows;
    return (
      <div key={key} className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>{head.map((c, j) => <th key={j} className="border border-border bg-bg-muted px-2 py-1 text-left">{inline(c, byN, ws)}</th>)}</tr>
          </thead>
          <tbody>
            {body.map((r, j) => (
              <tr key={j}>{r.map((c, k) => <td key={k} className="border border-border px-2 py-1">{inline(c, byN, ws)}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  return <p key={key}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{inline(l.replace(/^#+\s+/, ""), byN, ws)}</span>)}</p>;
}

function inline(text: string, byN: Map<number, CitationSource>, ws: string): ReactNode[] {
  const out: ReactNode[] = [];
  const pattern = /(\[S\d+\])|\*\*([^*]+)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = pattern.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    if (m[1]) {
      const n = Number(m[1].slice(2, -1));
      const s = byN.get(n);
      out.push(
        s ? (
          <Link
            key={m.index}
            href={`/app/w/${ws}/d/${s.documentId}?page=${s.pageStart}#page-${s.pageStart}`}
            title={`${s.documentTitle}, p. ${s.pageStart}${s.excerpt ? `\n\n${s.excerpt}` : ""}`}
            className="mx-0.5 inline-block rounded bg-accent/15 px-1 text-xs font-medium text-accent no-underline hover:bg-accent/25 align-baseline"
          >
            {n}
          </Link>
        ) : (
          <span key={m.index} className="text-xs text-fg-muted">[{n}]</span>
        ),
      );
    } else {
      out.push(<strong key={m.index}>{m[2]}</strong>);
    }
    last = m.index + m[0].length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function SourceList({ sources, workspaceId }: { sources: CitationSource[]; workspaceId: string }) {
  if (sources.length === 0) return null;
  return (
    <details className="mt-3 text-sm">
      <summary className="cursor-pointer text-fg-muted">{sources.length} sources</summary>
      <ol className="mt-2 space-y-1">
        {sources.map((s) => (
          <li key={s.n}>
            <Link href={`/app/w/${workspaceId}/d/${s.documentId}?page=${s.pageStart}#page-${s.pageStart}`} className="text-accent hover:underline">
              [{s.n}] {s.documentTitle}, p. {s.pageStart}{s.pageEnd !== s.pageStart && `–${s.pageEnd}`}
            </Link>
            {s.section && <span className="text-fg-muted"> · {s.section}</span>}
          </li>
        ))}
      </ol>
    </details>
  );
}
