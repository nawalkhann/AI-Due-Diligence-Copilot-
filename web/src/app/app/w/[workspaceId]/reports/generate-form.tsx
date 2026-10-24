"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { REPORT_KINDS } from "@/lib/reports";
import { generateReport, type ReportState } from "./actions";

export function GenerateForm({
  workspaceId,
  companies,
}: {
  workspaceId: string;
  companies: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [state, action, pending] = useActionState<ReportState, FormData>(
    generateReport.bind(null, workspaceId),
    {},
  );
  useEffect(() => {
    if (state.reportId) router.push(`/app/w/${workspaceId}/reports/${state.reportId}`);
  }, [state.reportId, router, workspaceId]);

  return (
    <form action={action} className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <label className="block">
        <span className="text-sm font-medium">Report</span>
        <select name="kind" defaultValue="summary" className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm">
          {Object.entries(REPORT_KINDS).map(([value, k]) => (
            <option key={value} value={value}>{k.label}</option>
          ))}
        </select>
      </label>
      <label className="block">
        <span className="text-sm font-medium">Company</span>
        <select name="company_id" defaultValue="" className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm">
          <option value="">All documents in workspace</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}
        className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-60">
        {pending ? "Writing report…" : "Generate"}
      </button>
      {state.error && <p role="alert" className="text-sm text-danger sm:col-span-3">{state.error}</p>}
    </form>
  );
}
