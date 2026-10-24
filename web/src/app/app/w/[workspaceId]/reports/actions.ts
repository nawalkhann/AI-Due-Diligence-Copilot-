"use server";

import { revalidatePath } from "next/cache";
import { FALLBACK_BETA, GROUNDING_RULES, MODEL, anthropic, formatSources, retrieveMany } from "@/lib/ai";
import { REPORT_KINDS, type ReportKind } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

export interface ReportState {
  error?: string;
  reportId?: string;
}

export async function generateReport(
  workspaceId: string,
  _prev: ReportState,
  formData: FormData,
): Promise<ReportState> {
  const kind = String(formData.get("kind")) as ReportKind;
  const spec = REPORT_KINDS[kind];
  if (!spec) return { error: "Choose a report type." };
  const companyId = String(formData.get("company_id") || "") || null;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in again." };

  let documentIds: string[] | undefined;
  let companyName: string | null = null;
  if (companyId) {
    const [{ data: company }, { data: docs }] = await Promise.all([
      supabase.from("companies").select("name").eq("id", companyId).eq("workspace_id", workspaceId).maybeSingle(),
      supabase.from("documents").select("id").eq("company_id", companyId).eq("status", "ready"),
    ]);
    if (!company) return { error: "Company not found." };
    companyName = company.name;
    documentIds = (docs ?? []).map((d) => d.id);
    if (documentIds.length === 0) return { error: `No processed documents are linked to ${company.name} yet.` };
  }

  let sources;
  try {
    sources = await retrieveMany(supabase, workspaceId, spec.queries, 6, documentIds);
  } catch (err) {
    console.error("report retrieval failed", err);
    return { error: "Search is unavailable right now. Please try again." };
  }
  if (sources.length === 0) return { error: "No processed documents found in this workspace." };
  sources = sources.slice(0, 48);

  let content: string;
  try {
    const stream = anthropic().beta.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      betas: [FALLBACK_BETA],
      fallbacks: "default",
      output_config: { effort: "high" },
      system: GROUNDING_RULES,
      messages: [
        {
          role: "user",
          content: `<sources>\n${formatSources(sources)}\n</sources>\n\n${
            companyName ? `Company: ${companyName}\n\n` : ""
          }${spec.instructions}`,
        },
      ],
    });
    const message = await stream.finalMessage();
    if (message.stop_reason === "refusal") return { error: "The report request was declined." };
    content = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim();
    if (!content) return { error: "The report came back empty. Please try again." };
  } catch (err) {
    console.error("report generation failed", err);
    return { error: "The report could not be generated. Please try again." };
  }

  const title = `${spec.label}${companyName ? `: ${companyName}` : ""}`;
  const { data: report, error } = await supabase
    .from("reports")
    .insert({
      workspace_id: workspaceId,
      company_id: companyId,
      kind,
      title,
      content,
      model: MODEL,
      sources: sources.map(({ content: text, ...s }) => ({ ...s, excerpt: text.slice(0, 400) })),
    })
    .select("id")
    .single();
  if (error || !report) return { error: "The report was generated but could not be saved." };

  await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    action: "report",
    detail: { kind, report_id: report.id, sources: sources.length },
  });
  revalidatePath(`/app/w/${workspaceId}/reports`);
  return { reportId: report.id };
}
