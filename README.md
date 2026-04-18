# formbase

A PDF form editor for React. Design fields visually, then export JSON schemas or real AcroForm PDFs from your app.

I'm building this in my free time. It works today, but it's still early. APIs may change and some roadmap ideas are not shipped yet.

## Start here

There are two practical ways to use Formbase today:

### 1. Try the editor locally

```bash
git clone https://github.com/bugenzi/formbase.git
cd formbase
pnpm install
pnpm dev
```

Open `http://localhost:5173` to use the landing page and editor playground.

### 2. Embed the package in your React app

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

## What works today

- Visual editor: upload a PDF and place 6 field types (text, signature, initials, date, checkbox, dropdown)
- JSON schema export with field positions stored in PDF points
- PDF export with real AcroForm fields via pdf-lib
- Schema import from JSON
- Undo/redo, keyboard shortcuts, and alignment guides
- Composable API: use the full editor or import individual building blocks
- Zero required external services for the base editor flow

## Planned or optional, not core today

- Headless fill SDK is planned, but not built yet
- AI-assisted field detection is not zero-config. It needs your own server-side proxy if you want to experiment with it
- Auth, storage, and dashboard workflows are not part of the current open-source app

## Export programmatically

```tsx
import { useFormExport } from '@formpdf/editor'

const { exportJSON, exportToPdf } = useFormExport()

// JSON schema with field positions
const schema = exportJSON()

// PDF with AcroForm fields baked in
const pdfBytes = await exportToPdf(originalFile)
```

## Recommended adoption path

1. Open the playground and place a few fields on a sample PDF
2. Export a JSON schema and a fillable PDF to understand the output
3. Embed `@formpdf/editor` in your app when you are ready for a custom workflow
4. Move to the composable API only when you need a custom layout

## Project structure

```text
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
├── vercel.json               # Deploy config for apps/web
└── package.json              # pnpm workspace root
```

## How the coordinates work

PDFs use bottom-left origin. Browsers use top-left. Fields are stored in PDF points, and screen positions are derived at render time through `CoordEngine`:

```text
screenY = (pageHeightPt - ptY - ptH) * scaleY
```

This means fields survive zoom changes, export correctly, and don't drift.

## Commands

```bash
pnpm dev          # Start editor watcher + web dev server
pnpm build        # Build @formpdf/editor and @formpdf/web
pnpm test         # Run tests
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
