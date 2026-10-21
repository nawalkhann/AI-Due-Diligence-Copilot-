"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";
import { DOC_TYPES, type DocStatus, type DocumentRow } from "@/lib/types";
import { deleteDocument, retryDocument } from "../../actions";

const STATUS_LABEL: Record<DocStatus, string> = {
  uploaded: "Uploading",
  queued: "Queued",
  processing: "Processing",
  ready: "Ready",
  failed: "Failed",
};

const STATUS_CLASS: Record<DocStatus, string> = {
  uploaded: "bg-bg-muted text-fg-muted",
  queued: "bg-bg-muted text-fg-muted",
  processing: "bg-accent/15 text-accent",
  ready: "bg-ok/15 text-ok",
  failed: "bg-danger/15 text-danger",
};

function formatBytes(n: number) {
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function DocumentsTable({
  workspaceId,
  documents,
  canRetry,
  canDelete,
}: {
  workspaceId: string;
  documents: DocumentRow[];
  canRetry: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const inFlight = documents.some((d) => ["uploaded", "queued", "processing"].includes(d.status));

  // Refresh while anything is still processing.
  useEffect(() => {
    if (!inFlight) return;
    const timer = setInterval(() => router.refresh(), 4000);
    return () => clearInterval(timer);
  }, [inFlight, router]);

  if (documents.length === 0) {
    return <p className="p-8 text-center text-fg-muted">No documents yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="text-fg-muted">
          <tr className="border-b border-border">
            <th className="px-5 py-3 font-medium">Document</th>
            <th className="px-5 py-3 font-medium">Company</th>
            <th className="px-5 py-3 font-medium">Status</th>
            <th className="px-5 py-3 font-medium">Pages</th>
            <th className="px-5 py-3"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {documents.map((d) => (
            <tr key={d.id} className="border-b border-border last:border-0 align-top">
              <td className="px-5 py-3">
                <div className="font-medium">{d.title}</div>
                <div className="text-xs text-fg-muted">
                  {DOC_TYPES[d.doc_type]} · {formatBytes(d.size_bytes)}
                  {d.period_end && ` · period ending ${d.period_end}`}
                </div>
                {d.status === "failed" && d.error && <div className="mt-1 text-xs text-danger">{d.error}</div>}
                {d.status === "ready" && d.warnings.length > 0 && (
                  <div className="mt-1 text-xs text-fg-muted">Note: {d.warnings.join("; ")}</div>
                )}
              </td>
              <td className="px-5 py-3">{d.companies?.name ?? "—"}</td>
              <td className="px-5 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[d.status]}`}>
                  {STATUS_LABEL[d.status]}
                </span>
              </td>
              <td className="px-5 py-3">{d.page_count ?? "—"}</td>
              <td className="space-x-3 whitespace-nowrap px-5 py-3 text-right">
                {canRetry && d.status === "failed" && (
                  <button
                    disabled={pending}
                    onClick={() => startTransition(() => retryDocument(workspaceId, d.id))}
                    className="text-accent hover:underline"
                  >
                    Retry
                  </button>
                )}
                {canDelete && (
                  <button
                    disabled={pending}
                    onClick={() => {
                      if (confirm(`Delete "${d.title}"? This cannot be undone.`)) {
                        startTransition(() => deleteDocument(workspaceId, d.id));
                      }
                    }}
                    className="text-danger hover:underline"
                  >
                    Delete
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
