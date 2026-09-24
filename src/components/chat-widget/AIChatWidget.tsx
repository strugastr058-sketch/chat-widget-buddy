import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { MessageCircle, X, Send, Trash2, Loader2, RotateCcw } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}

export interface AIChatWidgetProps {
  /** Endpoint that accepts POST { messages } and streams back text (SSE or plain). */
  apiEndpoint: string;
  mode?: "floating" | "embedded";
  title?: string;
  greeting?: string;
  placeholder?: string;
  /** Storage key for persisting history. */
  storageKey?: string;
  /** Where to persist history. Default "local". */
  persistence?: "local" | "session" | "none";
  /** Starter prompt pills shown before the user's first message. Clicking sends it. */
  initialPrompts?: string[];
  /** Optional slot rendered under each finished assistant message (e.g. booking link). */
  renderMessageActions?: (message: ChatMessage) => ReactNode;
  /** Show the Connecting/Thinking/Streaming badge in the header. Default true. */
  showStatus?: boolean;
  accentColor?: string;
  position?: "bottom-right" | "bottom-left";
}

type Status = "idle" | "submitted" | "streaming";

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function getStore(p: AIChatWidgetProps["persistence"]): Storage | null {
  if (p === "none" || typeof window === "undefined") return null;
  return p === "session" ? window.sessionStorage : window.localStorage;
}

function loadMessages(store: Storage | null, key: string, greeting?: string): ChatMessage[] {
  try {
    const raw = store?.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* ignore */
  }
  return greeting ? [{ id: uid(), role: "assistant", content: greeting }] : [];
}

async function streamChat(
  apiEndpoint: string,
  messages: ChatMessage[],
  onToken: (full: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch(apiEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
    }),
    signal,
  });
  if (!res.ok || !res.body) throw new Error(`Chat request failed (${res.status})`);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  let buffer = "";
  const isSSE = (res.headers.get("content-type") ?? "").includes("text/event-stream");

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (isSSE) {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const t = line.trim();
        if (!t.startsWith("data:")) continue;
        const payload = t.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const json = JSON.parse(payload);
          full += json.token ?? json.text ?? json.content ?? "";
        } catch {
          full += payload;
        }
      }
    } else {
      full += chunk;
    }
    onToken(full);
  }
  return full;
}

function TypingDots() {
  return (
    <span className="aichat-typing" aria-label="Assistant is typing">
      <span />
      <span />
      <span />
    </span>
  );
}

const STATUS_LABEL: Record<Status, string> = {
  idle: "",
  submitted: "Thinking…",
  streaming: "Streaming…",
};

export function AIChatWidget({
  apiEndpoint,
  mode = "floating",
  title = "Chat",
  greeting = "Hi! How can I help you today?",
  placeholder = "Type a message…",
  storageKey = "ai-chat-widget:messages",
  persistence = "local",
  initialPrompts,
  renderMessageActions,
  showStatus = true,
  accentColor,
  position = "bottom-right",
}: AIChatWidgetProps) {
  const [open, setOpen] = useState(mode === "embedded");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const stickRef = useRef(true);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = status !== "idle";

  useEffect(() => {
    setMessages(loadMessages(getStore(persistence), storageKey, greeting));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey, persistence]);

  useEffect(() => {
    if (messages.length === 0) return;
    try {
      getStore(persistence)?.setItem(storageKey, JSON.stringify(messages));
    } catch {
      /* non-fatal */
    }
  }, [messages, storageKey, persistence]);

  // Auto-scroll only while the user is near the bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el && stickRef.current) el.scrollTop = el.scrollHeight;
  }, [messages, status, open]);

  useEffect(() => {
    if (open && !busy) inputRef.current?.focus();
  }, [open, busy]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    stickRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const run = useCallback(
    async (history: ChatMessage[]) => {
      const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "" };
      setMessages([...history, assistantMsg]);
      setStatus("submitted");
      stickRef.current = true;

      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const full = await streamChat(
          apiEndpoint,
          history,
          (text) => {
            setStatus("streaming");
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: text } : m)),
            );
          },
          controller.signal,
        );
        if (!full.trim()) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? { ...m, content: "The assistant returned an empty response.", error: true }
                : m,
            ),
          );
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMsg.id
                ? {
                    ...m,
                    content: m.content || "Couldn't reach the assistant. Check your connection and try again.",
                    error: true,
                  }
                : m,
            ),
          );
        }
      } finally {
        setStatus("idle");
        abortRef.current = null;
      }
    },
    [apiEndpoint],
  );

  const sendText = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text || busy) return;
      setInput("");
      void run([...messages, { id: uid(), role: "user", content: text }]);
    },
    [busy, messages, run],
  );

  const retry = useCallback(() => {
    if (busy) return;
    // Drop trailing failed assistant message and resend.
    const idx = messages.length - 1;
    const history = messages[idx]?.error ? messages.slice(0, idx) : messages;
    if (history[history.length - 1]?.role !== "user") return;
    void run(history);
  }, [busy, messages, run]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    const fresh = greeting ? [{ id: uid(), role: "assistant" as const, content: greeting }] : [];
    setMessages(fresh);
    try {
      getStore(persistence)?.setItem(storageKey, JSON.stringify(fresh));
    } catch {
      /* ignore */
    }
  }, [greeting, storageKey, persistence]);

  const style = accentColor ? ({ "--aichat-accent": accentColor } as React.CSSProperties) : undefined;
  const hasUserMessage = messages.some((m) => m.role === "user");
  const lastId = messages[messages.length - 1]?.id;

  const panel = (
    <div
      className={`aichat-panel ${mode === "embedded" ? "aichat-panel--embedded" : ""}`}
      style={style}
      role="dialog"
      aria-label={title}
    >
      <div className="aichat-header">
        <div className="aichat-title-wrap">
          <span className="aichat-title">{title}</span>
          {showStatus && busy && (
            <span className="aichat-status" aria-live="polite">
              <span className="aichat-status-dot" />
              {STATUS_LABEL[status]}
            </span>
          )}
        </div>
        <div className="aichat-header-actions">
          <button type="button" className="aichat-icon-btn" onClick={clear} aria-label="Clear conversation">
            <Trash2 size={16} />
          </button>
          {mode === "floating" && (
            <button type="button" className="aichat-icon-btn" onClick={() => setOpen(false)} aria-label="Close chat">
              <X size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="aichat-messages" ref={scrollRef} onScroll={onScroll}>
        {messages.map((m) => (
          <div key={m.id} className={`aichat-msg aichat-msg--${m.role} ${m.error ? "aichat-msg--error" : ""}`}>
            {m.role === "assistant" ? (
              m.content === "" && busy ? (
                <TypingDots />
              ) : (
                <>
                  <div className="aichat-markdown">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                  {m.error && m.id === lastId && (
                    <button type="button" className="aichat-retry" onClick={retry} disabled={busy}>
                      <RotateCcw size={13} /> Retry
                    </button>
                  )}
                  {!m.error && !(busy && m.id === lastId) && renderMessageActions?.(m)}
                </>
              )
            ) : (
              m.content
            )}
          </div>
        ))}

        {!hasUserMessage && initialPrompts && initialPrompts.length > 0 && (
          <div className="aichat-prompts">
            {initialPrompts.map((p) => (
              <button key={p} type="button" className="aichat-pill" onClick={() => sendText(p)} disabled={busy}>
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <form
        className="aichat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          sendText(input);
        }}
      >
        <textarea
          ref={inputRef}
          className="aichat-input"
          value={input}
          placeholder={placeholder}
          rows={1}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              sendText(input);
            }
          }}
        />
        <button type="submit" className="aichat-send" disabled={busy || !input.trim()} aria-label="Send message">
          {busy ? <Loader2 size={16} className="aichat-spin" /> : <Send size={16} />}
        </button>
      </form>
    </div>
  );

  if (mode === "embedded") return panel;

  return (
    <div className={`aichat-root aichat-root--${position}`} style={style}>
      {open && panel}
      <button
        type="button"
        className="aichat-bubble"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open chat"}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </button>
    </div>
  );
}

export default AIChatWidget;
