# formbase

A PDF form editor for React. Place fields on any PDF, export JSON schemas or filled AcroForm PDFs.

I'm building this in my free time. It works, but it's a work in progress. Things will break, APIs will change, and there's plenty left to do. If that sounds fine, keep reading.

## What it does today

- Visual editor: upload a PDF, drag 6 field types onto it (text, signature, initials, date, checkbox, dropdown)
- Export JSON schema with all field positions in PDF points
- Export filled PDF with real AcroForm fields via pdf-lib
- Undo/redo, keyboard shortcuts, alignment guides
- Composable: use the full editor or import individual pieces (CoordEngine, field store, components)
- Zero dependencies on external services — works fully offline, no API keys, no database

## What's coming

- **Headless fill SDK** (`@formbase/sdk`) — feed schema + values, get a filled PDF back. No browser needed.
- **AI field detection** — Claude vision auto-detects where fields belong
- **Auth + storage** — save documents, manage templates

## Install

```bash
npm install @formpdf/editor
```

```tsx
import { PdfFormEditor } from '@formpdf/editor'
import '@formpdf/editor/styles.css'

function App() {
  return (
    <PdfFormEditor
      pdfUrl="/contract.pdf"
      onSave={(pdfBytes) => upload(pdfBytes)}
    />
  )
}
```

## Export programmatically

```tsx
import { useFormExport } from '@formpdf/editor'

const { exportJSON, exportToPdf } = useFormExport()

// JSON schema with field positions
const schema = exportJSON()

// PDF with AcroForm fields baked in
const pdfBytes = await exportToPdf(originalFile)
```

## Run locally

```bash
git clone <repo-url> && cd formbase
pnpm install
pnpm dev
```

Open `http://localhost:5173`. That's it. No Docker, no database, no env vars.

## Project structure

```
formbase/
├── packages/
│   └── pdf-form-editor/     # @formpdf/editor — the npm package
│       ├── src/
│       │   ├── engine/       # CoordEngine (PDF <-> screen coordinate transforms)
│       │   ├── store/        # Zustand + immer (fields, history, undo/redo)
│       │   ├── components/   # PdfFormEditor, PdfCanvas, FieldItem, Toolbar, etc.
│       │   ├── hooks/        # useFormExport, useSchemaImport, useAiDetection
│       │   └── styles/       # CSS
│       └── tsup.config.ts
├── apps/
│   └── web/                  # Landing page + editor playground
│       └── src/
│           ├── routes/       # landing.tsx, editor.tsx
│           └── styles/
├── vercel.json               # Deploy config
└── package.json              # pnpm workspace root
```

## How the coordinates work

PDFs use bottom-left origin. Browsers use top-left. This is where every other PDF tool gets it wrong.

Fields are stored in PDF points (bottom-left origin, 72pt = 1 inch). Screen positions are derived at render time. The Y-flip happens once, in CoordEngine:

```
screenY = (pageHeightPt - ptY - ptH) * scaleY
```

This means fields survive zoom changes, export correctly, and don't drift.

## Commands

```bash
pnpm dev          # Start editor watcher + web dev server
pnpm build        # Build @formpdf/editor
pnpm test         # Run tests (45 tests)
pnpm typecheck    # TypeScript check everything
```

## Tech

- **pdfjs-dist** — PDF rendering
- **pdf-lib** — AcroForm field injection
- **Zustand + immer** — state + undo/redo via patches
- **interact.js** — drag and resize
- **tsup** — library bundling

## License

MIT
