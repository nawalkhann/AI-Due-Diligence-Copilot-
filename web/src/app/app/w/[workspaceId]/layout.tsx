import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WorkspaceTabs } from "./tabs";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function WorkspaceLayout({ children, params }: LayoutProps<"/app/w/[workspaceId]">) {
  const { workspaceId } = await params;
  if (!UUID.test(workspaceId)) notFound();
  const supabase = await createClient();
  // RLS returns nothing for workspaces the user is not a member of.
  const { data: workspace } = await supabase.from("workspaces").select("id, name").eq("id", workspaceId).maybeSingle();
  if (!workspace) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app" className="text-sm text-fg-muted hover:underline">← All workspaces</Link>
        <h1 className="mt-2 text-2xl font-semibold">{workspace.name}</h1>
      </div>
      <WorkspaceTabs workspaceId={workspaceId} />
      {children}
    </div>
  );
}
