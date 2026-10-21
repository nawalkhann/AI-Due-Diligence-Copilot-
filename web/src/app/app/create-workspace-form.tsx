"use client";

import { useActionState } from "react";
import { createWorkspace, type FormState } from "./actions";

export function CreateWorkspaceForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createWorkspace, {});
  return (
    <form action={action} className="flex flex-col gap-2 rounded-lg border border-border bg-bg p-4 sm:flex-row sm:items-start">
      <label className="flex-1">
        <span className="sr-only">Workspace name</span>
        <input
          name="name"
          required
          maxLength={120}
          placeholder="e.g. Project Atlas: Acme Robotics"
          className="w-full rounded-md border border-border bg-bg px-3 py-2"
        />
        {state.error && <span role="alert" className="mt-1 block text-sm text-danger">{state.error}</span>}
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-60"
      >
        {pending ? "Creating…" : "New workspace"}
      </button>
    </form>
  );
}
