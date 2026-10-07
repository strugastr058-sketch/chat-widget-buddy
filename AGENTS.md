<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

<!-- LOVABLE:END -->

- Keep `AIChatWidget` backend-agnostic and UI-only; media or document analysis belongs in separate integrations so the library stays focused.
- Chat widget is versioned (VERSION/package.json/CHANGELOG in its folder); AI backend is ai-gateway-hub pinned by tag in src/lib/ai-gateway — upgrade by replacing that folder from a newer tag.
