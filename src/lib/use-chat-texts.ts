import { useCallback, useEffect, useState } from "react";

const KEY = "ai-chat-widget:texts";
const EVENT = "aichat-texts-change";

export interface ChatTexts {
  greeting: string;
  prompts: string[];
}

export const DEFAULT_TEXTS: ChatTexts = {
  greeting: "Hi! I'm the demo assistant. Ask me anything.",
  prompts: [
    "What can you help me with?",
    "Explain streaming in one sentence",
    "Tell me a fun fact",
  ],
};

function read(): ChatTexts {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "null");
    if (raw && typeof raw.greeting === "string" && Array.isArray(raw.prompts)) {
      return {
        greeting: raw.greeting,
        prompts: raw.prompts.filter((p: unknown) => typeof p === "string"),
      };
    }
  } catch {
    /* ignore bad data */
  }
  return DEFAULT_TEXTS;
}

/** Demo-site setting: greeting + starter questions chosen on /config, saved in this browser. */
export function useChatTexts() {
  const [texts, setState] = useState<ChatTexts>(DEFAULT_TEXTS);
  useEffect(() => {
    const sync = () => setState(read());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  const setTexts = useCallback((value: ChatTexts | null) => {
    if (value) localStorage.setItem(KEY, JSON.stringify(value));
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [texts, setTexts] as const;
}
