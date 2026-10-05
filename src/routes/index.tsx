import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AIChatWidget } from "@/components/chat-widget/AIChatWidget";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AIChatWidget — plug-and-play React chat UI" },
      {
        name: "description",
        content:
          "A plug-and-play TypeScript + React chatbot widget: floating bubble, sidebar drawer, full page or embedded panel, token-by-token streaming, markdown messages, and localStorage history via one apiEndpoint prop.",
      },
      { property: "og:title", content: "AIChatWidget — plug-and-play React chat UI" },
      {
        property: "og:description",
        content:
          "Drop <AIChatWidget apiEndpoint=\"/api/recruiter-chat\" /> into any React app: streaming, markdown, and persistent history out of the box.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const usageSnippet = `import { Button } from "@/components/ui/button";
import { AIChatWidget } from "@your-name/react-chat-ui";

// Floating bubble (movable + resizable window)
<AIChatWidget apiEndpoint="/api/recruiter-chat" />

// Slide-in sidebar (resizable width)
<AIChatWidget mode="sidebar" side="right" apiEndpoint="/api/recruiter-chat" />

// Whole page
<AIChatWidget mode="fullpage" apiEndpoint="/api/recruiter-chat" />

// Embedded panel
<AIChatWidget
  mode="embedded"
  apiEndpoint="/api/recruiter-chat"
  title="Ask about my experience"
  greeting="Hi! Ask me anything about my work."
/>`;

type Launcher = "floating" | "sidebar";

function Index() {
  const [launcher, setLauncher] = useState<Launcher>("floating");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
        <header className="flex flex-col gap-3">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            @your-name/react-chat-ui
          </span>
          <h1 className="text-4xl font-bold tracking-tight">AIChatWidget</h1>
          <p className="max-w-xl text-muted-foreground">
            A plug-and-play chatbot UI for React + TypeScript. One prop connects it to your
            backend; it handles streaming, markdown, loading states, and history. Try the floating
            bubble in the corner, or the embedded panel below.
          </p>
        </header>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Layouts</h2>
          <p className="text-sm text-muted-foreground">Pick how the corner button opens the chat, or open the full-page version.</p>
          <div className="flex flex-wrap gap-2">
            {(["floating", "sidebar"] as const).map(m => (
              <Button key={m} variant={launcher === m ? "default" : "outline"} size="sm" onClick={() => setLauncher(m)}>
                {m === "floating" ? "Floating window" : "Sidebar drawer"}
              </Button>
            ))}
            <Button asChild variant="outline" size="sm"><Link to="/chat">Full page</Link></Button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Usage</h2>
          <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-card-foreground">
            <code>{usageSnippet}</code>
          </pre>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Embedded mode — live demo</h2>
          <p className="text-sm text-muted-foreground">
            Connected to a demo streaming endpoint at <code>/api/public/recruiter-chat</code>.
          </p>
          <AIChatWidget
            mode="embedded"
            apiEndpoint="/api/public/recruiter-chat"
            title="Recruiter chat (embedded)"
            greeting="Hi! I'm the demo assistant. Ask me anything."
            storageKey="ai-chat-widget:demo-embedded"
            initialPrompts={["What is his experience with Java?", "What projects has he shipped?", "Is he open to freelance work?"]}
          />
        </section>
      </main>

      <AIChatWidget
        key={launcher}
        mode={launcher}
        defaultOpen={launcher === "sidebar"}
        apiEndpoint="/api/public/recruiter-chat"
        title="Recruiter chat"
        greeting="Hi! I'm the demo assistant. Ask me anything."
        storageKey="ai-chat-widget:demo-floating"
      />
    </div>
  );
}
