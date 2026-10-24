import Link from "next/link";
import { REPORT_KINDS, type ReportKind } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";
import { GenerateForm } from "./generate-form";

export const maxDuration = 300;

export default async function ReportsPage({ params }: PageProps<"/app/w/[workspaceId]/reports">) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const [{ data: reports }, { data: companies }] = await Promise.all([
    supabase
      .from("reports")
      .select("id, kind, title, created_at")
      .eq("workspace_id", workspaceId)
      .order("created_at", { ascending: false }),
    supabase.from("companies").select("id, name").eq("workspace_id", workspaceId).order("name"),
  ]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-border bg-bg p-5">
        <h2 className="font-semibold">Generate a report</h2>
        <p className="mt-1 text-sm text-fg-muted">
          Reports search across the workspace&apos;s processed documents and cite every claim. They take about a minute.
        </p>
        <GenerateForm workspaceId={workspaceId} companies={companies ?? []} />
      </section>
      <section className="rounded-lg border border-border bg-bg">
        <h2 className="border-b border-border p-5 font-semibold">Saved reports</h2>
        {(reports ?? []).length === 0 ? (
          <p className="p-8 text-center text-fg-muted">No reports yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {(reports ?? []).map((r) => (
              <li key={r.id}>
                <Link href={`/app/w/${workspaceId}/reports/${r.id}`} className="flex justify-between gap-4 p-5 hover:bg-bg-muted">
                  <span>
                    <span className="font-medium">{r.title}</span>
                    <span className="block text-sm text-fg-muted">{REPORT_KINDS[r.kind as ReportKind].description}</span>
                  </span>
                  <span className="whitespace-nowrap text-sm text-fg-muted">{new Date(r.created_at).toLocaleString()}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
