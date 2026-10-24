import { createClient } from "@/lib/supabase/server";
import { Chat } from "./chat";

export default async function AskPage({ params }: PageProps<"/app/w/[workspaceId]/ask">) {
  const { workspaceId } = await params;
  const supabase = await createClient();
  const { count } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("status", "ready");
  return <Chat workspaceId={workspaceId} readyCount={count ?? 0} />;
}
