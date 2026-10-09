import { useCallback, useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  ExternalLink,
  Grip,
  MessageCircle,
  RefreshCw,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  type PromptInputMessage,
} from "@/components/ai-elements/prompt-input";
import { streamChat } from "./stream";
import { resolve, type AIChatWidgetProps, type ChatFeatures, type ChatMessage } from "./types";

export type { AIChatWidgetProps, ChatMessage, ChatFeatures } from "./types";

type Status = "idle" | "submitted" | "streaming";
const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
const DEFAULT_FEATURES: Required<ChatFeatures> = {
  stop: true,
  copy: true,
  regenerate: true,
  feedback: false,
  sources: true,
  clear: true,
  timestamps: false,
};

function getStore(p: AIChatWidgetProps["persistence"]): Storage | null {
  if (p === "none" || typeof window === "undefined") return null;
  try {
    return p === "session" ? window.sessionStorage : window.localStorage;
  } catch {
    return null;
  }
}
const greetingMessage = (greeting?: string): ChatMessage[] =>
  greeting ? [{ id: uid(), role: "assistant", content: greeting }] : [];
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
  return greetingMessage(greeting);
}

function useDarkTheme(theme: AIChatWidgetProps["theme"]) {
  const [systemDark, setSystemDark] = useState(false);
  useEffect(() => {
    if (theme !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const sync = () => setSystemDark(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, [theme]);
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  if (theme === "auto") return systemDark ? "dark" : "light";
  return "";
}

export function AIChatWidget({
  apiEndpoint,
  mode = "floating",
  side = "right",
  position = "bottom-right",
  defaultOpen = false,
  open: openProp,
  onOpenChange,
  title = "Chat",
  subtitle,
  greeting = "Hi! How can I help you today?",
  placeholder = "Type a message…",
  initialPrompts,
  disclaimer,
  maxLength = 4000,
  theme = "inherit",
  accentColor,
  className,
  storageKey = "ai-chat-widget:messages",
  persistence = "local",
  features: featuresProp,
  showStatus = true,
  context,
  headers,
  body,
  onSend,
  onResponse,
  onError,
  onFeedback,
  onClear,
  renderMessageActions,
}: AIChatWidgetProps) {
  const features = { ...DEFAULT_FEATURES, ...featuresProp };
  const inline = mode === "embedded" || mode === "fullpage";
  const [openState, setOpenState] = useState(inline || defaultOpen);
  const open = inline || (openProp ?? openState);
  const setOpen = (next: boolean) => {
    setOpenState(next);
    onOpenChange?.(next);
  };
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [draft, setDraft] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null,
  );
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = status !== "idle";
  const themeClass = useDarkTheme(theme);
  const cb = useRef({ context, headers, body, onSend, onResponse, onError });
  cb.current = { context, headers, body, onSend, onResponse, onError };

  useEffect(() => {
    setMessages(loadMessages(getStore(persistence), storageKey, greeting));
  }, [storageKey, persistence, greeting]);
  useEffect(() => {
    if (!messages.length || busy) return;
    try {
      getStore(persistence)?.setItem(storageKey, JSON.stringify(messages));
    } catch {
      /* Quota exceeded: current chat still works. */
    }
  }, [messages, storageKey, persistence, busy]);
  useEffect(() => () => abortRef.current?.abort(), []);
  useEffect(() => {
    if (!open || inline) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline, open]);

  const run = useCallback(
    async (history: ChatMessage[]) => {
      const assistant: ChatMessage = {
        id: uid(),
        role: "assistant",
        content: "",
        createdAt: Date.now(),
      };
      setMessages([...history, assistant]);
      setStatus("submitted");
      const controller = new AbortController();
      abortRef.current = controller;
      const patch = (p: Partial<ChatMessage>) =>
        setMessages((prev) => prev.map((m) => (m.id === assistant.id ? { ...m, ...p } : m)));
      const { context: ctx, headers: hdrs, body: extra } = cb.current;
      let sources: ChatMessage["sources"];
      try {
        const contextValue = resolve(ctx);
        const text = await streamChat({
          endpoint: apiEndpoint,
          messages: history
            .filter((m) => !m.error && m.content)
            .map(({ role, content }) => ({ role, content })),
          headers: resolve(hdrs),
          body: { ...resolve(extra), ...(contextValue ? { context: contextValue } : {}) },
          signal: controller.signal,
          onText: (content) => {
            setStatus("streaming");
            patch({ content });
          },
          onSources: (s) => {
            sources = s;
            patch({ sources: s });
          },
        });
        if (!text.trim()) throw new Error("The assistant returned an empty response.");
        cb.current.onResponse?.({ ...assistant, content: text, sources });
      } catch (error) {
        if (controller.signal.aborted) {
          setMessages((prev) =>
            prev
              .filter((m) => m.id !== assistant.id || m.content)
              .map((m) => (m.id === assistant.id ? { ...m, stopped: true } : m)),
          );
        } else {
          const err = error instanceof Error ? error : new Error("Couldn't reach the assistant.");
          patch({ content: err.message, error: true });
          cb.current.onError?.(err);
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
      const text = content.trim().slice(0, maxLength);
      if (busy || !text) return;
      setDraft("");
      const message: ChatMessage = {
        id: uid(),
        role: "user",
        content: text,
        createdAt: Date.now(),
      };
      cb.current.onSend?.(message);
      void run([...messages, message]);
    },
    [busy, messages, run, maxLength],
  );
  const stop = () => abortRef.current?.abort();
  const regenerate = () => {
    if (busy) return;
    const history = messages.at(-1)?.role === "assistant" ? messages.slice(0, -1) : messages;
    if (history.at(-1)?.role === "user") void run(history);
  };
  const clear = () => {
    abortRef.current?.abort();
    const fresh = greetingMessage(greeting);
    setMessages(fresh);
    setStatus("idle");
    onClear?.();
    try {
      getStore(persistence)?.setItem(storageKey, JSON.stringify(fresh));
    } catch {
      /* Browser storage may be unavailable. */
    }
  };
  const copy = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopied(m.id);
      setTimeout(() => setCopied((c) => (c === m.id ? null : c)), 1500);
    } catch {
      /* Clipboard blocked. */
    }
  };
  const rate = (m: ChatMessage, value: "up" | "down") => {
    const next = m.feedback === value ? undefined : value;
    setMessages((prev) => prev.map((x) => (x.id === m.id ? { ...x, feedback: next } : x)));
    if (next) onFeedback?.(m, next);
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
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
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
    const end = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", end);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", end, { once: true });
  };

  const handleSubmit = ({ text }: PromptInputMessage) => send(text);
  const lastId = messages.at(-1)?.id;
  const hasUserMessage = messages.some((m) => m.role === "user");
  const accentStyle = accentColor
    ? ({ "--aichat-accent": accentColor } as React.CSSProperties)
    : {};
  const time = (t?: number) =>
    t ? new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : null;

  const panel = (
    <div
      ref={panelRef}
      className={[
        "aichat-panel",
        `aichat-panel--${mode}`,
        mode === "sidebar" && `aichat-panel--side-${side}`,
        mode === "floating" && box && "aichat-panel--positioned",
        themeClass,
        themeClass && "aichat-themed",
        inline && className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        ...accentStyle,
        ...(mode === "floating" && box
          ? { left: box.x, top: box.y, width: box.width, height: box.height }
          : mode === "sidebar"
            ? { width: sidebarWidth }
            : {}),
      }}
      role={inline ? "region" : "dialog"}
      aria-label={title}
    >
      <div
        className={`aichat-header ${mode === "floating" ? "aichat-header--draggable" : ""}`}
        onPointerDown={startDrag}
      >
        <div className="aichat-title-wrap">
          <span className="aichat-title">{title}</span>
          {subtitle && <span className="aichat-subtitle">{subtitle}</span>}
        </div>
        {showStatus && busy && (
          <span className="aichat-status" aria-live="polite">
            {status === "submitted" ? "Thinking…" : "Writing…"}
          </span>
        )}
        <div className="aichat-header-actions">
          {features.clear && (
            <Button
              size="icon"
              variant="ghost"
              title="Clear conversation"
              aria-label="Clear conversation"
              onClick={clear}
            >
              <Trash2 size={16} />
            </Button>
          )}
          {!inline && (
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
          {messages.map((m) => {
            const streamingThis = busy && m.id === lastId;
            const done = m.role === "assistant" && !m.error && !streamingThis && m.content;
            const isGreeting = m.role === "assistant" && m === messages[0] && !m.createdAt;
            return (
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
                  {m.stopped && <span className="aichat-note">Stopped</span>}
                  {features.sources && m.sources?.length ? (
                    <ul className="aichat-sources" aria-label="Sources">
                      {m.sources.map((s, i) => (
                        <li key={i}>
                          {s.url ? (
                            <a href={s.url} target="_blank" rel="noreferrer noopener">
                              {s.title} <ExternalLink size={11} aria-hidden="true" />
                            </a>
                          ) : (
                            <span>{s.title}</span>
                          )}
                          {s.snippet && <p>{s.snippet}</p>}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {m.error && m.id === lastId && (
                    <Button size="sm" variant="outline" onClick={regenerate} disabled={busy}>
                      <RotateCcw size={13} /> Retry
                    </Button>
                  )}
                </MessageContent>
                {done && !isGreeting && (
                  <MessageActions className="aichat-actions">
                    {features.copy && (
                      <MessageAction label="Copy reply" title="Copy" onClick={() => copy(m)}>
                        {copied === m.id ? <Check size={14} /> : <Copy size={14} />}
                      </MessageAction>
                    )}
                    {features.regenerate && m.id === lastId && hasUserMessage && (
                      <MessageAction
                        label="Regenerate reply"
                        title="Regenerate"
                        onClick={regenerate}
                      >
                        <RefreshCw size={14} />
                      </MessageAction>
                    )}
                    {features.feedback && (
                      <>
                        <MessageAction
                          label="Good reply"
                          title="Good reply"
                          aria-pressed={m.feedback === "up"}
                          data-active={m.feedback === "up"}
                          onClick={() => rate(m, "up")}
                        >
                          <ThumbsUp size={14} />
                        </MessageAction>
                        <MessageAction
                          label="Bad reply"
                          title="Bad reply"
                          aria-pressed={m.feedback === "down"}
                          data-active={m.feedback === "down"}
                          onClick={() => rate(m, "down")}
                        >
                          <ThumbsDown size={14} />
                        </MessageAction>
                      </>
                    )}
                    {renderMessageActions?.(m)}
                  </MessageActions>
                )}
                {features.timestamps && m.createdAt && (
                  <span className="aichat-time">{time(m.createdAt)}</span>
                )}
              </Message>
            );
          })}
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
            maxLength={maxLength}
            onChange={(e) => setDraft(e.target.value)}
            disabled={busy}
            className="aichat-textarea"
          />
          <PromptInputFooter className="aichat-footer">
            <span className="aichat-count">
              {draft.length > maxLength * 0.8 ? `${draft.length}/${maxLength}` : ""}
            </span>
            <PromptInputSubmit
              status={status === "idle" ? "ready" : status}
              onStop={features.stop ? stop : undefined}
              disabled={busy ? !features.stop : !draft.trim()}
              aria-label={busy && features.stop ? "Stop reply" : "Send message"}
            />
          </PromptInputFooter>
        </PromptInput>
        {disclaimer && <p className="aichat-disclaimer">{disclaimer}</p>}
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
  if (inline) return panel;
  const launcherSide =
    mode === "sidebar" ? (side === "left" ? "bottom-left" : "bottom-right") : position;
  return (
    <div
      className={`aichat-root aichat-root--${launcherSide} aichat-root--${mode} ${className ?? ""}`}
      style={accentColor ? accentStyle : undefined}
    >
      {open && mode === "sidebar" && (
        <div className="aichat-backdrop" onClick={() => setOpen(false)} />
      )}
      {open && panel}
      <Button
        type="button"
        className="aichat-bubble"
        onClick={() => setOpen(!open)}
        aria-label={open ? "Close chat" : "Open chat"}
        title={open ? "Close chat" : "Open chat"}
      >
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </Button>
    </div>
  );
}
export default AIChatWidget;
