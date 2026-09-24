import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { MessageCircle, X, Send, Trash2, Loader2 } from "lucide-react";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface AIChatWidgetProps {
  /** Endpoint that accepts POST { messages: ChatMessage[] } and streams back text (SSE or plain). */
  apiEndpoint: string;
  /** "floating" renders a bubble that opens a drawer; "embedded" renders an inline panel. */
  mode?: "floating" | "embedded";
  /** Title shown in the widget header. */
  title?: string;
  /** First assistant message shown when history is empty. */
  greeting?: string;
  /** Input placeholder text. */
  placeholder?: string;
  /** localStorage key for persisting history. */
  storageKey?: string;
  /** Accent color (any CSS color) for the bubble, send button and user messages. */
  accentColor?: string;
  /** Corner position for floating mode. */
  position?: "bottom-right" | "bottom-left";
}

const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

function loadMessages(key: string, greeting?: string): ChatMessage[] {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as ChatMessage[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* ignore corrupt storage */
  }
  return greeting ? [{ id: uid(), role: "assistant", content: greeting }] : [];
}

async function streamChat(
  apiEndpoint: string,
  messages: ChatMessage[],
  onToken: (full: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const res = await fetch(apiEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: messages.map(({ role, content }) => ({ role, content })) }),
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

export function AIChatWidget({
  apiEndpoint,
  mode = "floating",
  title = "Chat",
  greeting = "Hi! How can I help you today?",
  placeholder = "Type a message…",
  storageKey = "ai-chat-widget:messages",
  accentColor,
  position = "bottom-right",
}: AIChatWidgetProps) {
  const [open, setOpen] = useState(mode === "embedded");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<"idle" | "submitted" | "streaming">("idle");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = status !== "idle";

  // Load persisted history once on mount (client-only).
  useEffect(() => {
    setMessages(loadMessages(storageKey, greeting));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  // Persist on change.
  useEffect(() => {
    if (messages.length === 0) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      /* storage full — non-fatal */
    }
  }, [messages, storageKey]);

  // Auto-scroll to bottom.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status, open]);

  // Keep the composer focused.
  useEffect(() => {
    if (open && !busy) inputRef.current?.focus();
  }, [open, busy]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    const userMsg: ChatMessage = { id: uid(), role: "user", content: text };
    const assistantMsg: ChatMessage = { id: uid(), role: "assistant", content: "" };
    const next = [...messages, userMsg];
    setMessages([...next, assistantMsg]);
    setInput("");
    setStatus("submitted");

    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat(
        apiEndpoint,
        next,
        (full) => {
          setStatus("streaming");
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantMsg.id ? { ...m, content: full } : m)),
          );
        },
        controller.signal,
      );
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: m.content || "Sorry — something went wrong. Please try again." }
              : m,
          ),
        );
      }
    } finally {
      setStatus("idle");
      abortRef.current = null;
    }
  }, [apiEndpoint, busy, input, messages]);

  const clear = useCallback(() => {
    abortRef.current?.abort();
    const fresh = greeting ? [{ id: uid(), role: "assistant" as const, content: greeting }] : [];
    setMessages(fresh);
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(fresh));
    } catch {
      /* ignore */
    }
  }, [greeting, storageKey]);

  const style = accentColor ? ({ "--aichat-accent": accentColor } as React.CSSProperties) : undefined;

  const panel = (
    <div
      className={`aichat-panel ${mode === "embedded" ? "aichat-panel--embedded" : ""}`}
      style={style}
      role="dialog"
      aria-label={title}
    >
      <div className="aichat-header">
        <span className="aichat-title">{title}</span>
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

      <div className="aichat-messages" ref={scrollRef}>
        {messages.map((m) => (
          <div key={m.id} className={`aichat-msg aichat-msg--${m.role}`}>
            {m.role === "assistant" ? (
              m.content === "" && busy ? (
                <TypingDots />
              ) : (
                <div className="aichat-markdown">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              )
            ) : (
              m.content
            )}
          </div>
        ))}
        {status === "submitted" && messages[messages.length - 1]?.content !== "" && <TypingDots />}
      </div>

      <form
        className="aichat-composer"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
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
              void send();
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
