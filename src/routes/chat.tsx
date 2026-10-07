import { createFileRoute } from "@tanstack/react-router";
import { AIChatWidget } from "@/components/chat-widget/AIChatWidget";

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
  component: () => (
    <AIChatWidget
      mode="fullpage"
      apiEndpoint="/api/public/chat"
      title="Recruiter chat"
      greeting="Hi! I'm the demo assistant. Ask me anything."
      storageKey="ai-chat-widget:demo-fullpage"
      initialPrompts={["What is his experience with Java?", "What projects has he shipped?"]}
    />
  ),
});
