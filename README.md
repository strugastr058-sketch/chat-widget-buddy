# AIChatWidget

A backend-agnostic, plug-and-play chat interface for React and TypeScript.

`AIChatWidget` supplies the complete client-side chat experience—layout, conversation state, streaming text, Markdown rendering, loading and error states, starter prompts, and optional browser persistence. Connect it to any HTTP endpoint that accepts a message history and returns streamed text.

> This project is intentionally UI-only. Image, document, audio, and file analysis belong in a separate integration layer.

## Features

- Four layouts: floating window, sidebar drawer, full page, and embedded panel
- Draggable and resizable floating window on desktop
- Resizable left- or right-hand sidebar
- Plain-text and Server-Sent Events (SSE) streaming
- Markdown-formatted assistant messages
- Loading, streaming, empty-response, and retry states
- Configurable greeting, starter prompts, header title, and composer hint
- Local, session, or disabled browser persistence
- Clear-conversation control and automatic scroll management
- Custom assistant-message actions
- Keyboard-friendly controls and reduced-motion support
- Scoped `aichat-` CSS classes and semantic design tokens

## Quick start

This repository currently contains the package source and an interactive demo. Until the package is published to a registry, copy `src/components/chat-widget` and its referenced UI primitives into your React project, or consume the repository through your existing workspace setup.

```tsx
import { AIChatWidget } from "@vegimis/react-chat-ui";

export function App() {
  return <AIChatWidget apiEndpoint="/api/chat" />;
}
```

Import the widget styles once from your application entry point. The demo's complete token and widget styles are in `src/styles.css`.

## Layouts

### Floating window

Displays a launcher in a lower corner. The opened window can be moved by its header and resized from its lower-right corner on desktop.

```tsx
<AIChatWidget mode="floating" position="bottom-right" apiEndpoint="/api/chat" />
```

### Sidebar drawer

Opens from either side and can be resized by dragging its inner edge.

```tsx
<AIChatWidget mode="sidebar" side="right" apiEndpoint="/api/chat" />
```

### Full page

Fills the available browser viewport. Use it as the primary content of a dedicated route.

```tsx
<AIChatWidget mode="fullpage" apiEndpoint="/api/chat" />
```

### Embedded panel

Renders inline wherever it is placed. Its container controls the surrounding page layout.

```tsx
<AIChatWidget
  mode="embedded"
  title="Support"
  greeting="Hello! How can we help?"
  apiEndpoint="/api/chat"
/>
```

## Copy and starter prompts

Nothing a visitor reads is hard-coded. The greeting, the starter questions, the header title, and the composer hint are all props, so the same widget can serve recruiting, support, onboarding, or documentation without touching library code.

```tsx
<AIChatWidget
  apiEndpoint="/api/chat"
  title="AI Chat"
  greeting="Hi! I'm the demo assistant. Ask me anything."
  placeholder="Type a message…"
  initialPrompts={[
    "What can you help me with?",
    "Explain streaming in one sentence",
    "Tell me a fun fact",
  ]}
/>
```

| Setting           | Prop             | Behaviour                                                                                        |
| ----------------- | ---------------- | ------------------------------------------------------------------------------------------------ |
| Greeting          | `greeting`       | Shown as the first assistant message. Pass `""` to start with an empty transcript.               |
| Starter questions | `initialPrompts` | One button per entry, listed until the first user message; clicking one sends it. Omit for none. |
| Header label      | `title`          | Visible header text and accessible panel name.                                                   |
| Composer hint     | `placeholder`    | Hint shown in the empty input.                                                                   |

Starter buttons disappear as soon as the visitor sends a message, so keep them short and answerable. Because both settings are plain props, they can come from your own configuration — a CMS field, a tenant record, an A/B test, or environment variables:

```tsx
const copy = await loadWidgetCopy("recruiting"); // { greeting, prompts }

<AIChatWidget
  apiEndpoint="/api/chat"
  greeting={copy.greeting}
  initialPrompts={copy.prompts.filter(Boolean)}
/>;
```

The demo site exposes the same two settings on its Settings page (`/config`): one box for the greeting, one for the starter questions, one per line. Those edits are saved in this browser and apply to every layout on the demo site. The page belongs to the demo, not to the library — in your own app, pass the props directly.

## API

### `AIChatWidgetProps`

| Prop                   | Type                                                  | Default                           | Description                                                             |
| ---------------------- | ----------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| `apiEndpoint`          | `string`                                              | required                          | URL that receives the conversation and streams the reply.               |
| `mode`                 | `"floating" \| "sidebar" \| "fullpage" \| "embedded"` | `"floating"`                      | Widget layout.                                                          |
| `side`                 | `"left" \| "right"`                                   | `"right"`                         | Opening side for sidebar mode.                                          |
| `position`             | `"bottom-right" \| "bottom-left"`                     | `"bottom-right"`                  | Launcher position for floating mode.                                    |
| `defaultOpen`          | `boolean`                                             | `false`                           | Opens floating or sidebar mode on first render.                         |
| `title`                | `string`                                              | `"Chat"`                          | Accessible panel label and visible header title.                        |
| `greeting`             | `string`                                              | `"Hi! How can I help you today?"` | Initial assistant message. Pass an empty string to omit it.             |
| `placeholder`          | `string`                                              | `"Type a message…"`               | Composer placeholder.                                                   |
| `storageKey`           | `string`                                              | `"ai-chat-widget:messages"`       | Browser-storage key for this conversation. Use a unique key per widget. |
| `persistence`          | `"local" \| "session" \| "none"`                      | `"local"`                         | Conversation storage policy.                                            |
| `initialPrompts`       | `string[]`                                            | —                                 | Prompt buttons shown until the first user message.                      |
| `showStatus`           | `boolean`                                             | `true`                            | Shows Thinking/Writing status in the header.                            |
| `accentColor`          | `string`                                              | theme primary                     | Optional CSS color for the launcher and user messages.                  |
| `renderMessageActions` | `(message) => ReactNode`                              | —                                 | Renders custom controls beneath completed assistant messages.           |

The package also exports the `AIChatWidgetProps` and `ChatMessage` TypeScript types.

## Endpoint contract

The widget sends a JSON `POST` request:

```json
{
  "messages": [
    { "role": "user", "content": "Hello" },
    { "role": "assistant", "content": "Hi! How can I help?" }
  ]
}
```

Each message has a `role` of `user` or `assistant` and a string `content` value. Error messages are excluded automatically.

### Supported responses

**Streaming plain text**

```http
HTTP/1.1 200 OK
Content-Type: text/plain; charset=utf-8

Hello! How can I help today?
```

Every received chunk is appended to the visible assistant response.

**Server-Sent Events**

```text
data: {"token":"Hello"}

data: {"text":" there"}

data: [DONE]
```

SSE JSON frames may contain `token`, `text`, or `content`. A non-JSON `data:` value is treated as text. End the stream with `[DONE]` or close the response body.

For errors, return a non-2xx response with an optional JSON message:

```json
{ "error": "The assistant is temporarily unavailable." }
```

## Backend example

The demo endpoint at `src/routes/api/public/recruiter-chat.ts` shows one server implementation. The component is not tied to that endpoint, Firebase, or any AI provider; a Vercel function, Firebase function, Cloudflare Worker, or conventional API can implement the same contract.

Keep provider credentials on the server. Never place private AI keys in widget props or browser code.

## Custom message actions

Use `renderMessageActions` for controls such as copy, feedback, or a lead-capture action:

```tsx
<AIChatWidget
  apiEndpoint="/api/chat"
  renderMessageActions={(message) => (
    <button type="button" onClick={() => navigator.clipboard.writeText(message.content)}>
      Copy response
    </button>
  )}
/>
```

## Persistence and privacy

- `local` preserves the conversation across browser restarts.
- `session` preserves it only for the current browser tab session.
- `none` keeps the conversation in React state only.
- Persisted messages contain text and roles. Do not send confidential information unless your product and endpoint are designed to handle it.
- The clear control resets both the visible conversation and its configured browser-storage entry.

## Styling

The widget uses semantic variables such as `--color-card`, `--color-border`, `--color-primary`, and `--color-primary-foreground`. All widget selectors are prefixed with `aichat-` to reduce collisions with the host application.

Use `accentColor` for one-off branding, or map the semantic variables in your design system for complete light and dark theme control.

## Accessibility and responsive behavior

- Floating and sidebar panels expose an accessible dialog label.
- Icon controls include labels and tooltips.
- The transcript uses a live conversation log and includes a scroll-to-latest control.
- Desktop pointer users can move and resize supported layouts.
- On narrow screens, the floating panel remains within the viewport and the resize handle is hidden.
- Sidebar animation respects `prefers-reduced-motion`.

## Development

Requirements: a current Node.js runtime and Bun or npm.

```bash
bun install
bun run dev
```

Open the local app to preview embedded, floating, sidebar, and full-page layouts. Before submitting changes:

```bash
bun run lint
bun run build
```

## Repository status

Production release **v1.0.0**. Install from GitHub by tag once the widget folder is published at a repo root, e.g. `bun add github:vegimis/react-chat-ui#v1.0.0`.

## License

MIT — see `LICENSE`.

## Versions & AI connection

- This widget is versioned: `VERSION` in `src/components/chat-widget/index.ts`, `package.json` + `CHANGELOG.md` in the same folder. Release by bumping all three and tagging `vX.Y.Z`.
- AI answers come from [ai-gateway-hub](https://github.com/vegimis/ai-gateway-hub) **v1.2.0**, pinned as a copy in `src/lib/ai-gateway`, served at `POST /api/public/chat`.
- Set the server secret `AI_PROVIDER_API_KEY` (Gemini, OpenAI, Claude, Groq… auto-detected).
- To upgrade later: copy `src/lib/ai-gateway` from the new tag (e.g. `v1.3.0`), or once the library lives at a repo root, `bun add github:vegimis/ai-gateway#v1.3.0` and change the import.
