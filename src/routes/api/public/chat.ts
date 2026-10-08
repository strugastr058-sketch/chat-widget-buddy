import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { AIGatewayError, createGateway } from "@/lib/ai-gateway";

// Chat endpoint powered by ai-gateway-hub (v1.2.0, vendored in src/lib/ai-gateway).
// Key comes from the AI_PROVIDER_API_KEY secret (any supported service, auto-detected).
const Body = z.object({
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(20_000) }))
    .min(1)
    .max(50),
});

export const Route = createFileRoute("/api/public/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: "Invalid request." }, { status: 400 });
        try {
          const ai = createGateway({ env: process.env as Record<string, string | undefined> });
          const { textStream } = await ai.chat({
            systemPrompt:
              "You are a friendly, concise assistant inside a chat widget. Use markdown.",
            messages: parsed.data.messages,
            stream: true,
            signal: request.signal,
          });
          const encoder = new TextEncoder();
          const body = new ReadableStream<Uint8Array>({
            async start(controller) {
              try {
                for await (const delta of textStream) controller.enqueue(encoder.encode(delta));
              } catch {
                /* client stopped or provider dropped */
              }
              controller.close();
            },
          });
          return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
        } catch (e) {
          const status = e instanceof AIGatewayError && e.status ? e.status : 502;
          const error =
            e instanceof AIGatewayError && e.code === "missing_key"
              ? "The assistant isn't configured yet (missing AI key)."
              : e instanceof Error
                ? e.message
                : "The assistant is unavailable right now.";
          return Response.json({ error }, { status });
        }
      },
    },
  },
});
