# Professional chat UI library finish

## Goal
Finish the project as a focused, reusable React chat interface library and document it for developers.

## Changes
- Replace the starter README with professional documentation covering installation, the four layouts, props, endpoint contract, streaming formats, persistence, styling, accessibility, and deployment notes.
- Polish the demo page so developers can clearly preview floating, sidebar, embedded, and full-page layouts and copy accurate usage examples.
- Review the widget for consistent behavior across layouts, including drag, resize, clear, retry, starter prompts, status, markdown, and browser storage.
- Remove leftover media-analysis dependencies or wording that no longer belongs in this UI-only library, where safe.
- Keep the demo endpoint as an optional example; the reusable widget remains backend-agnostic and only needs an `apiEndpoint`.

## Verification
- Check the generated routes and current build diagnostics.
- Test all four layouts in the browser, including opening, sending, dragging/resizing, clearing, and mobile sizing.
- Confirm there are no current build or runtime errors.

## Technical notes
- Preserve TanStack Start for the demo site while documenting the widget as ordinary React + TypeScript UI.
- Keep styles token-based and scoped under the `aichat-` class prefix.
- Do not add photo, PDF, or file-reading features.
