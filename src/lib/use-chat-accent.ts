import { useCallback, useEffect, useState } from "react";

const KEY = "ai-chat-widget:accent";
const EVENT = "aichat-accent-change";

/** Demo-site setting: the chat color chosen on /config, saved in this browser. */
export function useChatAccent() {
  const [accent, setAccentState] = useState<string | undefined>(undefined);
  useEffect(() => {
    const read = () => setAccentState(localStorage.getItem(KEY) || undefined);
    read();
    window.addEventListener(EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const setAccent = useCallback((value: string | undefined) => {
    if (value) localStorage.setItem(KEY, value);
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [accent, setAccent] as const;
}
