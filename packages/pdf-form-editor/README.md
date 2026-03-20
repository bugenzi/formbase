# @formpdf/editor

Embeddable PDF form field editor for React. Drop fields onto any PDF, export AcroForm-ready documents, and build custom signing workflows — all in PDF-native coordinates.

## Install

```bash
npm install @formpdf/editor
# or
pnpm add @formpdf/editor
```

## Quick Start

```tsx
import { PdfFormEditor } from '@formpdf/editor'
import '@formpdf/editor/styles.css'

function App() {
  return (
    <PdfFormEditor
      pdfUrl="/contract.pdf"
      aiProxyUrl="/api/pdf-detect"
      onSave={(bytes) => upload(bytes)}
    />
  )
}
```

## Features

- **6 field types** — text, signature, initials, date, checkbox, dropdown
- **AI field detection** — send page images to your AI proxy, auto-detect fields
- **PDF-native coordinates** — fields stored in PDF points (72pt/inch), Y-flip handled transparently
- **AcroForm export** — export PDF with real form fields via pdf-lib
- **JSON schema export/import** — round-trip field definitions
- **Undo/redo** — immer patch-based history (structural diffs, not snapshots)
- **Keyboard shortcuts** — T/S/D/C to add fields, Ctrl+Z undo, Delete to remove
- **Drag & resize** — interact.js with snap-to-grid and alignment guides
- **Composable** — use the full editor or import individual pieces
- **Error boundary** — built-in crash recovery
- **Toast notifications** — built-in user feedback system

## Props

```typescript
interface PdfFormEditorProps {
  pdfUrl?: string        // URL to load PDF from
  pdfFile?: File         // File object (from input or drag-drop)
  aiProxyUrl: string     // Your server-side AI proxy endpoint
  onExport?: (schema) => void  // Called when JSON schema is exported
  onSave?: (pdfBytes: Uint8Array) => void  // Called when PDF is exported
}
```

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
} from '@formpdf/editor'
import '@formpdf/editor/styles.css'

function CustomEditor() {
  return (
    <EditorProvider aiProxyUrl="/api/detect">
      <YourToolbar />
      <PdfCanvas pdfFile={file} scale={zoom}>
        {(pageIdx) => <FieldLayer pageIdx={pageIdx} />}
      </PdfCanvas>
      <PropsPanel />
    </EditorProvider>
  )
}
```

## Headless Export

```typescript
import { useFormExport } from '@formpdf/editor'

function SaveButton() {
  const { exportJSON, exportToPdf, downloadJson, downloadPdf } = useFormExport()

  // Get JSON schema
  const schema = exportJSON()

  // Get PDF with embedded AcroForm fields
  const pdfBytes = await exportToPdf(originalFile)
}
```

## Schema Import

```typescript
import { useSchemaImport } from '@formpdf/editor'

function LoadButton() {
  const { importSchema, importFile } = useSchemaImport()

  // From file input
  const result = await importFile(jsonFile)
  console.log(`Imported ${result.imported} fields`)

  // From object
  importSchema(schemaObject, { clearExisting: true })
}
```

## Coordinate System

Fields are stored in **PDF User Space** (bottom-left origin, points). The `CoordEngine` handles all coordinate transforms:

```
PDF Points (bottom-left) → CoordEngine → Screen Pixels (top-left)
screenY = (pageHeightPt - ptY - ptH) * scaleY
```

This means:
- Exported coordinates are always correct regardless of zoom level
- AcroForm fields land exactly where they appear on screen
- No drift between what you see and what exports

## AI Proxy Contract

The `aiProxyUrl` endpoint must handle two request shapes:

**Field Detection:**
```json
POST { "imageBase64": "<jpeg>", "pageIndex": 0 }
→ { "fields": [{ "type": "text", "label": "Name", "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.03, "required": true }] }
```
Coordinates are 0-1 relative, top-left origin.

**Chat:**
```json
POST { "message": "What fields does this form need?" }
→ { "reply": "Based on the document..." }
```

## CSS

The stylesheet must be imported separately:

```typescript
import '@formpdf/editor/styles.css'
```

Uses CSS variables for theming. All classes are prefixed with `pfe-` or `form-field`.

## Requirements

- React 18+
- Modern browser (Chrome, Firefox, Safari, Edge)

## License

MIT
