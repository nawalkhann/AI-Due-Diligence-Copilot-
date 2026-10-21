import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Workspace } from "@/lib/types";
import { CreateWorkspaceForm } from "./create-workspace-form";

export default async function WorkspacesPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("workspaces")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });
  const workspaces = (data ?? []) as Workspace[];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Your workspaces</h1>
        <p className="mt-1 text-fg-muted">Use one workspace per deal or fund. Members only see the workspaces they belong to.</p>
      </div>
      <CreateWorkspaceForm />
      {workspaces.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border bg-bg p-8 text-center text-fg-muted">
          No workspaces yet. Create one above to start uploading documents.
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <li key={w.id}>
              <Link href={`/app/w/${w.id}`} className="block rounded-lg border border-border bg-bg p-5 hover:border-accent">
                <span className="font-medium">{w.name}</span>
                <span className="mt-1 block text-sm text-fg-muted">
                  Created {new Date(w.created_at).toLocaleDateString()}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
