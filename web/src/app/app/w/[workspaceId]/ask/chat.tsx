"use client";

import { useRef, useState } from "react";
import { CitedMarkdown, SourceList, type CitationSource } from "@/components/cited-markdown";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: CitationSource[];
  error?: string;
}

const EXAMPLES = [
  "What are the main risks the company discloses, and which are new this year?",
  "How concentrated is revenue among the largest customers?",
  "Summarise revenue, margin and cash flow trends over the periods covered.",
  "What does management say about guidance and growth drivers?",
];

export function Chat({ workspaceId, readyCount }: { workspaceId: string; readyCount: number }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  async function ask(question: string) {
    if (!question.trim() || busy) return;
    const history = messages
      .filter((m) => !m.error)
      .map((m) => ({ role: m.role, content: m.content }));
    setMessages((prev) => [...prev, { role: "user", content: question }, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);

    const patch = (fn: (m: Message) => Message) =>
      setMessages((prev) => [...prev.slice(0, -1), fn(prev[prev.length - 1])]);

    try {
      const res = await fetch(`/api/w/${workspaceId}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, history }),
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => ({ error: "Something went wrong." }));
        patch((m) => ({ ...m, error: err.error ?? "Something went wrong." }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line) continue;
          const event = JSON.parse(line);
          if (event.type === "sources") patch((m) => ({ ...m, sources: event.sources }));
          else if (event.type === "text") patch((m) => ({ ...m, content: m.content + event.text }));
          else if (event.type === "error") patch((m) => ({ ...m, error: event.error }));
        }
        bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
      }
    } catch {
      patch((m) => ({ ...m, error: "Connection lost. Please try again." }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {messages.length === 0 && (
        <div className="rounded-lg border border-border bg-bg p-6">
          <p className="text-fg-muted">
            Ask anything about the {readyCount} processed document{readyCount === 1 ? "" : "s"} in this workspace.
            Every answer cites the page it came from.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((q) => (
              <button key={q} onClick={() => ask(q)} disabled={readyCount === 0}
                className="rounded-md border border-border p-3 text-left text-sm hover:bg-bg-muted disabled:opacity-50">
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((m, i) =>
        m.role === "user" ? (
          <div key={i} className="ml-auto max-w-[85%] rounded-lg bg-accent px-4 py-3 text-accent-fg">{m.content}</div>
        ) : (
          <div key={i} className="rounded-lg border border-border bg-bg p-4">
            {m.error ? (
              <p role="alert" className="text-danger">{m.error}</p>
            ) : m.content ? (
              <CitedMarkdown text={m.content} sources={m.sources ?? []} workspaceId={workspaceId} />
            ) : (
              <p className="animate-pulse text-fg-muted">Searching documents and writing an answer…</p>
            )}
            {!m.error && m.sources && <SourceList sources={m.sources} workspaceId={workspaceId} />}
          </div>
        ),
      )}
      <div ref={bottom} />

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(input);
        }}
        className="sticky bottom-0 flex gap-2 border-t border-border bg-bg-muted py-3"
      >
        <label className="sr-only" htmlFor="question">Question</label>
        <textarea
          id="question"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              ask(input);
            }
          }}
          rows={2}
          maxLength={4000}
          placeholder={readyCount === 0 ? "Upload and process a document first" : "Ask a question about these documents"}
          disabled={readyCount === 0}
          className="flex-1 resize-none rounded-md border border-border bg-bg px-3 py-2"
        />
        <button type="submit" disabled={busy || !input.trim()}
          className="self-end rounded-md bg-accent px-4 py-2 font-medium text-accent-fg disabled:opacity-60">
          {busy ? "…" : "Ask"}
        </button>
      </form>
    </div>
  );
}
