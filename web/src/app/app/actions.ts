"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { after } from "next/server";
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

/**
 * Wake the ingestion worker. It runs as a serverless function and claims queued
 * jobs itself, so this only needs to ask it to look; the call runs after the
 * response is sent so the user never waits on it.
 */
export async function kickIngestion() {
  const url = process.env.WORKER_DRAIN_URL;
  const secret = process.env.WORKER_DRAIN_SECRET;
  if (!url || !secret) return;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  after(async () => {
    try {
      await fetch(url, { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    } catch (err) {
      console.error("could not reach ingestion worker", err);
    }
  });
}

export async function retryDocument(workspaceId: string, documentId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("queue_document", { doc_id: documentId });
  if (!error) await kickIngestion();
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
