# Chat Widget Buddy

Plug-and-Play Chatbot UI Widget (@your-name/react-chat-ui)
Primary Language: TypeScript + React (.tsx)

Hosting Target: Runs client-side in the user's browser; bundled with Vite and hosted on Vercel or Firebase Hosting.

Why this language: Because your freelance frontend stack is React + Vite, writing this in TypeScript with TSX lets you import <AIChatWidget/> with full autocompletion and prop validation.

What it does:

Renders a floating chat bubble, drawer, or embedded panel.

Manages chat state: user input, loading animations, markdown message formatting, and token-by-token streaming display.

Connects to your Firebase function endpoint via simple props: <AIChatWidget apiEndpoint="/api/recruiter-chat"/>.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/913e0133-dbd0-4a4e-a2ec-d4540f09288b).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
