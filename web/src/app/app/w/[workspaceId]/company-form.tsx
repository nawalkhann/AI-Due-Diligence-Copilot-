"use client";

import { useActionState } from "react";
import { createCompany, type FormState } from "../../actions";

export function CompanyForm({ workspaceId }: { workspaceId: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    createCompany.bind(null, workspaceId),
    {},
  );
  return (
    <form action={action} className="mt-4 space-y-2">
      <input name="name" required maxLength={200} placeholder="Company name"
        className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm" />
      <input name="ticker" maxLength={12} placeholder="Ticker (optional)"
        className="w-full rounded-md border border-border bg-bg px-3 py-2 text-sm" />
      {state.error && <p role="alert" className="text-sm text-danger">{state.error}</p>}
      <button type="submit" disabled={pending}
        className="w-full rounded-md border border-border px-3 py-2 text-sm font-medium hover:bg-bg-muted disabled:opacity-60">
        {pending ? "Adding…" : "Add company"}
      </button>
    </form>
  );
}
