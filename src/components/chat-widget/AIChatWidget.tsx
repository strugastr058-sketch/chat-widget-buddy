import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { MessageCircle, X, Trash2, RotateCcw, Paperclip, Grip, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Conversation, ConversationContent, ConversationScrollButton } from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse } from "@/components/ai-elements/message";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { PromptInput, PromptInputFooter, PromptInputSubmit, PromptInputTextarea, PromptInputTools, usePromptInputAttachments, type PromptInputMessage } from "@/components/ai-elements/prompt-input";

export interface ChatAttachment {
  name: string;
  mediaType: string;
  url: string;
}
export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  attachments?: ChatAttachment[];
  error?: boolean;
}
export interface AIChatWidgetProps {
  /** POST { messages: [{ role, content, attachments? }] }; returns streaming plain text or SSE. */
  apiEndpoint: string;
  mode?: "floating" | "embedded";
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
const MAX_FILES = 3;
const MAX_FILE_BYTES = 1_500_000;
const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,application/pdf,text/plain,text/markdown,text/csv";

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
  } catch { /* Browser storage may be unavailable. */ }
  return greeting ? [{ id: uid(), role: "assistant", content: greeting }] : [];
}
async function streamChat(endpoint: string, messages: ChatMessage[], onText: (text: string) => void, signal: AbortSignal) {
  const res = await fetch(endpoint, {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ messages: messages.filter(m => !m.error).map(({ role, content, attachments }) => ({ role, content, ...(attachments?.length ? { attachments } : {}) })) }),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => null) as { error?: string } | null;
    throw new Error(detail?.error || `Chat request failed (${res.status})`);
  }
  if (!res.body) throw new Error("The assistant returned no response.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "", buffer = "";
  const sse = (res.headers.get("content-type") ?? "").includes("text/event-stream");
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value, { stream: true });
    if (!sse) { full += chunk; onText(full); continue; }
    buffer += chunk;
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";
    for (const frame of frames) {
      for (const line of frame.split(/\r?\n/)) {
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (payload === "[DONE]") continue;
        try {
          const data = JSON.parse(payload) as { token?: string; text?: string; content?: string; error?: string };
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

function AttachmentPicker({ busy, onInput }: { busy: boolean; onInput: boolean }) {
  const attachments = usePromptInputAttachments();
  return <>
    {attachments.files.length > 0 && <div className="aichat-attachment-list" aria-label="Selected attachments">
      {attachments.files.map(file => <div className="aichat-attachment" key={file.id}>
        {file.mediaType?.startsWith("image/") && file.url ? <img src={file.url} alt="" /> : <FileText size={17} />}
        <span title={file.filename}>{file.filename}</span>
        <Button type="button" variant="ghost" size="icon" aria-label={`Remove ${file.filename}`} onClick={() => attachments.remove(file.id)}><X size={14} /></Button>
      </div>)}
    </div>}
    <PromptInputFooter>
      <PromptInputTools>
        <Button type="button" size="icon" variant="ghost" title="Attach photos or files" aria-label="Attach photos or files" disabled={busy || attachments.files.length >= MAX_FILES} onClick={() => attachments.openFileDialog()}><Paperclip size={17} /></Button>
        {attachments.files.length > 0 && <span className="aichat-file-count">{attachments.files.length}/{MAX_FILES}</span>}
      </PromptInputTools>
      <PromptInputSubmit status={busy ? "submitted" : "ready"} disabled={busy || !onInput && !attachments.files.length} aria-label="Send message" />
    </PromptInputFooter>
  </>;
}

export function AIChatWidget({ apiEndpoint, mode = "floating", title = "Chat", greeting = "Hi! How can I help you today?", placeholder = "Type a message…", storageKey = "ai-chat-widget:messages", persistence = "local", initialPrompts, renderMessageActions, showStatus = true, accentColor, position = "bottom-right" }: AIChatWidgetProps) {
  const [open, setOpen] = useState(mode === "embedded");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<Status>("idle");
  const [draft, setDraft] = useState("");
  const [fileError, setFileError] = useState("");
  const [box, setBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const busy = status !== "idle";

  useEffect(() => { setMessages(loadMessages(getStore(persistence), storageKey, greeting)); }, [storageKey, persistence, greeting]);
  useEffect(() => {
    if (!messages.length) return;
    // Never persist file contents (data URLs) — they quickly exceed storage quota.
    const slim = messages.map(m => m.attachments ? { ...m, attachments: m.attachments.map(a => ({ ...a, url: "" })) } : m);
    try { getStore(persistence)?.setItem(storageKey, JSON.stringify(slim)); } catch { /* Quota exceeded: current chat still works. */ }
  }, [messages, storageKey, persistence]);
  useEffect(() => { return () => abortRef.current?.abort(); }, []);

  const run = useCallback(async (history: ChatMessage[]) => {
    const assistant: ChatMessage = { id: uid(), role: "assistant", content: "" };
    setMessages([...history, assistant]); setStatus("submitted");
    const controller = new AbortController(); abortRef.current = controller;
    try {
      const text = await streamChat(apiEndpoint, history, content => {
        setStatus("streaming");
        setMessages(prev => prev.map(m => m.id === assistant.id ? { ...m, content } : m));
      }, controller.signal);
      if (!text.trim()) throw new Error("The assistant returned an empty response.");
    } catch (error) {
      if (controller.signal.aborted) {
        setMessages(prev => prev.filter(m => m.id !== assistant.id || m.content));
      } else {
        const text = error instanceof Error ? error.message : "Couldn't reach the assistant.";
        setMessages(prev => prev.map(m => m.id === assistant.id ? { ...m, content: text, error: true } : m));
      }
    } finally { setStatus("idle"); abortRef.current = null; }
  }, [apiEndpoint]);

  const send = useCallback((content: string, attachments: ChatAttachment[] = []) => {
    if (busy || (!content.trim() && !attachments.length)) return;
    setDraft(""); setFileError("");
    void run([...messages, { id: uid(), role: "user", content: content.trim(), ...(attachments.length ? { attachments } : {}) }]);
  }, [busy, messages, run]);
  const retry = () => {
    if (busy) return;
    const history = messages.at(-1)?.error ? messages.slice(0, -1) : messages;
    if (history.at(-1)?.role === "user") void run(history);
  };
  const clear = () => {
    abortRef.current?.abort();
    const fresh: ChatMessage[] = greeting ? [{ id: uid(), role: "assistant", content: greeting }] : [];
    setMessages(fresh); setFileError(""); setStatus("idle");
    try { getStore(persistence)?.setItem(storageKey, JSON.stringify(fresh)); } catch { /* Browser storage may be unavailable. */ }
  };
  const startDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (mode !== "floating" || event.pointerType === "touch" || (event.target as HTMLElement).closest("button")) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    const dx = event.clientX - rect.left, dy = event.clientY - rect.top;
    const move = (e: PointerEvent) => setBox({ x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, e.clientX - dx)), y: Math.max(8, Math.min(window.innerHeight - rect.height - 8, e.clientY - dy)), width: rect.width, height: rect.height });
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop, { once: true });
  };
  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect || event.pointerType === "touch") return;
    event.preventDefault(); event.stopPropagation();
    const originX = event.clientX, originY = event.clientY;
    const move = (e: PointerEvent) => setBox({ x: rect.left, y: rect.top, width: Math.min(window.innerWidth - rect.left - 8, Math.max(300, rect.width + e.clientX - originX)), height: Math.min(window.innerHeight - rect.top - 8, Math.max(320, rect.height + e.clientY - originY)) });
    const stop = () => { window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", stop); };
    window.addEventListener("pointermove", move); window.addEventListener("pointerup", stop, { once: true });
  };
  const handleSubmit = ({ text, files }: PromptInputMessage) => {
    if (busy || (!text.trim() && !files.length)) return;
    send(text, files.filter(f => f.url && f.mediaType).map(f => ({ name: f.filename ?? "attachment", mediaType: f.mediaType ?? "application/octet-stream", url: f.url ?? "" })));
  };
  const lastId = messages.at(-1)?.id;
  const hasUserMessage = messages.some(m => m.role === "user");
  const panel = <div ref={panelRef} className={`aichat-panel ${mode === "embedded" ? "aichat-panel--embedded" : ""} ${box ? "aichat-panel--positioned" : ""}`} style={mode === "floating" && box ? { left: box.x, top: box.y, width: box.width, height: box.height } : undefined} role={mode === "floating" ? "dialog" : "region"} aria-label={title}>
    <div className={`aichat-header ${mode === "floating" ? "aichat-header--draggable" : ""}`} onPointerDown={startDrag}>
      <div className="aichat-title-wrap"><span className="aichat-title">{title}</span>{showStatus && busy && <span className="aichat-status" aria-live="polite">{status === "submitted" ? "Thinking…" : "Writing…"}</span>}</div>
      <div className="aichat-header-actions">
        <Button size="icon" variant="ghost" title="Clear conversation" aria-label="Clear conversation" onClick={clear}><Trash2 size={16} /></Button>
        {mode === "floating" && <Button size="icon" variant="ghost" title="Close chat" aria-label="Close chat" onClick={() => setOpen(false)}><X size={16} /></Button>}
      </div>
    </div>
    <Conversation className="aichat-conversation"><ConversationContent className="aichat-transcript">
      {messages.map(m => <Message key={m.id} from={m.role} className="aichat-message">
        <MessageContent className={m.role === "user" ? "aichat-user-message" : m.error ? "aichat-error-message" : "aichat-assistant-message"}>
          {m.attachments?.map((file, i) => <div key={`${file.name}-${i}`} className="aichat-sent-file">{file.mediaType.startsWith("image/") ? <img src={file.url} alt={file.name} /> : <><FileText size={16} /><span>{file.name}</span></>}</div>)}
          {m.role === "assistant" && !m.content && busy ? <Shimmer>Thinking…</Shimmer> : m.content ? <MessageResponse>{m.content}</MessageResponse> : null}
          {m.error && m.id === lastId && <Button size="sm" variant="outline" onClick={retry} disabled={busy}><RotateCcw size={13} /> Retry</Button>}
          {m.role === "assistant" && !m.error && !(busy && m.id === lastId) && renderMessageActions?.(m)}
        </MessageContent>
      </Message>)}
      {!hasUserMessage && initialPrompts?.length ? <div className="aichat-prompts">{initialPrompts.map(p => <Button key={p} type="button" variant="outline" size="sm" onClick={() => send(p)} disabled={busy}>{p}</Button>)}</div> : null}
    </ConversationContent><ConversationScrollButton aria-label="Scroll to latest message" /></Conversation>
    <div className="aichat-composer-wrap">
      {fileError && <p className="aichat-file-error" role="alert">{fileError}</p>}
      <PromptInput className="aichat-prompt" accept={ACCEPT} multiple maxFiles={MAX_FILES} maxFileSize={MAX_FILE_BYTES} onError={e => setFileError(e.message)} onSubmit={handleSubmit}>
        <PromptInputTextarea name="message" autoFocus={mode === "embedded" || open} placeholder={placeholder} value={draft} onChange={e => setDraft(e.target.value)} disabled={busy} className="aichat-textarea" />
        <AttachmentPicker busy={busy} onInput={Boolean(draft.trim())} />
      </PromptInput>
    </div>
    {mode === "floating" && <div className="aichat-resize" role="separator" aria-label="Resize chat window" title="Drag to resize" onPointerDown={startResize}><Grip size={15} /></div>}
  </div>;
  if (mode === "embedded") return panel;
  return <div className={`aichat-root aichat-root--${position}`} style={accentColor ? { "--aichat-accent": accentColor } as React.CSSProperties : undefined}>
    {open && panel}
    <Button type="button" className="aichat-bubble" onClick={() => setOpen(v => !v)} aria-label={open ? "Close chat" : "Open chat"} title={open ? "Close chat" : "Open chat"}>{open ? <X size={22} /> : <MessageCircle size={22} />}</Button>
  </div>;
}
export default AIChatWidget;
