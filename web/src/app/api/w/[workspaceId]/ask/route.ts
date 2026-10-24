import { FALLBACK_BETA, GROUNDING_RULES, MODEL, anthropic, formatSources, retrieve, toSources } from "@/lib/ai";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 300;

interface Turn {
  role: "user" | "assistant";
  content: string;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Streams an answer as newline-delimited JSON events:
//   {"type":"sources","sources":[...]}  then  {"type":"text","text":"..."}*  then  {"type":"done"}
export async function POST(request: Request, ctx: RouteContext<"/api/w/[workspaceId]/ask">) {
  const { workspaceId } = await ctx.params;
  if (!UUID.test(workspaceId)) return Response.json({ error: "not found" }, { status: 404 });

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "sign in required" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    question?: string;
    history?: Turn[];
    documentIds?: string[];
  } | null;
  const question = body?.question?.trim() ?? "";
  if (!question || question.length > 4000) {
    return Response.json({ error: "Ask a question of up to 4,000 characters." }, { status: 400 });
  }
  const history = (body?.history ?? [])
    .filter((t) => (t.role === "user" || t.role === "assistant") && typeof t.content === "string")
    .slice(-8);
  const documentIds = (body?.documentIds ?? []).filter((id) => UUID.test(id));

  // RLS hides workspaces the user is not in, so an empty result means no access.
  const { data: ws } = await supabase.from("workspaces").select("id").eq("id", workspaceId).maybeSingle();
  if (!ws) return Response.json({ error: "not found" }, { status: 404 });

  // Fold recent turns into the search query so follow-ups like "and in 2023?" retrieve well.
  const lastUser = [...history].reverse().find((t) => t.role === "user")?.content ?? "";
  const searchQuery = lastUser ? `${lastUser.slice(0, 500)}\n${question}` : question;

  let sources;
  try {
    sources = toSources(await retrieve(supabase, workspaceId, searchQuery, 14, documentIds));
  } catch (err) {
    console.error("retrieval failed", err);
    return Response.json({ error: "Search is unavailable right now. Please try again." }, { status: 502 });
  }

  await supabase.from("audit_events").insert({
    workspace_id: workspaceId,
    action: "ask",
    detail: { question: question.slice(0, 500), sources: sources.length },
  });

  const encoder = new TextEncoder();
  const send = (controller: ReadableStreamDefaultController, event: unknown) =>
    controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));

  const stream = new ReadableStream({
    async start(controller) {
      send(controller, {
        type: "sources",
        sources: sources.map(({ content, ...s }) => ({ ...s, excerpt: content.slice(0, 400) })),
      });
      if (sources.length === 0) {
        send(controller, {
          type: "text",
          text: "I couldn't find anything relevant in this workspace's documents. Check that the documents have finished processing, or try rephrasing the question.",
        });
        send(controller, { type: "done" });
        controller.close();
        return;
      }
      try {
        const messageStream = anthropic().beta.messages.stream({
          model: MODEL,
          max_tokens: 16000,
          betas: [FALLBACK_BETA],
          fallbacks: "default",
          output_config: { effort: "medium" },
          system: GROUNDING_RULES,
          messages: [
            ...history.map((t) => ({ role: t.role, content: t.content })),
            {
              role: "user",
              content: `<sources>\n${formatSources(sources)}\n</sources>\n\nQuestion: ${question}`,
            },
          ],
        });
        for await (const event of messageStream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
            send(controller, { type: "text", text: event.delta.text });
          }
        }
        const final = await messageStream.finalMessage();
        if (final.stop_reason === "refusal") {
          send(controller, { type: "text", text: "\n\nThis request was declined. Please rephrase the question." });
        } else if (final.stop_reason === "max_tokens") {
          send(controller, { type: "text", text: "\n\n(The answer was cut short. Ask a narrower question for the rest.)" });
        }
        send(controller, { type: "done" });
      } catch (err) {
        console.error("generation failed", err);
        send(controller, { type: "error", error: "The answer could not be generated. Please try again." });
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" },
  });
}
