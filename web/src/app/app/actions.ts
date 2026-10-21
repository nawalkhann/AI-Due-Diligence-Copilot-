"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface FormState {
  error?: string;
}

export async function createWorkspace(_prev: FormState, formData: FormData): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  if (!name || name.length > 120) return { error: "Name must be 1 to 120 characters." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_workspace", { workspace_name: name });
  if (error) return { error: "Could not create the workspace. Please try again." };
  redirect(`/app/w/${data}`);
}

export async function createCompany(
  workspaceId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const name = String(formData.get("name") ?? "").trim();
  const ticker = String(formData.get("ticker") ?? "").trim().toUpperCase() || null;
  if (!name || name.length > 200) return { error: "Company name must be 1 to 200 characters." };
  const supabase = await createClient();
  const { error } = await supabase.from("companies").insert({ workspace_id: workspaceId, name, ticker });
  if (error) {
    return { error: error.code === "23505" ? "That company already exists." : "Could not add the company." };
  }
  revalidatePath(`/app/w/${workspaceId}`);
  return {};
}

export async function retryDocument(workspaceId: string, documentId: string) {
  const supabase = await createClient();
  await supabase.rpc("queue_document", { doc_id: documentId });
  revalidatePath(`/app/w/${workspaceId}`);
}

export async function deleteDocument(workspaceId: string, documentId: string) {
  const supabase = await createClient();
  const { data: doc } = await supabase
    .from("documents")
    .select("storage_path")
    .eq("id", documentId)
    .single();
  if (!doc) return;
  const { error } = await supabase.from("documents").delete().eq("id", documentId);
  if (!error) await supabase.storage.from("documents").remove([doc.storage_path]);
  revalidatePath(`/app/w/${workspaceId}`);
}
