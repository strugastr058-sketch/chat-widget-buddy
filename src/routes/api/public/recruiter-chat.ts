import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Demo AI endpoint for the AIChatWidget. Accepts POST { messages } and streams plain text back.
const Body = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) })).min(1).max(50),
});

export const Route = createFileRoute("/api/public/recruiter-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
        const key = process.env["LOVABLE_API_KEY"];
        if (!key) return Response.json({ error: "The assistant isn't configured." }, { status: 500 });

        const upstream = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
          method: "POST",
          headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "openai/gpt-6-astra",
            stream: true,
            instructions: "You are a friendly, concise assistant inside a chat widget. Use markdown.",
            input: parsed.data.messages.map(m => ({ role: m.role, content: [{ type: m.role === "user" ? "input_text" : "output_text", text: m.content || " " }] })),
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
                const evt = JSON.parse(data);
                const text = evt.type === "response.output_text.delta" ? evt.delta : "";
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
