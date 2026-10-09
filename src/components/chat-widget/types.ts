import type { ReactNode } from "react";

export interface ChatSource {
  title: string;
  url?: string;
  snippet?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  error?: boolean;
  /** Set when the user pressed Stop before the reply finished. */
  stopped?: boolean;
  /** Where the answer came from (sent by the endpoint as SSE `{ sources: [...] }`). */
  sources?: ChatSource[];
  feedback?: "up" | "down";
  createdAt?: number;
}

export interface ChatFeatures {
  /** Stop button while the assistant is answering. Default true. */
  stop?: boolean;
  /** Copy button under assistant replies. Default true. */
  copy?: boolean;
  /** "Regenerate" on the latest assistant reply. Default true. */
  regenerate?: boolean;
  /** Thumbs up / down under assistant replies. Default false. */
  feedback?: boolean;
  /** Show sources attached to replies. Default true. */
  sources?: boolean;
  /** Clear-conversation button in the header. Default true. */
  clear?: boolean;
  /** Time stamps under messages. Default false. */
  timestamps?: boolean;
}

type MaybeFn<T> = T | (() => T);

export interface AIChatWidgetProps {
  /** POST `{ messages, context?, ...body }`; respond with streaming plain text or SSE. */
  apiEndpoint: string;
  /** floating = bubble + movable window, sidebar = slide-in drawer, fullpage = fills the screen, embedded = inline panel. */
  mode?: "floating" | "sidebar" | "fullpage" | "embedded";
  side?: "left" | "right";
  position?: "bottom-right" | "bottom-left";
  defaultOpen?: boolean;
  /** Controlled open state (floating / sidebar). */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;

  title?: string;
  /** Short line under the title, e.g. "Answers from our help center". */
  subtitle?: string;
  greeting?: string;
  placeholder?: string;
  initialPrompts?: string[];
  /** Text under the composer, e.g. "AI can make mistakes." */
  disclaimer?: string;
  /** Maximum characters per message. Default 4000. */
  maxLength?: number;

  /** "auto" follows the device, "inherit" follows the host page (default). */
  theme?: "light" | "dark" | "auto" | "inherit";
  accentColor?: string | undefined;
  className?: string;

  storageKey?: string;
  persistence?: "local" | "session" | "none";

  features?: ChatFeatures;
  showStatus?: boolean;

  /** Extra info sent as `context` with every request (user, page, knowledge base id…). */
  context?: MaybeFn<Record<string, unknown> | undefined>;
  /** Extra request headers, e.g. `Authorization`. */
  headers?: MaybeFn<Record<string, string> | undefined>;
  /** Extra top-level JSON fields merged into the request body. */
  body?: MaybeFn<Record<string, unknown> | undefined>;

  onSend?: (message: ChatMessage) => void;
  onResponse?: (message: ChatMessage) => void;
  onError?: (error: Error) => void;
  onFeedback?: (message: ChatMessage, value: "up" | "down") => void;
  onClear?: () => void;
  renderMessageActions?: (message: ChatMessage) => ReactNode;
}

export const resolve = <T>(v: MaybeFn<T>): T =>
  typeof v === "function" ? (v as () => T)() : v;
