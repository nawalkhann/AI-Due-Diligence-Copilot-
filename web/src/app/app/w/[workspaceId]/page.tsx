import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Company, DocumentRow, Role } from "@/lib/types";
import { CompanyForm } from "./company-form";
import { DocumentsTable } from "./documents-table";
import { UploadForm } from "./upload-form";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WorkspacePage({ params }: PageProps<"/app/w/[workspaceId]">) {
  const { workspaceId } = await params;
  if (!UUID.test(workspaceId)) notFound();

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const [{ data: member }, { data: companies }, { data: documents }] =
    await Promise.all([
      supabase
        .from("workspace_members")
        .select("role")
        .eq("workspace_id", workspaceId)
        .eq("user_id", auth.user?.id ?? "")
        .maybeSingle(),
      supabase.from("companies").select("id, name, ticker").eq("workspace_id", workspaceId).order("name"),
      supabase
        .from("documents")
        .select(
          "id, title, doc_type, file_name, size_bytes, status, error, page_count, chunk_count, warnings, period_end, created_at, companies(name)",
        )
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: false }),
    ]);

  // RLS returns nothing for workspaces the user is not a member of.
  if (!member) notFound();
  const role = member.role as Role;
  const canUpload = role !== "viewer";
  const canDelete = role === "owner" || role === "admin";

  return (
    <div className="space-y-8">
      <p className="text-sm text-fg-muted">Your role: {role}</p>

      {canUpload && (
        <div className="grid gap-6 lg:grid-cols-3">
          <section className="rounded-lg border border-border bg-bg p-5 lg:col-span-2">
            <h2 className="font-semibold">Upload documents</h2>
            <UploadForm workspaceId={workspaceId} companies={(companies ?? []) as Company[]} />
          </section>
          <section className="rounded-lg border border-border bg-bg p-5">
            <h2 className="font-semibold">Companies</h2>
            <ul className="mt-3 space-y-1 text-sm">
              {(companies ?? []).map((c) => (
                <li key={c.id}>
                  {c.name} {c.ticker && <span className="text-fg-muted">({c.ticker})</span>}
                </li>
              ))}
            </ul>
            <CompanyForm workspaceId={workspaceId} />
          </section>
        </div>
      )}

      <section className="rounded-lg border border-border bg-bg">
        <h2 className="border-b border-border p-5 font-semibold">Documents</h2>
        <DocumentsTable
          workspaceId={workspaceId}
          documents={(documents ?? []) as unknown as DocumentRow[]}
          canRetry={canUpload}
          canDelete={canDelete}
        />
      </section>
    </div>
  );
}
