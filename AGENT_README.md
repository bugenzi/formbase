# Agent README

This file is for AI agents working on the codebase. Read this before making changes.

## What exists

Two packages in a pnpm monorepo:

1. **`packages/pdf-form-editor`** — `@formpdf/editor` npm package. The core product.
2. **`apps/web`** — Vite + React app. Landing page and editor playground.

That's it. No server, no database, no auth. Those were removed intentionally. See `.claude/business-plan.md` for the roadmap.

## Non-negotiable invariants

- PDF points are the only source of truth for field positions.
- Coordinates use PDF user space (bottom-left origin, Y grows up).
- Y-flip: `screenY = (pageHeightPt - ptY - ptH) * scaleY`
- Screen position is derived at render time via CoordEngine. Never stored.
- Undo/redo is patch-based (immer), not snapshot-based.
- Fields are positioned relative to each page overlay, not the document scroll container.
- Drag position lives in a ref, not state. State written only on drag-end.

## What works

- Visual editor: place 6 field types on any PDF
- JSON schema export (FormSchema v2.0)
- PDF export with AcroForm fields (pdf-lib)
- Schema import from JSON
- Undo/redo, keyboard shortcuts, alignment guides
- 45 passing tests

## What doesn't exist yet

- Headless fill SDK (`@formbase/sdk`) — planned, not built
- AI field detection — hook exists but needs a server/proxy (removed)
- Auth, storage, dashboard — removed, planned for iteration 2
- Figma sync — removed

## Before making a change

1. Does this affect PDF coordinates or only UI?
2. Should it live in the editor package or the web app?
3. Does it still work with zero configuration (no API keys, no DB)?
4. Could it break export correctness?

## Build & test

```bash
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
pnpm --filter @formpdf/editor build
pnpm --filter @formpdf/editor test
pnpm --filter @formpdf/editor typecheck
pnpm --filter @formpdf/web typecheck
```

Editor must build before web can typecheck (web depends on the built types).
