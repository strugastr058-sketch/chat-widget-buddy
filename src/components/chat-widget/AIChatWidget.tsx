import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MessageCircle, X, Trash2, RotateCcw, Grip } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
}
export interface AIChatWidgetProps {
  /** POST { messages: [{ role, content }] }; returns streaming plain text or SSE. */
  apiEndpoint: string;
  /** floating = bubble + movable window, sidebar = slide-in drawer, fullpage = fills the screen, embedded = inline panel. */
  mode?: "floating" | "sidebar" | "fullpage" | "embedded";
  /** Which side the sidebar opens from. */
  side?: "left" | "right";
  /** Start opened (floating/sidebar). */
  defaultOpen?: boolean;
  title?: string;
  greeting?: string;
  placeholder?: string;
  storageKey?: string;
  persistence?: "local" | "session" | "none";
  initialPrompts?: string[];
  renderMessageActions?: (message: ChatMessage) => ReactNode;
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
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* Browser storage may be unavailable. */
  }
  return greeting ? [{ id: uid(), role: "assistant", content: greeting }] : [];
}
async function streamChat(
  endpoint: string,
  messages: ChatMessage[],
  onText: (text: string) => void,
  signal: AbortSignal,
) {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal,
    body: JSON.stringify({
      messages: messages.filter((m) => !m.error).map(({ role, content }) => ({ role, content })),
    }),
  });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(detail?.error || `Chat request failed (${res.status})`);
  }
  if (!res.body) throw new Error("The assistant returned no response.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "",
    buffer = "";
  const sse = (res.headers.get("content-type") ?? "").includes("text/event-stream");
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
    for (const frame of frames) {
      for (const line of frame.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const data = JSON.parse(payload) as {
            token?: string;
            text?: string;
            content?: string;
            error?: string;
          };
          if (data.error) throw new Error(data.error);
          full += data.token ?? data.text ?? data.content ?? "";
        } catch (e) {
          if (e instanceof SyntaxError) full += payload;
          else throw e;
        }
      }
    }
    onText(full);
  }
  return full;
}

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
  side = "right",
  defaultOpen = false,
}: AIChatWidgetProps) {
  const [open, setOpen] = useState(mode === "embedded" || mode === "fullpage" || defaultOpen);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [draft, setDraft] = useState("");
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = status !== "idle";

  useEffect(() => {
    setMessages(loadMessages(getStore(persistence), storageKey, greeting));
  }, [storageKey, persistence, greeting]);
  useEffect(() => {
    if (!messages.length) return;
    try {
      getStore(persistence)?.setItem(storageKey, JSON.stringify(messages));
    } catch {
      /* Quota exceeded: current chat still works. */
    }
  }, [messages, storageKey, persistence]);
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);
  useEffect(() => {
    if (!open || (mode !== "floating" && mode !== "sidebar")) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [mode, open]);

  const run = useCallback(
    async (history: ChatMessage[]) => {
      const assistant: ChatMessage = { id: uid(), role: "assistant", content: "" };
      setMessages([...history, assistant]);
      setStatus("submitted");
      const controller = new AbortController();
      abortRef.current = controller;
      try {
        const text = await streamChat(
          apiEndpoint,
          history,
          (content) => {
            setStatus("streaming");
            setMessages((prev) => prev.map((m) => (m.id === assistant.id ? { ...m, content } : m)));
          },
          controller.signal,
        );
        if (!text.trim()) throw new Error("The assistant returned an empty response.");
      } catch (error) {
        if (controller.signal.aborted) {
          setMessages((prev) => prev.filter((m) => m.id !== assistant.id || m.content));
        } else {
          const text = error instanceof Error ? error.message : "Couldn't reach the assistant.";
          setMessages((prev) =>
            prev.map((m) => (m.id === assistant.id ? { ...m, content: text, error: true } : m)),
          );
        }
      } finally {
        setStatus("idle");
        abortRef.current = null;
      }
    },
    [apiEndpoint],
  );

  const send = useCallback(
    (content: string) => {
      if (busy || !content.trim()) return;
      setDraft("");
      void run([...messages, { id: uid(), role: "user", content: content.trim() }]);
    },
    [busy, messages, run],
  );
  const retry = () => {
    if (busy) return;
    const history = messages.at(-1)?.error ? messages.slice(0, -1) : messages;
    if (history.at(-1)?.role === "user") void run(history);
  };
  const clear = () => {
    abortRef.current?.abort();
    const fresh: ChatMessage[] = greeting
      ? [{ id: uid(), role: "assistant", content: greeting }]
      : [];
    setMessages(fresh);
    setStatus("idle");
    try {
      getStore(persistence)?.setItem(storageKey, JSON.stringify(fresh));
    } catch {
      /* Browser storage may be unavailable. */
    }
  };
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (
      mode !== "floating" ||
      event.pointerType === "touch" ||
      (event.target as HTMLElement).closest("button")
    )
      return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    const dx = event.clientX - rect.left,
      dy = event.clientY - rect.top;
    const move = (e: PointerEvent) =>
      setBox({
        x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, e.clientX - dx)),
        y: Math.max(8, Math.min(window.innerHeight - rect.height - 8, e.clientY - dy)),
        width: rect.width,
        height: rect.height,
      });
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect || event.pointerType === "touch") return;
    event.preventDefault();
    event.stopPropagation();
    const originX = event.clientX,
      originY = event.clientY;
    const move = (e: PointerEvent) => {
      if (mode === "sidebar") {
        const dx = side === "right" ? originX - e.clientX : e.clientX - originX;
        setSidebarWidth(Math.max(280, Math.min(window.innerWidth - 40, rect.width + dx)));
      } else
        setBox({
          x: rect.left,
          y: rect.top,
          width: Math.min(
            window.innerWidth - rect.left - 8,
            Math.max(300, rect.width + e.clientX - originX),
          ),
          height: Math.min(
            window.innerHeight - rect.top - 8,
            Math.max(320, rect.height + e.clientY - originY),
          ),
        });
    };
    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop, { once: true });
  };
  const handleSubmit = ({ text }: PromptInputMessage) => send(text);
  const lastId = messages.at(-1)?.id;
  const hasUserMessage = messages.some((m) => m.role === "user");
  const panel = (
    <div
      ref={panelRef}
      className={`aichat-panel aichat-panel--${mode} ${mode === "sidebar" ? `aichat-panel--side-${side}` : ""} ${mode === "floating" && box ? "aichat-panel--positioned" : ""}`}
      style={
        mode === "floating" && box
          ? { left: box.x, top: box.y, width: box.width, height: box.height }
          : mode === "sidebar"
            ? { width: sidebarWidth }
            : undefined
      }
      role={mode === "floating" || mode === "sidebar" ? "dialog" : "region"}
      aria-label={title}
    >
      <div
        className={`aichat-header ${mode === "floating" ? "aichat-header--draggable" : ""}`}
        onPointerDown={startDrag}
      >
        <div className="aichat-title-wrap">
          <span className="aichat-title">{title}</span>
          {showStatus && busy && (
            <span className="aichat-status" aria-live="polite">
              {status === "submitted" ? "Thinking…" : "Writing…"}
            </span>
          )}
        </div>
        <div className="aichat-header-actions">
          <Button
            size="icon"
            variant="ghost"
            title="Clear conversation"
            aria-label="Clear conversation"
            onClick={clear}
          >
            <Trash2 size={16} />
          </Button>
          {(mode === "floating" || mode === "sidebar") && (
            <Button
              size="icon"
              variant="ghost"
              title="Close chat"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
            >
              <X size={16} />
            </Button>
          )}
        </div>
      </div>
      <Conversation className="aichat-conversation">
        <ConversationContent className="aichat-transcript">
          {messages.map((m) => (
            <Message key={m.id} from={m.role} className="aichat-message">
              <MessageContent
                className={
                  m.role === "user"
                    ? "aichat-user-message"
                    : m.error
                      ? "aichat-error-message"
                      : "aichat-assistant-message"
                }
              >
                {m.role === "assistant" && !m.content && busy ? (
                  <Shimmer>Thinking…</Shimmer>
                ) : m.content ? (
                  <MessageResponse>{m.content}</MessageResponse>
                ) : null}
                {m.error && m.id === lastId && (
                  <Button size="sm" variant="outline" onClick={retry} disabled={busy}>
                    <RotateCcw size={13} /> Retry
                  </Button>
                )}
                {m.role === "assistant" &&
                  !m.error &&
                  !(busy && m.id === lastId) &&
                  renderMessageActions?.(m)}
              </MessageContent>
            </Message>
          ))}
          {!hasUserMessage && initialPrompts?.length ? (
            <div className="aichat-prompts">
              {initialPrompts.map((p) => (
                <Button
                  key={p}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => send(p)}
                  disabled={busy}
                >
                  {p}
                </Button>
              ))}
            </div>
          ) : null}
        </ConversationContent>
        <ConversationScrollButton aria-label="Scroll to latest message" />
      </Conversation>
      <div className="aichat-composer-wrap">
        <PromptInput className="aichat-prompt" onSubmit={handleSubmit}>
          <PromptInputTextarea
            name="message"
            autoFocus={mode !== "floating" || open}
            placeholder={placeholder}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            className="aichat-textarea"
          />
          <PromptInputFooter className="aichat-footer">
            <span />
            <PromptInputSubmit
              status={busy ? "submitted" : "ready"}
              disabled={busy || !draft.trim()}
              aria-label="Send message"
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
      {mode === "sidebar" && (
        <div
          className="aichat-sidebar-handle"
          role="separator"
          aria-label="Resize chat sidebar"
          title="Drag to resize"
          onPointerDown={startResize}
        />
      )}
      {mode === "floating" && (
        <div
          className="aichat-resize"
          role="separator"
          aria-label="Resize chat window"
          title="Drag to resize"
          onPointerDown={startResize}
        >
          <Grip size={15} />
        </div>
      )}
    </div>
  );
  if (mode === "embedded" || mode === "fullpage") return panel;
  const launcherSide =
    mode === "sidebar" ? (side === "left" ? "bottom-left" : "bottom-right") : position;
  return (
    <div
      className={`aichat-root aichat-root--${launcherSide} aichat-root--${mode}`}
      style={accentColor ? ({ "--aichat-accent": accentColor } as React.CSSProperties) : undefined}
    >
      {open && mode === "sidebar" && (
        <div className="aichat-backdrop" onClick={() => setOpen(false)} />
      )}
      {open && panel}
      <Button
        type="button"
        className="aichat-bubble"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Close chat" : "Open chat"}
        title={open ? "Close chat" : "Open chat"}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </Button>
    </div>
  );
}
export default AIChatWidget;
