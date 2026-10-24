import Link from "next/link";
import { notFound } from "next/navigation";
import { CitedMarkdown, SourceList, type CitationSource } from "@/components/cited-markdown";
import { createClient } from "@/lib/supabase/server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function ReportPage({ params }: PageProps<"/app/w/[workspaceId]/reports/[reportId]">) {
  const { workspaceId, reportId } = await params;
  if (!UUID.test(reportId)) notFound();
  const supabase = await createClient();
  const { data: report } = await supabase
    .from("reports")
    .select("id, title, content, sources, created_at")
    .eq("id", reportId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  if (!report) notFound();
  const sources = report.sources as CitationSource[];

  return (
    <article className="rounded-lg border border-border bg-bg p-6 print:border-0 print:p-0">
      <div className="flex flex-wrap items-start justify-between gap-3 print:hidden">
        <Link href={`/app/w/${workspaceId}/reports`} className="text-sm text-fg-muted hover:underline">← All reports</Link>
        <span className="text-sm text-fg-muted">Use your browser&apos;s Print to save as PDF</span>
      </div>
      <h2 className="mt-3 text-2xl font-semibold">{report.title}</h2>
      <p className="text-sm text-fg-muted">
        Generated {new Date(report.created_at).toLocaleString()} from {sources.length} cited passages. Verify figures against the sources before relying on them.
      </p>
      <div className="mt-6">
        <CitedMarkdown text={report.content} sources={sources} workspaceId={workspaceId} />
      </div>
      <SourceList sources={sources} workspaceId={workspaceId} />
    </article>
  );
}
