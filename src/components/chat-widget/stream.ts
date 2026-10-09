import type { ChatSource } from "./types";

export interface StreamRequest {
  endpoint: string;
  messages: { role: "user" | "assistant"; content: string }[];
  headers?: Record<string, string>;
  /** Extra JSON fields merged into the request body (e.g. `context`, `knowledgeBaseId`). */
  body?: Record<string, unknown>;
  signal: AbortSignal;
  onText: (text: string) => void;
  onSources?: (sources: ChatSource[]) => void;
}

/**
 * POSTs `{ messages, ...body }` and reads either a plain-text stream or SSE.
 * SSE frames may carry `token | text | content | delta`, `sources`, or `error`.
 */
export async function streamChat({
  endpoint,
  messages,
  headers,
  body,
  signal,
  onText,
  onSources,
}: StreamRequest): Promise<string> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    signal,
    body: JSON.stringify({ ...body, messages }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as {
      error?: string;
      message?: string;
    } | null;
    throw new Error(detail?.error || detail?.message || `Chat request failed (${res.status})`);
  }
  if (!res.body) throw new Error("The assistant returned no response.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  const sse = (res.headers.get("content-type") ?? "").includes("text/event-stream");
  let full = "";
  let buffer = "";

  const handleFrame = (frame: string) => {
    for (const line of frame.split(/\r?\n/)) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload || payload === "[DONE]") continue;
      let data: {
        token?: string;
        text?: string;
        content?: string;
        delta?: string;
        error?: string;
        sources?: ChatSource[];
      };
      try {
        data = JSON.parse(payload);
      } catch {
        full += payload;
        continue;
      }
      if (data.error) throw new Error(data.error);
      if (Array.isArray(data.sources)) onSources?.(data.sources);
      full += data.token ?? data.text ?? data.content ?? data.delta ?? "";
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!sse) {
      full += chunk;
      onText(full);
      continue;
    }
    buffer += chunk;
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    frames.forEach(handleFrame);
    onText(full);
  }
  if (sse && buffer.trim()) {
    handleFrame(buffer);
    onText(full);
  }
  return full;
}
