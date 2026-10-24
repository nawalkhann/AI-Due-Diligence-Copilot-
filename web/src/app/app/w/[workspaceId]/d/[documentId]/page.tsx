import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DOC_TYPES, type DocType } from "@/lib/types";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Extracted text of a document, page by page. Citations link here with
// ?page=N#page-N so the cited page is highlighted and scrolled into view.
export default async function DocumentPage({
  params,
  searchParams,
}: PageProps<"/app/w/[workspaceId]/d/[documentId]">) {
  const { workspaceId, documentId } = await params;
  const { page } = await searchParams;
  if (!UUID.test(documentId)) notFound();
  const target = Number(page) || null;

  const supabase = await createClient();
  const [{ data: doc }, { data: pages }] = await Promise.all([
    supabase
      .from("documents")
      .select("id, title, doc_type, file_name, storage_path, page_count, period_end, companies(name)")
      .eq("id", documentId)
      .eq("workspace_id", workspaceId)
      .maybeSingle(),
    supabase
      .from("document_pages")
      .select("page_number, content")
      .eq("document_id", documentId)
      .order("page_number"),
  ]);
  if (!doc) notFound();

  const { data: signed } = await supabase.storage.from("documents").createSignedUrl(doc.storage_path, 300);
  const company = (doc.companies as unknown as { name: string } | null)?.name;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{doc.title}</h2>
          <p className="text-sm text-fg-muted">
            {DOC_TYPES[doc.doc_type as DocType]}
            {company && ` · ${company}`}
            {doc.period_end && ` · period ending ${doc.period_end}`}
            {` · ${doc.page_count ?? 0} pages`}
          </p>
        </div>
        {signed?.signedUrl && (
          <a href={signed.signedUrl} target="_blank" rel="noopener noreferrer"
            className="rounded-md border border-border px-3 py-2 text-sm hover:bg-bg-muted">
            Open original file
          </a>
        )}
      </div>
      <div className="space-y-4">
        {(pages ?? []).map((p) => (
          <section
            key={p.page_number}
            id={`page-${p.page_number}`}
            className={`scroll-mt-4 rounded-lg border bg-bg p-5 ${
              p.page_number === target ? "border-accent ring-2 ring-accent/30" : "border-border"
            }`}
          >
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wide text-fg-muted">
              <Link href={`?page=${p.page_number}#page-${p.page_number}`}>Page {p.page_number}</Link>
            </h3>
            <div className="whitespace-pre-wrap break-words text-sm leading-6">{p.content}</div>
          </section>
        ))}
      </div>
    </div>
  );
}
