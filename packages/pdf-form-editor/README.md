# @bugenzi/formpdf-editor

Embeddable PDF form editor for React. Place fields on any PDF, export JSON schemas or AcroForm-ready PDFs, and keep coordinates in PDF-native space.

## Install

```bash
npm install @bugenzi/formpdf-editor
# or
pnpm add @bugenzi/formpdf-editor
```

## Quick start

```tsx
import { PdfFormEditor } from '@bugenzi/formpdf-editor'
import '@bugenzi/formpdf-editor/styles.css'

function App() {
  return (
    <PdfFormEditor
      pdfUrl="/contract.pdf"
      onSave={(bytes) => upload(bytes)}
    />
  )
}
```

That is the zero-config path. You do **not** need an AI proxy to use the editor, export schemas, or export fillable PDFs.

## What ships today

- **6 field types** — text, signature, initials, date, checkbox, dropdown
- **PDF-native coordinates** — fields stored in PDF points (72pt/inch), with Y-flip handled transparently
- **AcroForm export** — export PDFs with real form fields via pdf-lib
- **JSON schema export/import** — round-trip field definitions
- **Undo/redo** — immer patch-based history
- **Keyboard shortcuts** — T/S/I/D/C/L to add fields, Ctrl+Z undo, Delete to remove
- **Drag & resize** — interact.js with alignment guides
- **Composable API** — use the full editor or import individual pieces
- **Error boundary and toasts** — built-in recovery and feedback

## Planned or optional

- **AI-assisted detection** — the hooks exist, but you need your own server-side proxy to use it
- **Headless fill SDK** — planned, not published yet

## Recommended adoption path

1. Start with `PdfFormEditor`
2. Export a JSON schema or fillable PDF
3. Move to the composable API only if you need a custom layout
4. Add AI experimentation later, behind your own proxy, if it fits your product

## Export programmatically

```tsx
import { useFormExport } from '@bugenzi/formpdf-editor'

function SaveButton({ originalFile }) {
  const { exportJSON, exportToPdf, downloadJson, downloadPdf } = useFormExport()

  const schema = exportJSON()
  const pdfBytes = await exportToPdf(originalFile)

  return null
}
```

## Schema import

```tsx
import { useSchemaImport } from '@bugenzi/formpdf-editor'

function LoadButton() {
  const { importSchema, importFile } = useSchemaImport()

  const result = await importFile(jsonFile)
  console.log(`Imported ${result.imported} fields`)

  importSchema(schemaObject, { clearExisting: true })
}
```

## Props

```ts
interface PdfFormEditorProps {
  pdfUrl?: string
  pdfFile?: File
  aiProxyUrl?: string
  onExport?: (schema) => void
  onSave?: (pdfBytes: Uint8Array) => void
}
```

`aiProxyUrl` is optional. It is only relevant if you are wiring up AI-assisted detection yourself.

## Composable API

Use individual pieces for custom layouts:

```tsx
import {
  EditorProvider,
  PdfCanvas,
  FieldLayer,
  PropsPanel,
  FieldPalette,
  Toolbar,
  useFieldStore,
  useFormExport,
  useSchemaImport,
} from '@bugenzi/formpdf-editor'
import '@bugenzi/formpdf-editor/styles.css'

function CustomEditor({ file, zoom }) {
  return (
    <EditorProvider>
      <YourToolbar />
      <PdfCanvas pdfFile={file} scale={zoom}>
        {(pageIdx) => <FieldLayer pageIdx={pageIdx} />}
      </PdfCanvas>
      <PropsPanel />
    </EditorProvider>
  )
}
```

## Coordinate system

Fields are stored in **PDF User Space** (bottom-left origin, points). `CoordEngine` handles the transforms:

```text
PDF Points (bottom-left) → CoordEngine → Screen Pixels (top-left)
screenY = (pageHeightPt - ptY - ptH) * scaleY
```

This means:
- exported coordinates remain correct regardless of zoom level
- AcroForm fields land where they appear on screen
- there is no drift between edit mode and export

## AI proxy contract

If you choose to wire up `aiProxyUrl`, the endpoint must handle two request shapes.

**Field detection**

```json
POST { "imageBase64": "<jpeg>", "pageIndex": 0 }
→ { "fields": [{ "type": "text", "label": "Name", "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.03, "required": true }] }
```

Coordinates are 0-1 relative, top-left origin.

**Chat**

```json
POST { "message": "What fields does this form need?" }
→ { "reply": "Based on the document..." }
```

## CSS

The stylesheet must be imported separately:

```ts
import '@bugenzi/formpdf-editor/styles.css'
```

Uses CSS variables for theming. All classes are prefixed with `pfe-` or `form-field`.

## Requirements

- React 18+
- Modern browser (Chrome, Firefox, Safari, Edge)

## License

MIT
