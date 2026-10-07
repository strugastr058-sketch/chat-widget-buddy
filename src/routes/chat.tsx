import { createFileRoute } from "@tanstack/react-router";
import { AIChatWidget } from "@/components/chat-widget/AIChatWidget";
import { useChatAccent } from "@/lib/use-chat-accent";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "Full-page chat — AIChatWidget demo" },
      { name: "description", content: "AIChatWidget in fullpage mode: the whole screen becomes a streaming chat." },
      { property: "og:title", content: "Full-page chat — AIChatWidget demo" },
      { property: "og:description", content: "See the React chat UI library filling the whole page." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ChatPage,
});

function ChatPage() {
  const [accent] = useChatAccent();
  return (
    <AIChatWidget
      mode="fullpage"
      apiEndpoint="/api/public/chat"
      title="AI Chat"
      accentColor={accent}
      greeting="Hi! I'm the demo assistant. Ask me anything."
      storageKey="ai-chat-widget:demo-fullpage"
      initialPrompts={["What can you help me with?", "Tell me a fun fact"]}
    />
  );
}
