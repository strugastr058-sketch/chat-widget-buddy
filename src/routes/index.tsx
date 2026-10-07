import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { ArrowRight, Code2, Maximize2, PanelRight, SquareStack } from "lucide-react";
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
          'Drop <AIChatWidget apiEndpoint="/api/recruiter-chat" /> into any React app: streaming, markdown, and persistent history out of the box.',
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
        <header className="flex flex-col gap-4 border-b border-border pb-10">
          <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            @your-name/react-chat-ui
          </span>
          <h1 className="text-4xl font-bold sm:text-5xl">AIChatWidget</h1>
          <p className="max-w-2xl text-base leading-7 text-muted-foreground">
            A focused, backend-agnostic chat interface for React and TypeScript. Connect one
            endpoint and get streaming replies, Markdown, browser history, and four production-ready
            layouts.
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span>TypeScript</span>
            <span>Streaming</span>
            <span>Accessible</span>
            <span>UI only</span>
          </div>
        </header>

        <section className="flex flex-col gap-4" aria-labelledby="layouts-title">
          <div>
            <h2 id="layouts-title" className="text-xl font-semibold">
              Choose a layout
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Switch the live corner launcher or open the dedicated full-page experience.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["floating", "sidebar"] as const).map((m) => (
              <Button
                key={m}
                variant={launcher === m ? "default" : "outline"}
                size="sm"
                onClick={() => setLauncher(m)}
              >
                {m === "floating" ? (
                  <SquareStack aria-hidden="true" />
                ) : (
                  <PanelRight aria-hidden="true" />
                )}
                {m === "floating" ? "Floating window" : "Sidebar drawer"}
              </Button>
            ))}
            <Button asChild variant="outline" size="sm">
              <Link to="/chat">
                <Maximize2 aria-hidden="true" />
                Full page
              </Link>
            </Button>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Code2 className="size-5" aria-hidden="true" />
            Usage
          </h2>
          <pre className="overflow-x-auto rounded-lg border border-border bg-card p-4 text-sm leading-relaxed text-card-foreground">
            <code>{usageSnippet}</code>
          </pre>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-xl font-semibold">Embedded mode</h2>
          <p className="text-sm text-muted-foreground">
            This live example uses the same API contract documented in the README.
          </p>
          <AIChatWidget
            mode="embedded"
            apiEndpoint="/api/public/chat"
            title="Recruiter chat (embedded)"
            greeting="Hi! I'm the demo assistant. Ask me anything."
            storageKey="ai-chat-widget:demo-embedded"
            initialPrompts={[
              "What is his experience with Java?",
              "What projects has he shipped?",
              "Is he open to freelance work?",
            ]}
          />
          <Button asChild variant="link" className="w-fit px-0">
            <Link to="/chat">
              Open full-page chat <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </section>
      </main>

      <AIChatWidget
        key={launcher}
        mode={launcher}
        defaultOpen={launcher === "sidebar"}
        apiEndpoint="/api/public/chat"
        title="Recruiter chat"
        greeting="Hi! I'm the demo assistant. Ask me anything."
        storageKey="ai-chat-widget:demo-floating"
      />
    </div>
  );
}
