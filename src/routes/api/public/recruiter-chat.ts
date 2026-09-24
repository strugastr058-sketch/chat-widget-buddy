import { createFileRoute } from "@tanstack/react-router";

// Demo streaming endpoint for the AIChatWidget. Replace with your Firebase
// function URL in production — the widget only needs POST { messages } and a
// streamed text (or SSE) response.
export const Route = createFileRoute("/api/public/recruiter-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json().catch(() => ({}))) as {
          messages?: { role: string; content: string }[];
        };
        const last = body.messages?.filter((m) => m.role === "user").pop()?.content ?? "";

        const reply =
          `You said: "${last}".\n\n` +
          `This is the **demo endpoint** streaming a reply token by token. ` +
          `Point the widget at your own backend with:\n\n` +
          "```tsx\n<AIChatWidget apiEndpoint=\"/api/recruiter-chat\" />\n```\n\n" +
          `- Streams plain text or SSE\n- Persists history in the browser\n- Works floating or embedded`;

        const encoder = new TextEncoder();
        const words = reply.split(/(?<=\s)/);
        const stream = new ReadableStream<Uint8Array>({
          async start(controller) {
            for (const w of words) {
              controller.enqueue(encoder.encode(w));
              await new Promise((r) => setTimeout(r, 30));
            }
            controller.close();
          },
        });

        return new Response(stream, {
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      },
    },
  },
});
