import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AIChatWidget } from "@/components/chat-widget/AIChatWidget";
import { useChatAccent } from "@/lib/use-chat-accent";

const PRESETS = [
  { name: "Default", value: undefined },
  { name: "Blue", value: "#2563eb" },
  { name: "Emerald", value: "#059669" },
  { name: "Rose", value: "#e11d48" },
  { name: "Amber", value: "#d97706" },
  { name: "Teal", value: "#0d9488" },
  { name: "Slate", value: "#334155" },
];

export const Route = createFileRoute("/config")({
  head: () => ({
    meta: [
      { title: "Settings — AI Chat widget color" },
      { name: "description", content: "Pick the color of the AI Chat widget and preview it live." },
      { property: "og:title", content: "Settings — AI Chat widget color" },
      { property: "og:description", content: "Choose and preview the AI Chat widget color." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const [accent, setAccent] = useChatAccent();
  return (
    <div className="min-h-screen bg-background text-foreground">
      <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-12">
        <Button asChild variant="link" className="w-fit px-0">
          <Link to="/">
            <ArrowLeft aria-hidden="true" /> Back
          </Link>
        </Button>
        <header>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose the chat color. It's saved in this browser and used on every demo page.
          </p>
        </header>

        <section className="flex flex-col gap-4" aria-labelledby="color-title">
          <h2 id="color-title" className="text-lg font-semibold">Color</h2>
          <div className="flex flex-wrap gap-3">
            {PRESETS.map((p) => {
              const active = (accent ?? undefined) === p.value;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => setAccent(p.value)}
                  aria-pressed={active}
                  className="flex flex-col items-center gap-1 text-xs text-muted-foreground"
                >
                  <span
                    className="flex size-10 items-center justify-center rounded-full border border-border bg-primary text-primary-foreground ring-offset-2 ring-offset-background data-[active=true]:ring-2 data-[active=true]:ring-ring"
                    data-active={active}
                    style={p.value ? { background: p.value } : undefined}
                  >
                    {active && <Check className="size-4" aria-hidden="true" />}
                  </span>
                  {p.name}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-3 text-sm">
            Custom color
            <input
              type="color"
              value={accent ?? "#2563eb"}
              onChange={(e) => setAccent(e.target.value)}
              className="h-9 w-14 cursor-pointer rounded border border-border bg-background"
            />
            <code className="text-muted-foreground">{accent ?? "default"}</code>
          </label>
        </section>

        <section className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Preview</h2>
          <AIChatWidget
            mode="embedded"
            apiEndpoint="/api/public/chat"
            title="AI Chat"
            accentColor={accent}
            storageKey="ai-chat-widget:demo-config"
            initialPrompts={["Say hello", "Tell me a fun fact"]}
          />
        </section>
      </main>
    </div>
  );
}
