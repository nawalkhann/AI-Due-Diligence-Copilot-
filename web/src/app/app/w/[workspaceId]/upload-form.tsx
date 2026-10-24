"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { kickIngestion } from "../../actions";
import { ACCEPTED_FILES, DOC_TYPES, MAX_UPLOAD_BYTES, type Company, type DocType } from "@/lib/types";

const EXTENSIONS = Object.values(ACCEPTED_FILES).flat() as string[];
const MIME_BY_EXT = Object.fromEntries(
  Object.entries(ACCEPTED_FILES).flatMap(([mime, exts]) => exts.map((e) => [e, mime])),
) as Record<string, string>;

interface ItemStatus {
  name: string;
  state: "pending" | "uploading" | "done" | "error";
  message?: string;
}

function extension(name: string) {
  const i = name.lastIndexOf(".");
  return i >= 0 ? name.slice(i).toLowerCase() : "";
}

function storageSafe(name: string) {
  return name.normalize("NFKD").replace(/[^A-Za-z0-9._-]+/g, "_").slice(-120) || "file";
}

function titleFromFile(name: string) {
  return name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim().slice(0, 300) || name;
}

async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function UploadForm({ workspaceId, companies }: { workspaceId: string; companies: Company[] }) {
  const router = useRouter();
  const [items, setItems] = useState<ItemStatus[]>([]);
  const [busy, setBusy] = useState(false);

  function update(index: number, patch: Partial<ItemStatus>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = form.getAll("files").filter((f): f is File => f instanceof File && f.size > 0);
    const docType = String(form.get("doc_type")) as DocType;
    const companyId = String(form.get("company_id") || "") || null;
    const periodEnd = String(form.get("period_end") || "") || null;
    if (files.length === 0) return;

    setBusy(true);
    setItems(files.map((f) => ({ name: f.name, state: "pending" })));
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) {
      router.push("/login");
      return;
    }

    for (const [index, file] of files.entries()) {
      const ext = extension(file.name);
      if (!EXTENSIONS.includes(ext)) {
        update(index, { state: "error", message: `Unsupported file type ${ext || ""}`.trim() });
        continue;
      }
      if (file.size > MAX_UPLOAD_BYTES) {
        update(index, { state: "error", message: "File is larger than 100 MB" });
        continue;
      }
      update(index, { state: "uploading" });
      try {
        const id = crypto.randomUUID();
        const path = `${workspaceId}/${id}/${storageSafe(file.name)}`;
        const mime = MIME_BY_EXT[ext];
        const { error: insertError } = await supabase.from("documents").insert({
          id,
          workspace_id: workspaceId,
          company_id: companyId,
          title: titleFromFile(file.name),
          doc_type: docType,
          period_end: periodEnd,
          file_name: file.name.slice(0, 255),
          storage_path: path,
          mime_type: mime,
          size_bytes: file.size,
          sha256: await sha256(file),
        });
        if (insertError) {
          throw new Error(
            insertError.code === "23505" ? "Already uploaded to this workspace" : "Could not save document",
          );
        }
        const { error: uploadError } = await supabase.storage
          .from("documents")
          .upload(path, file, { contentType: mime, upsert: false });
        if (uploadError) {
          await supabase.from("documents").delete().eq("id", id);
          throw new Error("Upload failed. Please try again.");
        }
        const { error: queueError } = await supabase.rpc("queue_document", { doc_id: id });
        if (queueError) throw new Error("Uploaded, but could not start processing");
        update(index, { state: "done" });
      } catch (err) {
        update(index, { state: "error", message: err instanceof Error ? err.message : "Upload failed" });
      }
    }
    await kickIngestion().catch(() => undefined);
    setBusy(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <label className="block">
        <span className="text-sm font-medium">Files</span>
        <input
          name="files"
          type="file"
          multiple
          required
          accept={EXTENSIONS.join(",")}
          className="mt-1 block w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-bg-muted file:px-3 file:py-2"
        />
        <span className="mt-1 block text-xs text-fg-muted">
          PDF, HTML, Excel, PowerPoint, Word, CSV or text. Up to 100 MB each.
        </span>
      </label>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="text-sm font-medium">Document type</span>
          <select name="doc_type" defaultValue="annual_report" className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm">
            {Object.entries(DOC_TYPES).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Company</span>
          <select name="company_id" defaultValue="" className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm">
            <option value="">Not specified</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-sm font-medium">Period end</span>
          <input name="period_end" type="date" className="mt-1 w-full rounded-md border border-border bg-bg px-2 py-2 text-sm" />
        </label>
      </div>
      <button type="submit" disabled={busy}
        className="rounded-md bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-60">
        {busy ? "Uploading…" : "Upload and process"}
      </button>
      {items.length > 0 && (
        <ul className="space-y-1 text-sm" aria-live="polite">
          {items.map((it) => (
            <li key={it.name} className="flex justify-between gap-4">
              <span className="truncate">{it.name}</span>
              <span className={it.state === "error" ? "text-danger" : it.state === "done" ? "text-ok" : "text-fg-muted"}>
                {it.state === "error" ? it.message : it.state === "done" ? "Queued" : it.state === "uploading" ? "Uploading…" : "Waiting"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
