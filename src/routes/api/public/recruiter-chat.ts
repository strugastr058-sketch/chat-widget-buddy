import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Demo AI endpoint for the AIChatWidget. Accepts POST { messages } (with optional
// photo / file attachments as data URLs) and streams plain text back.
const Attachment = z.object({ name: z.string().max(200), mediaType: z.string().max(100), url: z.string().max(2_200_000) });
const Body = z.object({
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().max(20_000),
    attachments: z.array(Attachment).max(3).optional(),
  })).min(1).max(50),
});

function decodeText(url: string) {
  try { return new TextDecoder().decode(Uint8Array.from(atob(url.split(",")[1] ?? ""), c => c.charCodeAt(0))).slice(0, 20_000); }
  catch { return ""; }
}

function toParts(m: z.infer<typeof Body>["messages"][number]) {
  if (m.role === "assistant" || !m.attachments?.length) return m.content || " ";
  const parts: unknown[] = [];
  if (m.content) parts.push({ type: "text", text: m.content });
  for (const a of m.attachments) {
    if (!a.url.startsWith("data:")) continue;
    if (a.mediaType.startsWith("image/")) parts.push({ type: "image_url", image_url: { url: a.url } });
    else if (a.mediaType === "application/pdf") parts.push({ type: "file", file: { filename: a.name, file_data: a.url } });
    else parts.push({ type: "text", text: `File "${a.name}":\n${decodeText(a.url)}` });
  }
  if (!m.content) parts.push({ type: "text", text: "Please look at the attached file(s)." });
  return parts;
}

export const Route = createFileRoute("/api/public/recruiter-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "The assistant isn't configured." }, { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            stream: true,
            messages: [
              { role: "system", content: "You are a friendly, concise assistant inside a chat widget. Use markdown. When photos or files are attached, describe and analyze them helpfully." },
              ...parsed.data.messages.map(m => ({ role: m.role, content: toParts(m) })),
            ],
          }),
        });
        if (!upstream.ok || !upstream.body) {
          const msg = upstream.status === 429 ? "Too many requests — please wait a moment." : upstream.status === 402 ? "AI credits are used up." : "The assistant is unavailable right now.";
          return Response.json({ error: msg }, { status: upstream.status === 429 || upstream.status === 402 ? upstream.status : 502 });
        }

        const decoder = new TextDecoder(), encoder = new TextEncoder();
        let buffer = "";
        const stream = upstream.body.pipeThrough(new TransformStream<Uint8Array, Uint8Array>({
          transform(chunk, controller) {
            buffer += decoder.decode(chunk, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              const data = line.trim().replace(/^data:\s*/, "");
              if (!data || data === "[DONE]" || !line.trim().startsWith("data:")) continue;
              try {
                const text = JSON.parse(data).choices?.[0]?.delta?.content;
                if (text) controller.enqueue(encoder.encode(text));
              } catch { /* partial frame */ }
            }
          },
        }));
        return new Response(stream, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
      },
    },
  },
});
