# FormPDF — Claude Code Scaffold Prompt

> Paste this entire file as your first message to Claude Code.  
> Do not paraphrase or summarize it. The detail is intentional.

---

## YOUR ROLE

You are scaffolding a production-grade monorepo called **FormPDF**. You will create every file, directory, and configuration exactly as specified. You will not add libraries not listed. You will not restructure the directories. You will not use placeholder comments like `// TODO: implement` — every function must have a real implementation or a clearly typed stub with a `throw new Error('Not yet implemented: <name>')` body so nothing silently fails.

When you are unsure whether to deviate from this spec, do not deviate. Ask first.

---

## WHAT THIS PROJECT IS

FormPDF is two things simultaneously:

1. **A browser-based PDF form editor** — users load a PDF, AI auto-detects blank form fields, they drag/resize/configure those fields, then export either a JSON schema or a filled PDF with real AcroForm fields embedded.

2. **A publishable npm library** (`@formpdf/editor`) — any React 18+ app can drop it in with 10 lines of code.

The hardest unsolved problem in every existing PDF form tool is **coordinate system mismatch**: PDF origin is bottom-left, DOM origin is top-left. Every field drifts because most tools skip the Y-flip. This project solves it at the engine layer.

---

## CRITICAL CONSTRAINTS — READ BEFORE WRITING ANY CODE

These are non-negotiable. Violating any of them will break the entire system.

### C1 — PDF Points Are The Only Source of Truth

The `Field` interface stores `ptX, ptY, ptW, ptH` in PDF points. **Screen pixels are NEVER stored in state.** Screen position is derived at render time by calling `engine.pdfToScreen()`. This is what makes zoom, export, and Figma sync all work from the same data.

```typescript
// ❌ WRONG — never do this
interface Field { sx: number; sy: number; sw: number; sh: number }

// ✅ CORRECT
interface Field { ptX: number; ptY: number; ptW: number; ptH: number }
```

### C2 — The Y-Flip Formula

PDF Y-axis: origin is **bottom-left**, grows **upward**.  
DOM Y-axis: origin is **top-left**, grows **downward**.

The only correct formula for converting a PDF rect to a screen rect is:

```
screenY = (pdfPageHeightPt - ptY - ptH) * scaleY
```

And back:

```
ptY = pdfPageHeightPt - (screenY / scaleY) - (screenH / scaleY)
```

Any other formula is wrong and will mirror fields vertically.

### C3 — interact.js Must Always Be Cleaned Up

Every `interact(el).draggable(...)` call in a `useEffect` **must** return `interactable.unset()` as cleanup. Without this, React Strict Mode double-mounts the component and creates two overlapping interact.js bindings. The drag behavior silently breaks.

```typescript
useEffect(() => {
  const interactable = interact(el).draggable({ ... })
  return () => interactable.unset()  // ← mandatory
}, [])
```

### C4 — Drag Position Uses a Ref, Not State

During a drag, position is stored in `useRef` and applied directly to `element.style`. It is **not** written to React state on every mouse move — that would cause re-renders on every frame and make drag feel laggy. State is only updated on `dragend`.

### C5 — API Key Never Touches the Browser

The Anthropic API key is used only in a server-side proxy route. The `PdfFormEditor` component accepts `aiProxyUrl: string` (a URL to your server route), never an API key.

### C6 — pdfjs-dist Version Is 4.x

Version 3 is EOL. Version 4+ is ESM-only. The worker must be set in the same file where `getDocument` is called, using:

```typescript
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'
```

The `postinstall` script copies the worker to `/public/`. This is the only reliable approach across all Vite versions and monorepo package managers.

### C7 — Undo/Redo Uses Immer Patches, Not Snapshots

Use `produceWithPatches` from immer. This stores structural diffs, not full copies. Full copies on every keystroke will cause memory growth with large documents.

```typescript
const [nextState, patches, inversePatches] = produceWithPatches(state, draft => { ... })
history.push(patches, inversePatches)
```

### C8 — Fields Are Positioned Relative to Their Page Overlay, Not the Document

Each rendered PDF page has its own `<div class="page-overlay">`. Fields on that page are positioned with CSS `position: absolute` relative to that overlay. They are **not** positioned relative to the document scroll container. This is what prevents fields drifting when scrolling.

---

## MONOREPO STRUCTURE

Create exactly this directory tree. Do not add, remove, or rename anything.

```
formpdf/
├── apps/
│   └── web/                          # Standalone Vite + React editor app
│       ├── src/
│       │   ├── App.tsx
│       │   ├── main.tsx
│       │   └── index.css
│       ├── public/
│       │   └── .gitkeep              # pdf.worker.min.mjs is copied here by postinstall
│       ├── index.html
│       ├── vite.config.ts
│       └── package.json
│
├── packages/
│   └── pdf-form-editor/              # The npm library
│       ├── src/
│       │   ├── engine/
│       │   │   └── CoordEngine.ts
│       │   ├── store/
│       │   │   ├── types.ts
│       │   │   ├── history.ts
│       │   │   └── useFieldStore.ts
│       │   ├── components/
│       │   │   ├── PdfFormEditor.tsx
│       │   │   ├── PdfCanvas.tsx
│       │   │   ├── FieldLayer.tsx
│       │   │   ├── FieldItem.tsx
│       │   │   ├── FieldPalette.tsx
│       │   │   ├── PropsPanel.tsx
│       │   │   └── AiChatPanel.tsx
│       │   ├── hooks/
│       │   │   ├── useFormExport.ts
│       │   │   ├── useAiDetection.ts
│       │   │   └── useAlignmentGuides.ts
│       │   ├── context/
│       │   │   └── EditorContext.tsx
│       │   ├── styles/
│       │   │   └── editor.css
│       │   └── index.ts
│       ├── tsup.config.ts
│       └── package.json
│
├── package.json                      # pnpm workspace root
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .gitignore
```

---

## FILE SPECIFICATIONS

Implement each file exactly as described below.

---

### `/pnpm-workspace.yaml`

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

### `/package.json` (workspace root)

```json
{
  "name": "formpdf-monorepo",
  "private": true,
  "scripts": {
    "dev": "pnpm -r --parallel run dev",
    "build": "pnpm --filter @formpdf/editor run build",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck"
  },
  "devDependencies": {
    "typescript": "^5.6.0"
  }
}
```

---

### `/tsconfig.base.json`

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true
  }
}
```

---

### `/packages/pdf-form-editor/package.json`

```json
{
  "name": "@formpdf/editor",
  "version": "0.1.0",
  "description": "Embeddable PDF form field editor with AI detection",
  "type": "module",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    },
    "./engine": {
      "import": "./dist/engine/index.mjs",
      "require": "./dist/engine/index.cjs",
      "types": "./dist/engine/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit"
  },
  "peerDependencies": {
    "react": ">=18",
    "react-dom": ">=18"
  },
  "dependencies": {
    "pdf-lib": "^1.17.1",
    "pdfjs-dist": "^4.10.38",
    "interact.js": "^1.10.27",
    "zustand": "^5.0.0",
    "immer": "^10.1.1",
    "file-saver": "^2.0.5"
  },
  "devDependencies": {
    "tsup": "^8.3.0",
    "typescript": "^5.6.0",
    "@types/react": "^18.3.0",
    "@types/file-saver": "^2.0.7"
  }
}
```

---

### `/packages/pdf-form-editor/tsup.config.ts`

```typescript
import { defineConfig } from 'tsup'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'engine/index': 'src/engine/CoordEngine.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom'],
})
```

---

### `/packages/pdf-form-editor/src/engine/CoordEngine.ts`

This is the most critical file in the entire codebase. Implement it exactly as specified. Do not simplify.

```typescript
/**
 * CoordEngine — converts between three coordinate spaces:
 *
 * Space 1: PDF User Space
 *   Origin: bottom-left of page. Y grows UPWARD. Units: points (1/72 inch).
 *   Used by: pdf-lib AcroForm Rect, the stored Field interface, export schema.
 *
 * Space 2: Canvas/DOM Space
 *   Origin: top-left of page overlay div. Y grows DOWNWARD. Units: CSS pixels.
 *   Used by: interact.js drag events, element.style.left/top, IntersectionObserver.
 *
 * Space 3: Relative (AI output)
 *   Origin: top-left (same as DOM). Both axes 0.0–1.0 fractions of page size.
 *   Used by: AI detection response, Figma bridge positionRel.
 *
 * THE ONLY CORRECT Y-FLIP:
 *   PDF → Screen: screenY = (pdfHeightPt - ptY - ptH) * scaleY
 *   Screen → PDF: ptY = pdfHeightPt - (screenY / scaleY) - (screenH / scaleY)
 *
 * Fields on page N are positioned relative to page N's overlay div.
 * They are NOT positioned relative to the document scroll container.
 */

export interface PageRegistration {
  pdfWidthPt: number
  pdfHeightPt: number
  canvasWidthPx: number   // CSS pixels (already divided by devicePixelRatio)
  canvasHeightPx: number
  scaleX: number          // canvasWidthPx / pdfWidthPt
  scaleY: number          // canvasHeightPx / pdfHeightPt
  rotation: number        // 0 | 90 | 180 | 270 — from page.rotate in pdfjs
}

export interface PdfRect {
  x: number  // bottom-left origin
  y: number  // bottom-left origin, grows upward
  w: number
  h: number
}

export interface ScreenRect {
  x: number  // top-left origin
  y: number  // top-left origin, grows downward
  w: number
  h: number
}

export class CoordEngine {
  readonly pages = new Map<number, PageRegistration>()

  registerPage(
    pageIdx: number,
    pdfWidthPt: number,
    pdfHeightPt: number,
    canvasWidthPx: number,
    canvasHeightPx: number,
    rotation: number = 0,
  ): void {
    this.pages.set(pageIdx, {
      pdfWidthPt,
      pdfHeightPt,
      canvasWidthPx,
      canvasHeightPx,
      scaleX: canvasWidthPx / pdfWidthPt,
      scaleY: canvasHeightPx / pdfHeightPt,
      rotation,
    })
  }

  deregisterPage(pageIdx: number): void {
    this.pages.delete(pageIdx)
  }

  getPage(pageIdx: number): PageRegistration | undefined {
    return this.pages.get(pageIdx)
  }

  /**
   * PDF points → screen pixels.
   * Applies Y-flip: PDF bottom-left origin → DOM top-left origin.
   * Call this when rendering a stored field onto the canvas overlay.
   */
  pdfToScreen(
    ptX: number,
    ptY: number,
    ptW: number,
    ptH: number,
    pageIdx: number,
  ): ScreenRect | null {
    const p = this.pages.get(pageIdx)
    if (!p) return null

    if (p.rotation !== 0) {
      console.warn(
        `[CoordEngine] Page ${pageIdx} has rotation=${p.rotation}. ` +
        `Only 0° is supported in MVP. Field will be misplaced.`,
      )
    }

    return {
      x: ptX * p.scaleX,
      y: (p.pdfHeightPt - ptY - ptH) * p.scaleY,  // ← THE Y-FLIP
      w: ptW * p.scaleX,
      h: ptH * p.scaleY,
    }
  }

  /**
   * Screen pixels → PDF points.
   * Reverses Y-flip: DOM top-left origin → PDF bottom-left origin.
   * Call this on drag-end to persist the new position.
   */
  screenToPdf(
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    pageIdx: number,
  ): PdfRect | null {
    const p = this.pages.get(pageIdx)
    if (!p) return null

    return {
      x: sx / p.scaleX,
      y: p.pdfHeightPt - (sy / p.scaleY) - (sh / p.scaleY),  // ← Y-FLIP REVERSED
      w: sw / p.scaleX,
      h: sh / p.scaleY,
    }
  }

  /**
   * Relative 0–1 fractions → screen pixels.
   * NO Y-flip: AI returns top-left-origin coords, same as DOM.
   * Call this when placing AI-detected fields as a preview.
   * After user confirms, call screenToPdf() to get storable PDF points.
   */
  relToScreen(
    relX: number,
    relY: number,
    relW: number,
    relH: number,
    pageIdx: number,
  ): ScreenRect | null {
    const p = this.pages.get(pageIdx)
    if (!p) return null

    return {
      x: relX * p.canvasWidthPx,
      y: relY * p.canvasHeightPx,   // No flip — AI output is already top-left
      w: relW * p.canvasWidthPx,
      h: relH * p.canvasHeightPx,
    }
  }

  /**
   * Clamps a screen rect to page bounds.
   * Use this after every drag/resize to prevent fields from leaving the page.
   */
  clamp(
    sx: number,
    sy: number,
    sw: number,
    sh: number,
    pageIdx: number,
  ): ScreenRect {
    const p = this.pages.get(pageIdx)
    if (!p) return { x: sx, y: sy, w: sw, h: sh }

    const clampedW = Math.min(sw, p.canvasWidthPx)
    const clampedH = Math.min(sh, p.canvasHeightPx)

    return {
      x: Math.max(0, Math.min(sx, p.canvasWidthPx - clampedW)),
      y: Math.max(0, Math.min(sy, p.canvasHeightPx - clampedH)),
      w: clampedW,
      h: clampedH,
    }
  }
}
```

---

### `/packages/pdf-form-editor/src/store/types.ts`

```typescript
/**
 * Field — a form field placed on a PDF page.
 *
 * IMPORTANT: ptX, ptY, ptW, ptH are in PDF User Space (bottom-left origin, points).
 * Screen position is NEVER stored here. It is derived at render time via CoordEngine.pdfToScreen().
 * This is what makes the system zoom-stable and export-correct.
 */
export interface Field {
  id: string
  type: 'text' | 'signature' | 'initials' | 'date' | 'checkbox' | 'dropdown'
  pageIdx: number   // 0-indexed

  // PDF User Space coordinates — bottom-left origin, Y grows upward, units: points
  ptX: number
  ptY: number
  ptW: number
  ptH: number

  label: string
  required: boolean
  assignee: string     // e.g. "signer1", "notary", ""
  aiPending?: boolean  // true = placed by AI, not yet confirmed by user
}

export interface TextOverlay {
  id: string
  pageIdx: number
  ptX: number
  ptY: number
  ptW: number
  ptH: number
  content: string
  fontSize: number
  fontFamily: string
  color: string
}

export interface FieldState {
  fields: Record<string, Field>
  textOverlays: Record<string, TextOverlay>
  selectedId: string | null
  selectedType: 'field' | 'text' | null
}

export interface FormSchema {
  version: '2.0'
  pages: Array<{ page: number; widthPt: number; heightPt: number }>
  fields: Array<{
    id: string
    type: Field['type']
    label: string
    page: number
    required: boolean
    assignee: string
    positionPt: { x: number; y: number; w: number; h: number }
    // positionRel uses TOP-LEFT origin for front-end consumption compatibility
    // relY = (pageHeightPt - ptY - ptH) / pageHeightPt
    positionRel: { x: number; y: number; w: number; h: number }
  }>
}

// Default sizes per field type (in PDF points, 72pt = 1 inch)
export const FIELD_DEFAULTS: Record<Field['type'], { ptW: number; ptH: number }> = {
  text:      { ptW: 180, ptH: 24 },
  signature: { ptW: 240, ptH: 48 },
  initials:  { ptW:  60, ptH: 40 },
  date:      { ptW: 100, ptH: 24 },
  checkbox:  { ptW:  14, ptH: 14 },
  dropdown:  { ptW: 160, ptH: 24 },
}
```

---

### `/packages/pdf-form-editor/src/store/history.ts`

```typescript
import { enablePatches, type Patch } from 'immer'

// Must be called before any produceWithPatches usage
enablePatches()

interface HistoryEntry {
  patches: Patch[]
  inversePatches: Patch[]
}

/**
 * Patch-based undo/redo stack.
 *
 * Uses immer's produceWithPatches to store structural diffs (not full copies).
 * A 15-page document with 80 fields generates a full copy on every change
 * if you use snapshot-based history. Patches store only what changed.
 *
 * Usage:
 *   const [next, patches, inverse] = produceWithPatches(state, draft => { ... })
 *   history.push(patches, inverse)
 *
 * To undo:
 *   const patches = history.undo()
 *   if (patches) setState(applyPatches(state, patches))
 */
export class HistoryStack {
  private stack: HistoryEntry[] = []
  private pointer = -1
  private readonly MAX: number

  constructor(maxEntries = 100) {
    this.MAX = maxEntries
  }

  push(patches: Patch[], inversePatches: Patch[]): void {
    // Discard any forward history when a new action is committed
    this.stack = this.stack.slice(0, this.pointer + 1)
    this.stack.push({ patches, inversePatches })

    if (this.stack.length > this.MAX) {
      this.stack.shift()
    } else {
      this.pointer++
    }
  }

  undo(): Patch[] | null {
    if (this.pointer < 0) return null
    return this.stack[this.pointer--].inversePatches
  }

  redo(): Patch[] | null {
    if (this.pointer >= this.stack.length - 1) return null
    return this.stack[++this.pointer].patches
  }

  get canUndo(): boolean {
    return this.pointer >= 0
  }

  get canRedo(): boolean {
    return this.pointer < this.stack.length - 1
  }

  clear(): void {
    this.stack = []
    this.pointer = -1
  }
}
```

---

### `/packages/pdf-form-editor/src/store/useFieldStore.ts`

```typescript
import { create } from 'zustand'
import { produceWithPatches, applyPatches } from 'immer'
import { HistoryStack } from './history'
import type { Field, FieldState, TextOverlay } from './types'

const history = new HistoryStack(100)

interface UpdateOpts {
  undoable?: boolean
}

interface FieldStore extends FieldState {
  // Field operations
  addField: (field: Field, opts?: UpdateOpts) => void
  updateField: (id: string, patch: Partial<Field>, opts?: UpdateOpts) => void
  deleteField: (id: string) => void

  // Text overlay operations
  addTextOverlay: (overlay: TextOverlay) => void
  updateTextOverlay: (id: string, patch: Partial<TextOverlay>) => void
  deleteTextOverlay: (id: string) => void

  // Selection
  selectField: (id: string | null) => void
  selectText: (id: string | null) => void

  // History
  undo: () => void
  redo: () => void
  canUndo: () => boolean
  canRedo: () => boolean

  // Bulk
  clearAll: () => void
  getField: (id: string) => Field | undefined
}

export const useFieldStore = create<FieldStore>((set, get) => ({
  fields: {},
  textOverlays: {},
  selectedId: null,
  selectedType: null,

  addField: (field, opts = { undoable: true }) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        draft.fields[field.id] = field
      })
      if (opts.undoable !== false) history.push(patches, inversePatches)
      return nextState
    })
  },

  updateField: (id, patch, opts = { undoable: true }) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        if (draft.fields[id]) Object.assign(draft.fields[id], patch)
      })
      if (opts.undoable !== false) history.push(patches, inversePatches)
      return nextState
    })
  },

  deleteField: (id) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        delete draft.fields[id]
        if (draft.selectedId === id) {
          draft.selectedId = null
          draft.selectedType = null
        }
      })
      history.push(patches, inversePatches)
      return nextState
    })
  },

  addTextOverlay: (overlay) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        draft.textOverlays[overlay.id] = overlay
      })
      history.push(patches, inversePatches)
      return nextState
    })
  },

  updateTextOverlay: (id, patch) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        if (draft.textOverlays[id]) Object.assign(draft.textOverlays[id], patch)
      })
      history.push(patches, inversePatches)
      return nextState
    })
  },

  deleteTextOverlay: (id) => {
    set(state => {
      const [nextState, patches, inversePatches] = produceWithPatches(state, draft => {
        delete draft.textOverlays[id]
        if (draft.selectedId === id) {
          draft.selectedId = null
          draft.selectedType = null
        }
      })
      history.push(patches, inversePatches)
      return nextState
    })
  },

  selectField: (id) => set({ selectedId: id, selectedType: id ? 'field' : null }),
  selectText:  (id) => set({ selectedId: id, selectedType: id ? 'text'  : null }),

  undo: () => {
    const patches = history.undo()
    if (patches) set(state => applyPatches(state, patches))
  },

  redo: () => {
    const patches = history.redo()
    if (patches) set(state => applyPatches(state, patches))
  },

  canUndo: () => history.canUndo,
  canRedo: () => history.canRedo,

  clearAll: () => {
    set({ fields: {}, textOverlays: {}, selectedId: null, selectedType: null })
    history.clear()
  },

  getField: (id) => get().fields[id],
}))
```

---

### `/packages/pdf-form-editor/src/context/EditorContext.tsx`

```typescript
import React, { createContext, useContext, useMemo } from 'react'
import { CoordEngine } from '../engine/CoordEngine'

interface EditorContextValue {
  engine: CoordEngine
  aiProxyUrl: string
}

const EditorContext = createContext<EditorContextValue | null>(null)

export function EditorProvider({
  children,
  aiProxyUrl,
}: {
  children: React.ReactNode
  aiProxyUrl: string
}) {
  // Engine is created once per editor instance and never recreated
  const engine = useMemo(() => new CoordEngine(), [])

  return (
    <EditorContext.Provider value={{ engine, aiProxyUrl }}>
      {children}
    </EditorContext.Provider>
  )
}

export function useEditorContext(): EditorContextValue {
  const ctx = useContext(EditorContext)
  if (!ctx) throw new Error('useEditorContext must be used inside <EditorProvider>')
  return ctx
}
```

---

### `/packages/pdf-form-editor/src/components/PdfCanvas.tsx`

This component renders PDF pages using pdfjs-dist 4.x. Key rules:

- Set `workerSrc` **in this file**, not in a separate init file.
- Use `devicePixelRatio` for HiDPI: `canvas.width = viewport.width` (physical), `canvas.style.width = viewport.width / dpr + 'px'` (CSS).
- Cancel any in-progress render task before starting a new one.
- Register the page with `engine.registerPage()` **after** render completes.
- Detect `page.rotate !== 0` and call `onPageWarning` if provided.
- Use `IntersectionObserver` with `rootMargin: '200px'` to render pages on demand.

```typescript
import React, { useEffect, useRef, useCallback } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import type { PDFDocumentProxy, PDFPageProxy, RenderTask } from 'pdfjs-dist'
import { useEditorContext } from '../context/EditorContext'

// CRITICAL: Set workerSrc in the same file where getDocument is used.
// pdf.worker.min.mjs is copied to /public by the postinstall script.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

interface PdfCanvasProps {
  pdfFile: File | null
  scale: number
  onPageCount?: (count: number) => void
  onPageWarning?: (pageIdx: number, message: string) => void
  children?: (pageIdx: number) => React.ReactNode  // Render field overlay per page
}

export function PdfCanvas({ pdfFile, scale, onPageCount, onPageWarning, children }: PdfCanvasProps) {
  const { engine } = useEditorContext()
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<PDFDocumentProxy | null>(null)
  const renderTasksRef = useRef<Map<number, RenderTask>>(new Map())
  const renderedPagesRef = useRef<Set<number>>(new Set())

  const renderPage = useCallback(async (pageIdx: number) => {
    const pdfDoc = pdfDocRef.current
    if (!pdfDoc) return

    const dpr = window.devicePixelRatio || 1
    const page: PDFPageProxy = await pdfDoc.getPage(pageIdx + 1) // pdfjs is 1-indexed

    // Warn if page is rotated (MVP only supports 0°)
    if (page.rotate !== 0) {
      onPageWarning?.(
        pageIdx,
        `Page ${pageIdx + 1} is rotated ${page.rotate}°. Field placement on rotated pages is not supported in this version.`,
      )
    }

    const viewport = page.getViewport({ scale: scale * dpr, rotation: page.rotate })

    const wrapper = containerRef.current?.querySelector(`[data-page="${pageIdx}"]`)
    if (!wrapper) return

    let canvas = wrapper.querySelector('canvas') as HTMLCanvasElement | null
    if (!canvas) {
      canvas = document.createElement('canvas')
      wrapper.insertBefore(canvas, wrapper.firstChild)
    }

    canvas.width  = viewport.width
    canvas.height = viewport.height
    canvas.style.width  = viewport.width  / dpr + 'px'
    canvas.style.height = viewport.height / dpr + 'px'

    // Cancel any in-flight render for this page
    const existingTask = renderTasksRef.current.get(pageIdx)
    if (existingTask) {
      try { existingTask.cancel() } catch {}
    }

    const ctx = canvas.getContext('2d')!
    const renderTask = page.render({ canvasContext: ctx, viewport })
    renderTasksRef.current.set(pageIdx, renderTask)

    try {
      await renderTask.promise
    } catch (e: unknown) {
      // RenderingCancelledException is expected when a render is superseded
      if ((e as Error)?.name !== 'RenderingCancelledException') throw e
      return
    }

    renderTasksRef.current.delete(pageIdx)
    renderedPagesRef.current.add(pageIdx)

    // Register page with engine AFTER render (dimensions now known)
    const cssW = viewport.width  / dpr
    const cssH = viewport.height / dpr
    engine.registerPage(
      pageIdx,
      cssW / scale,   // pdfWidthPt
      cssH / scale,   // pdfHeightPt
      cssW,           // canvasWidthPx (CSS pixels)
      cssH,           // canvasHeightPx
      page.rotate,
    )
  }, [scale, engine, onPageWarning])

  const destroyPage = useCallback((pageIdx: number) => {
    const task = renderTasksRef.current.get(pageIdx)
    if (task) { try { task.cancel() } catch {} }
    renderTasksRef.current.delete(pageIdx)
    renderedPagesRef.current.delete(pageIdx)
    engine.deregisterPage(pageIdx)

    const wrapper = containerRef.current?.querySelector(`[data-page="${pageIdx}"]`)
    const canvas = wrapper?.querySelector('canvas')
    if (canvas) canvas.remove()
  }, [engine])

  useEffect(() => {
    if (!pdfFile) return

    let cancelled = false

    async function load() {
      const arrayBuffer = await pdfFile!.arrayBuffer()
      const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
      if (cancelled) { pdfDoc.destroy(); return }

      pdfDocRef.current = pdfDoc
      onPageCount?.(pdfDoc.numPages)

      // Build page wrapper divs before setting up IntersectionObserver
      const container = containerRef.current
      if (!container) return
      container.innerHTML = ''

      for (let i = 0; i < pdfDoc.numPages; i++) {
        const wrapper = document.createElement('div')
        wrapper.className = 'pdf-page-wrapper'
        wrapper.dataset.page = String(i)
        // Placeholder height prevents layout jump before canvas renders
        wrapper.style.minHeight = '800px'
        wrapper.style.position = 'relative'
        container.appendChild(wrapper)
      }

      // Render pages on demand as they enter the viewport
      const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          const idx = parseInt((entry.target as HTMLElement).dataset.page!)
          if (entry.isIntersecting) {
            if (!renderedPagesRef.current.has(idx)) renderPage(idx)
          } else {
            // Keep adjacent pages in memory for smooth scroll
            const current = [...renderedPagesRef.current].sort()[0] ?? 0
            if (Math.abs(idx - current) > 1) destroyPage(idx)
          }
        })
      }, { rootMargin: '200px' })

      container.querySelectorAll('[data-page]').forEach(el => observer.observe(el))

      return () => observer.disconnect()
    }

    load()
    return () => { cancelled = true }
  }, [pdfFile, renderPage, destroyPage, onPageCount])

  return (
    <div ref={containerRef} className="pdf-canvas-container">
      {/* Page wrappers are created imperatively above */}
    </div>
  )
}
```

---

### `/packages/pdf-form-editor/src/components/FieldItem.tsx`

This is where the drag/resize lifecycle lives. Follow constraints C1–C4 exactly.

```typescript
import React, { useRef, useEffect } from 'react'
import interact from 'interact.js'
import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'
import type { Field } from '../store/types'

interface FieldItemProps {
  field: Field
}

export function FieldItem({ field }: FieldItemProps) {
  const elRef = useRef<HTMLDivElement>(null)
  /**
   * dragPos holds the current screen position during an active drag.
   * It is a REF, not state. Writing it to state on every mouse move
   * would cause a React re-render on every frame, making drag feel laggy.
   * State (via updateField) is only written on drag-end.
   */
  const dragPos = useRef({ x: 0, y: 0, w: 0, h: 0 })

  const { updateField, selectField, selectedId } = useFieldStore()
  const { engine } = useEditorContext()
  const isSelected = selectedId === field.id

  // Derive initial screen position from PDF points
  const screen = engine.pdfToScreen(field.ptX, field.ptY, field.ptW, field.ptH, field.pageIdx)

  useEffect(() => {
    const el = elRef.current
    const s = engine.pdfToScreen(field.ptX, field.ptY, field.ptW, field.ptH, field.pageIdx)
    if (!el || !s) return

    dragPos.current = { x: s.x, y: s.y, w: s.w, h: s.h }

    const interactable = interact(el)
      .draggable({
        modifiers: [
          interact.modifiers.snap({
            targets: [interact.snappers.grid({ x: 8, y: 8 })],
            range: Infinity,
            relativePoints: [{ x: 0, y: 0 }],
          }),
          interact.modifiers.restrict({ restriction: 'parent', elementRect: { top: 0, left: 0, bottom: 1, right: 1 } }),
        ],
        listeners: {
          move(event) {
            dragPos.current.x += event.dx
            dragPos.current.y += event.dy
            el.style.left = dragPos.current.x + 'px'
            el.style.top  = dragPos.current.y + 'px'
          },
          end() {
            const clamped = engine.clamp(
              dragPos.current.x,
              dragPos.current.y,
              dragPos.current.w,
              dragPos.current.h,
              field.pageIdx,
            )
            const pts = engine.screenToPdf(clamped.x, clamped.y, clamped.w, clamped.h, field.pageIdx)
            if (pts) {
              updateField(field.id, { ptX: pts.x, ptY: pts.y }, { undoable: true })
            }
          },
        },
      })
      .resizable({
        edges: { left: true, right: true, bottom: true, top: true },
        modifiers: [
          interact.modifiers.restrictSize({ min: { width: 20, height: 12 } }),
        ],
        listeners: {
          move(event) {
            const { left, top } = event.deltaRect
            dragPos.current.x += left
            dragPos.current.y += top
            dragPos.current.w  = event.rect.width
            dragPos.current.h  = event.rect.height
            el.style.left   = dragPos.current.x + 'px'
            el.style.top    = dragPos.current.y + 'px'
            el.style.width  = dragPos.current.w + 'px'
            el.style.height = dragPos.current.h + 'px'
          },
          end() {
            const pts = engine.screenToPdf(
              dragPos.current.x,
              dragPos.current.y,
              dragPos.current.w,
              dragPos.current.h,
              field.pageIdx,
            )
            if (pts) {
              updateField(field.id, { ptX: pts.x, ptY: pts.y, ptW: pts.w, ptH: pts.h }, { undoable: true })
            }
          },
        },
      })

    // CRITICAL: unset() prevents double-binding in React Strict Mode
    // and cleans up when the component remounts after hot reload.
    return () => interactable.unset()
  }, [field.id, field.pageIdx, engine, updateField])

  if (!screen) return null

  return (
    <div
      ref={elRef}
      id={`field-${field.id}`}
      className={`form-field form-field--${field.type}${isSelected ? ' form-field--selected' : ''}${field.aiPending ? ' form-field--ai-pending' : ''}`}
      style={{
        position: 'absolute',
        left: screen.x,
        top:  screen.y,
        width:  screen.w,
        height: screen.h,
      }}
      onClick={(e) => {
        e.stopPropagation()
        selectField(field.id)
      }}
    >
      <span className="form-field__label">{field.label}</span>
      {field.aiPending && (
        <div className="form-field__ai-controls">
          <button onClick={(e) => { e.stopPropagation(); confirmAiField(field.id) }}>✓</button>
          <button onClick={(e) => { e.stopPropagation(); discardAiField(field.id) }}>✕</button>
        </div>
      )}
    </div>
  )
}

// These will be wired up to the store in Phase 4
function confirmAiField(id: string) {
  useFieldStore.getState().updateField(id, { aiPending: false })
}
function discardAiField(id: string) {
  useFieldStore.getState().deleteField(id)
}
```

---

### `/packages/pdf-form-editor/src/components/FieldLayer.tsx`

```typescript
import React from 'react'
import { useFieldStore } from '../store/useFieldStore'
import { FieldItem } from './FieldItem'

interface FieldLayerProps {
  pageIdx: number
}

/**
 * FieldLayer renders on top of a single PDF page canvas.
 * It must be absolutely positioned with the same dimensions as the canvas.
 * Fields are positioned relative to THIS div, not the scroll container.
 */
export function FieldLayer({ pageIdx }: FieldLayerProps) {
  const fields = useFieldStore(s =>
    Object.values(s.fields).filter(f => f.pageIdx === pageIdx),
  )

  return (
    <div
      className="field-layer"
      style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}
      onMouseDown={() => useFieldStore.getState().selectField(null)}
    >
      {fields.map(field => (
        <FieldItem key={field.id} field={field} />
      ))}
    </div>
  )
}
```

---

### `/packages/pdf-form-editor/src/components/PropsPanel.tsx`

```typescript
import React from 'react'
import { useFieldStore } from '../store/useFieldStore'

/**
 * PropsPanel shows and edits field properties.
 * ptX/ptY/ptW/ptH are displayed directly in PDF points — no engine call needed.
 * This is because the store already holds PDF points as the source of truth.
 */
export function PropsPanel() {
  const { fields, selectedId, selectedType, updateField } = useFieldStore()
  const field = selectedId && selectedType === 'field' ? fields[selectedId] : null

  if (!field) {
    return (
      <div className="props-panel props-panel--empty">
        <p>Select a field to edit its properties.</p>
      </div>
    )
  }

  return (
    <div className="props-panel">
      <h3>Field Properties</h3>

      <label>
        Label
        <input
          value={field.label}
          onChange={e => updateField(field.id, { label: e.target.value }, { undoable: false })}
          onBlur={e => updateField(field.id, { label: e.target.value }, { undoable: true })}
        />
      </label>

      <label>
        Type
        <select
          value={field.type}
          onChange={e => updateField(field.id, { type: e.target.value as any }, { undoable: true })}
        >
          {(['text','signature','initials','date','checkbox','dropdown'] as const).map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </label>

      <label>
        Assignee
        <input
          value={field.assignee}
          onChange={e => updateField(field.id, { assignee: e.target.value }, { undoable: false })}
          onBlur={e => updateField(field.id, { assignee: e.target.value }, { undoable: true })}
        />
      </label>

      <label className="props-panel__checkbox">
        <input
          type="checkbox"
          checked={field.required}
          onChange={e => updateField(field.id, { required: e.target.checked }, { undoable: true })}
        />
        Required
      </label>

      <h4>Position (PDF points)</h4>
      <div className="props-panel__coords">
        {(['ptX','ptY','ptW','ptH'] as const).map(key => (
          <label key={key}>
            {key.replace('pt','')}
            <input
              type="number"
              value={Math.round(field[key])}
              onChange={e => updateField(field.id, { [key]: +e.target.value }, { undoable: false })}
              onBlur={e => updateField(field.id, { [key]: +e.target.value }, { undoable: true })}
            />
          </label>
        ))}
      </div>
    </div>
  )
}
```

---

### `/packages/pdf-form-editor/src/hooks/useFormExport.ts`

```typescript
import { PDFDocument, PDFName, PDFDict, PDFArray } from 'pdf-lib'
import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'
import type { FormSchema, Field } from '../store/types'
import { saveAs } from 'file-saver'

/**
 * IMPORTANT — pdf-lib hard limits:
 * 1. Encrypted PDFs: PDFDocument.load() throws. Guard with try/catch.
 * 2. Existing digital signatures: pdf-lib modifies the byte stream,
 *    permanently invalidating them. Detect /Sig fields and warn before export.
 * 3. pdf-lib cannot CREATE digital signatures (no sign() API).
 *    It can add blank signature WIDGETS (input areas), which is the MVP use case.
 */

export function useFormExport() {
  const { fields } = useFieldStore.getState()
  const { engine } = useEditorContext()

  async function loadPdfSafely(file: File): Promise<PDFDocument | null> {
    const bytes = await file.arrayBuffer()

    try {
      const doc = await PDFDocument.load(bytes)

      // Check for existing digital signatures — warn before any modification
      const acroForm = doc.catalog.lookupMaybe(PDFName.of('AcroForm'), PDFDict)
      if (acroForm) {
        const fieldArray = acroForm.lookupMaybe(PDFName.of('Fields'), PDFArray)
        if (fieldArray) {
          for (let i = 0; i < fieldArray.size(); i++) {
            try {
              const f = fieldArray.lookup(i, PDFDict)
              const ft = f.lookupMaybe(PDFName.of('FT'), PDFName)
              if (ft?.asString() === 'Sig') {
                console.warn(
                  '[useFormExport] PDF contains existing digital signatures. ' +
                  'Exporting will invalidate them. Consider warning the user.',
                )
                break
              }
            } catch {}
          }
        }
      }

      return doc
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('encrypted')) {
        console.error('[useFormExport] PDF is encrypted. Cannot load with pdf-lib.')
      } else {
        console.error('[useFormExport] Failed to load PDF:', msg)
      }
      return null
    }
  }

  function exportJSON(): FormSchema {
    const pages = [...engine.pages.entries()].map(([i, p]) => ({
      page: i + 1,
      widthPt: p.pdfWidthPt,
      heightPt: p.pdfHeightPt,
    }))

    const schemaFields = Object.values(fields).map(f => {
      const p = engine.getPage(f.pageIdx)!
      return {
        id: f.id,
        type: f.type,
        label: f.label,
        page: f.pageIdx + 1,
        required: f.required,
        assignee: f.assignee,
        positionPt: { x: f.ptX, y: f.ptY, w: f.ptW, h: f.ptH },
        // positionRel uses TOP-LEFT origin for front-end consumers
        positionRel: {
          x: f.ptX / p.pdfWidthPt,
          y: (p.pdfHeightPt - f.ptY - f.ptH) / p.pdfHeightPt,
          w: f.ptW / p.pdfWidthPt,
          h: f.ptH / p.pdfHeightPt,
        },
      }
    })

    return { version: '2.0', pages, fields: schemaFields }
  }

  async function exportToPdf(originalFile: File): Promise<Uint8Array | null> {
    const doc = await loadPdfSafely(originalFile)
    if (!doc) return null

    const form = doc.getForm()
    const pdfPages = doc.getPages()

    for (const field of Object.values(fields)) {
      const page = pdfPages[field.pageIdx]
      if (!page) continue

      const { width: pageW, height: pageH } = page.getSize()

      // pdf-lib uses bottom-left origin natively — no Y-flip needed here
      // field.ptX and field.ptY are already in PDF user space
      const rect = {
        x: field.ptX,
        y: field.ptY,
        width: field.ptW,
        height: field.ptH,
      }

      const fieldName = field.label || field.id

      switch (field.type) {
        case 'text':
        case 'date':
          form.createTextField(fieldName).addToPage(page, rect)
          break
        case 'signature':
        case 'initials':
          // pdf-lib adds blank signature widget (input area only, no crypto signing)
          form.createTextField(fieldName).addToPage(page, rect)
          break
        case 'checkbox':
          form.createCheckBox(fieldName).addToPage(page, rect)
          break
        case 'dropdown':
          form.createDropdown(fieldName).addToPage(page, rect)
          break
      }
    }

    return doc.save()
  }

  async function downloadJson(filename = 'form-schema.json') {
    const schema = exportJSON()
    const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' })
    saveAs(blob, filename)
  }

  async function downloadPdf(originalFile: File, filename = 'form-filled.pdf') {
    const bytes = await exportToPdf(originalFile)
    if (!bytes) return
    const blob = new Blob([bytes], { type: 'application/pdf' })
    saveAs(blob, filename)
  }

  return { exportJSON, exportToPdf, downloadJson, downloadPdf, loadPdfSafely }
}
```

---

### `/packages/pdf-form-editor/src/hooks/useAiDetection.ts`

```typescript
import { nanoid } from 'nanoid'  // install: pnpm add nanoid
import { useFieldStore } from '../store/useFieldStore'
import { useEditorContext } from '../context/EditorContext'
import type { Field } from '../store/types'
import { FIELD_DEFAULTS } from '../store/types'

interface DetectionStatus {
  status: 'idle' | 'running' | 'done' | 'error'
  progress: { current: number; total: number; page: number } | null
  error: string | null
}

/**
 * AI detection pipeline:
 * 1. Capture each page as JPEG from its canvas
 * 2. POST to aiProxyUrl (your server — never call Anthropic directly from browser)
 * 3. Server returns relative 0–1 coords (top-left origin)
 * 4. relToScreen() converts to DOM pixels (no Y-flip — AI is already top-left)
 * 5. screenToPdf() converts to PDF points with Y-flip
 * 6. Field is added as aiPending=true for user confirmation
 */
export function useAiDetection(
  setStatus: (s: DetectionStatus) => void,
) {
  const { addField } = useFieldStore.getState()
  const { engine, aiProxyUrl } = useEditorContext()

  async function detectPage(pageIdx: number): Promise<void> {
    const pageEl = document.querySelector<HTMLElement>(`[data-page="${pageIdx}"]`)
    const canvas = pageEl?.querySelector('canvas')
    if (!canvas) throw new Error(`Canvas not found for page ${pageIdx}`)

    const imageBase64 = canvas.toDataURL('image/jpeg', 0.85).split(',')[1]

    const response = await fetch(aiProxyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageBase64, pageIndex: pageIdx }),
    })

    if (!response.ok) {
      throw new Error(`AI proxy returned ${response.status}: ${await response.text()}`)
    }

    const data = await response.json()
    const detectedFields: Array<{
      type: Field['type']
      label: string
      x: number; y: number; w: number; h: number
      required: boolean
    }> = data.fields ?? []

    for (const detected of detectedFields) {
      // relToScreen: relative top-left → DOM pixels (no Y-flip)
      const screen = engine.relToScreen(detected.x, detected.y, detected.w, detected.h, pageIdx)
      if (!screen) continue

      // screenToPdf: DOM pixels → PDF points (applies Y-flip)
      const pts = engine.screenToPdf(screen.x, screen.y, screen.w, screen.h, pageIdx)
      if (!pts) continue

      const fieldType = detected.type in FIELD_DEFAULTS ? detected.type : 'text'

      addField({
        id: nanoid(),
        type: fieldType,
        pageIdx,
        ptX: pts.x,
        ptY: pts.y,
        ptW: pts.w,
        ptH: pts.h,
        label: detected.label || fieldType,
        required: detected.required ?? false,
        assignee: '',
        aiPending: true,
      })
    }
  }

  async function detectAll(totalPages: number): Promise<void> {
    setStatus({ status: 'running', progress: { current: 0, total: totalPages, page: 0 }, error: null })

    const BATCH_SIZE = 3
    for (let i = 0; i < totalPages; i += BATCH_SIZE) {
      const batch = Array.from(
        { length: Math.min(BATCH_SIZE, totalPages - i) },
        (_, j) => detectPage(i + j),
      )

      try {
        await Promise.all(batch)
      } catch (e) {
        setStatus({ status: 'error', progress: null, error: (e as Error).message })
        return
      }

      setStatus({
        status: 'running',
        progress: { current: Math.min(i + BATCH_SIZE, totalPages), total: totalPages, page: i + BATCH_SIZE },
        error: null,
      })
    }

    setStatus({ status: 'done', progress: null, error: null })
  }

  return { detectAll, detectPage }
}
```

---

### `/packages/pdf-form-editor/src/components/PdfFormEditor.tsx`

The top-level drop-in component. Composes everything.

```typescript
import React, { useState, useCallback } from 'react'
import { EditorProvider } from '../context/EditorContext'
import { PdfCanvas } from './PdfCanvas'
import { FieldLayer } from './FieldLayer'
import { PropsPanel } from './PropsPanel'
import { FieldPalette } from './FieldPalette'
import { AiChatPanel } from './AiChatPanel'
import '../styles/editor.css'

export interface PdfFormEditorProps {
  pdfUrl?: string
  pdfFile?: File
  aiProxyUrl: string
  onExport?: (schema: ReturnType<typeof import('../hooks/useFormExport').useFormExport>['exportJSON']) => void
  onSave?: (pdfBytes: Uint8Array) => void
}

export function PdfFormEditor({ pdfUrl, pdfFile: pdfFileProp, aiProxyUrl, onExport, onSave }: PdfFormEditorProps) {
  const [loadedFile, setLoadedFile] = useState<File | null>(pdfFileProp ?? null)
  const [scale, setScale] = useState(1.0)
  const [pageCount, setPageCount] = useState(0)
  const [pageWarnings, setPageWarnings] = useState<Record<number, string>>({})

  const handlePageWarning = useCallback((pageIdx: number, message: string) => {
    setPageWarnings(prev => ({ ...prev, [pageIdx]: message }))
  }, [])

  const handleFileDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file?.type === 'application/pdf') setLoadedFile(file)
  }, [])

  return (
    <EditorProvider aiProxyUrl={aiProxyUrl}>
      <div className="pfe-root" onDragOver={e => e.preventDefault()} onDrop={handleFileDrop}>
        <div className="pfe-sidebar pfe-sidebar--left">
          <FieldPalette />
        </div>

        <div className="pfe-canvas-area">
          {Object.values(pageWarnings).map((msg, i) => (
            <div key={i} className="pfe-warning-banner">{msg}</div>
          ))}

          {!loadedFile && (
            <div className="pfe-drop-zone">
              <p>Drop a PDF here or</p>
              <label>
                Browse
                <input
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={e => e.target.files?.[0] && setLoadedFile(e.target.files[0])}
                />
              </label>
            </div>
          )}

          {loadedFile && (
            <PdfCanvas
              pdfFile={loadedFile}
              scale={scale}
              onPageCount={setPageCount}
              onPageWarning={handlePageWarning}
            >
              {(pageIdx) => <FieldLayer pageIdx={pageIdx} />}
            </PdfCanvas>
          )}
        </div>

        <div className="pfe-sidebar pfe-sidebar--right">
          <PropsPanel />
          <AiChatPanel />
        </div>
      </div>
    </EditorProvider>
  )
}
```

---

### `/packages/pdf-form-editor/src/index.ts`

```typescript
// Public API surface of @formpdf/editor
export { PdfFormEditor } from './components/PdfFormEditor'
export { PdfCanvas } from './components/PdfCanvas'
export { FieldLayer } from './components/FieldLayer'
export { FieldItem } from './components/FieldItem'
export { FieldPalette } from './components/FieldPalette'
export { PropsPanel } from './components/PropsPanel'
export { AiChatPanel } from './components/AiChatPanel'
export { EditorProvider, useEditorContext } from './context/EditorContext'
export { useFieldStore } from './store/useFieldStore'
export { useFormExport } from './hooks/useFormExport'
export { useAiDetection } from './hooks/useAiDetection'
export type { Field, FieldState, FormSchema, TextOverlay } from './store/types'
export type { PdfFormEditorProps } from './components/PdfFormEditor'
```

---

### `/packages/pdf-form-editor/src/styles/editor.css`

Create a base stylesheet with CSS variables. Do not use a CSS framework.

```css
:root {
  --pfe-bg: #f4f4f5;
  --pfe-sidebar-bg: #ffffff;
  --pfe-border: #e4e4e7;
  --pfe-accent: #2563eb;
  --pfe-accent-hover: #1d4ed8;
  --pfe-text: #18181b;
  --pfe-text-muted: #71717a;
  --pfe-field-text: rgba(37, 99, 235, 0.15);
  --pfe-field-signature: rgba(16, 185, 129, 0.15);
  --pfe-field-initials: rgba(245, 158, 11, 0.15);
  --pfe-field-date: rgba(139, 92, 246, 0.15);
  --pfe-field-checkbox: rgba(239, 68, 68, 0.15);
  --pfe-field-dropdown: rgba(14, 165, 233, 0.15);
}

.pfe-root {
  display: flex;
  height: 100vh;
  width: 100%;
  background: var(--pfe-bg);
  font-family: system-ui, sans-serif;
  font-size: 13px;
  color: var(--pfe-text);
}

.pfe-sidebar {
  width: 220px;
  flex-shrink: 0;
  background: var(--pfe-sidebar-bg);
  border-right: 1px solid var(--pfe-border);
  overflow-y: auto;
  padding: 12px;
}

.pfe-sidebar--right {
  border-right: none;
  border-left: 1px solid var(--pfe-border);
}

.pfe-canvas-area {
  flex: 1;
  overflow-y: auto;
  padding: 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.pdf-page-wrapper {
  position: relative;
  box-shadow: 0 2px 12px rgba(0,0,0,0.12);
  background: white;
}

.field-layer {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  pointer-events: none;
}

/* pointer-events: all on individual fields so they are interactive */
.form-field {
  position: absolute;
  pointer-events: all;
  cursor: move;
  border: 1.5px solid var(--pfe-accent);
  border-radius: 3px;
  display: flex;
  align-items: flex-start;
  padding: 2px 4px;
  box-sizing: border-box;
  user-select: none;
}

.form-field--text      { background: var(--pfe-field-text); }
.form-field--signature { background: var(--pfe-field-signature); }
.form-field--initials  { background: var(--pfe-field-initials); }
.form-field--date      { background: var(--pfe-field-date); }
.form-field--checkbox  { background: var(--pfe-field-checkbox); }
.form-field--dropdown  { background: var(--pfe-field-dropdown); }

.form-field--selected {
  outline: 2px solid var(--pfe-accent);
  outline-offset: 2px;
  z-index: 10;
}

.form-field--ai-pending {
  border-style: dashed;
  border-color: #f59e0b;
}

.form-field__label {
  font-size: 9px;
  color: var(--pfe-text-muted);
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.form-field__ai-controls {
  position: absolute;
  top: -22px;
  right: 0;
  display: flex;
  gap: 2px;
  background: white;
  border: 1px solid var(--pfe-border);
  border-radius: 4px;
  padding: 2px;
}

.form-field__ai-controls button {
  font-size: 11px;
  padding: 1px 5px;
  border: none;
  border-radius: 3px;
  cursor: pointer;
}

.pfe-warning-banner {
  background: #fef3c7;
  border: 1px solid #fbbf24;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #92400e;
  width: 100%;
  max-width: 800px;
}

.pfe-drop-zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  border: 2px dashed var(--pfe-border);
  border-radius: 12px;
  padding: 60px 40px;
  width: 100%;
  max-width: 600px;
  color: var(--pfe-text-muted);
}

.props-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.props-panel h3 { font-size: 12px; font-weight: 600; margin: 0; }
.props-panel h4 { font-size: 11px; font-weight: 600; margin: 8px 0 4px; }

.props-panel label {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 11px;
  color: var(--pfe-text-muted);
}

.props-panel input,
.props-panel select {
  border: 1px solid var(--pfe-border);
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
  color: var(--pfe-text);
  outline: none;
}

.props-panel input:focus,
.props-panel select:focus {
  border-color: var(--pfe-accent);
}

.props-panel__checkbox {
  flex-direction: row !important;
  align-items: center;
}

.props-panel__coords {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
}
```

---

### `/apps/web/package.json`

```json
{
  "name": "@formpdf/web",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "typecheck": "tsc --noEmit",
    "postinstall": "cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/"
  },
  "dependencies": {
    "@formpdf/editor": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.0",
    "typescript": "^5.6.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "vite": "^6.0.0"
  }
}
```

---

### `/apps/web/vite.config.ts`

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    // pdfjs-dist 4.x uses top-level await which Vite needs to handle
    exclude: ['pdfjs-dist'],
  },
})
```

---

### `/apps/web/src/App.tsx`

```typescript
import React, { useState } from 'react'
import { PdfFormEditor } from '@formpdf/editor'

export default function App() {
  return (
    <PdfFormEditor
      aiProxyUrl="/api/pdf-detect"
      onExport={(schema) => {
        console.log('[FormPDF] Schema exported:', schema)
      }}
      onSave={(bytes) => {
        console.log('[FormPDF] PDF bytes ready, length:', bytes.length)
      }}
    />
  )
}
```

---

### `/apps/web/src/main.tsx`

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

---

### `/apps/web/index.html`

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>FormPDF</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

## STUB FILES — implement with throw stubs, not empty

These files must exist with typed exports and `throw new Error('Not yet implemented: ...')` bodies. Do not leave them empty.

- `packages/pdf-form-editor/src/components/FieldPalette.tsx` — Exports `FieldPalette` component that renders a list of draggable field type chips
- `packages/pdf-form-editor/src/components/AiChatPanel.tsx` — Exports `AiChatPanel` component with a textarea and message list
- `packages/pdf-form-editor/src/hooks/useAlignmentGuides.ts` — Exports `useAlignmentGuides` hook

---

## ADDITIONAL PACKAGES TO INSTALL

```bash
pnpm add nanoid --filter @formpdf/editor
```

---

## AFTER SCAFFOLDING — VERIFICATION CHECKLIST

Before declaring the scaffold complete, verify:

1. `pnpm install` succeeds from workspace root
2. `pnpm run build` in `packages/pdf-form-editor` produces `dist/index.mjs`, `dist/index.cjs`, `dist/index.d.ts`
3. `pnpm run dev` in `apps/web` starts a Vite dev server with no errors
4. `apps/web/public/pdf.worker.min.mjs` exists after install
5. TypeScript has no errors across all packages (`pnpm run typecheck`)
6. No package outside the dependency list has been added
7. Every file listed in the structure tree exists

---

## WHAT NOT TO DO

- Do not add Tailwind, styled-components, CSS Modules, or any other CSS system. Use plain CSS with the variables defined above.
- Do not add React Query, SWR, or any data fetching library. Use plain `fetch`.
- Do not add Next.js. This is a Vite app.
- Do not add Redux or Jotai. Use Zustand exactly as specified.
- Do not add `react-draggable` or `dnd-kit`. Use `interact.js` exactly as specified.
- Do not add `@types/interact.js`. interact.js ships its own types.
- Do not rename any files or directories.
- Do not change the `Field` interface to store screen pixels.
- Do not set `workerSrc` in `main.tsx`. It must be in `PdfCanvas.tsx`.
- Do not pass an API key as a prop to any component.

---

*FormPDF Architecture v2 — March 2026*

---

## PHASE 2 — AI DETECTION BACKEND (Hono Server)

**Status: Complete**
**Date: March 2026**

### What Was Added

A decoupled Hono server at `apps/server/` that provides the AI backend for field detection and chat.

### Architecture

```
┌──────────────┐     proxy /api/*     ┌──────────────┐     Anthropic API
│  Vite (5173) │ ──────────────────▶  │ Hono (3001)  │ ──────────────▶ Claude
│  apps/web    │                      │ apps/server   │
└──────────────┘                      └──────────────┘
```

- **Framework**: Hono (~14KB, TypeScript-first, runs on Node/Bun/Deno/Workers)
- **Vite proxies** `/api/*` to `http://localhost:3001` in dev
- **Single `pnpm run dev`** starts both servers in parallel
- **API key stays server-side** (reads `ANTHROPIC_API_KEY` from `apps/server/.env`)

### New Files

```
apps/server/
├── src/
│   ├── index.ts          # Hono app, CORS, routes, serve()
│   ├── handlers.ts       # Framework-agnostic detect + chat functions
│   └── prompts.ts        # System prompts for Claude vision + chat
├── .env.example          # Template for API key
├── package.json          # @formpdf/server
└── tsconfig.json
```

### Modified Files

- `apps/web/vite.config.ts` — added `server.proxy` for `/api` → port 3001
- `.gitignore` — added `.env`

### API Contract

**Detection** — `POST /api/pdf-detect`
```json
// Request
{ "imageBase64": "<jpeg-base64>", "pageIndex": 0 }

// Response
{ "fields": [{ "type": "text", "label": "Name", "x": 0.1, "y": 0.2, "w": 0.3, "h": 0.03, "required": true }] }
```
Coordinates are 0–1 relative, top-left origin. Frontend converts via `engine.relToScreen()` → `engine.screenToPdf()`.

**Chat** — `POST /api/pdf-detect`
```json
// Request
{ "message": "What fields does this form need?" }

// Response
{ "reply": "Based on the document..." }
```

**Health** — `GET /api/health`
```json
{ "status": "ok", "hasApiKey": true }
```

### Setup

```bash
cp apps/server/.env.example apps/server/.env
# Edit apps/server/.env and add your ANTHROPIC_API_KEY
pnpm run dev
```

### Dependencies Added

| Package | Location | Purpose |
|---------|----------|---------|
| `hono` | apps/server | HTTP framework |
| `@hono/node-server` | apps/server | Node.js adapter for Hono |
| `@anthropic-ai/sdk` | apps/server | Claude API client |
| `dotenv` | apps/server | Env var loading |
| `tsx` | apps/server (dev) | TypeScript execution + watch |
| `@types/node` | apps/server (dev) | Node.js type definitions |


## PHASE 3 — TESTING (Vitest)

**Status: Complete**
**Date: March 2026**

### What Was Added

Vitest test suite covering the three most critical layers: CoordEngine (coordinate math), HistoryStack (undo/redo), useFieldStore (state management), and server handlers (AI proxy).

### Test Structure

```
packages/pdf-form-editor/src/__tests__/
├── CoordEngine.test.ts    # Y-flip, round-trips, scale, clamp
├── history.test.ts        # Push, undo, redo, max entries, clear
└── useFieldStore.test.ts  # CRUD, selection, undo/redo integration

apps/server/src/__tests__/
└── handlers.test.ts       # Detection parsing, validation, chat, error cases
```

### Results

- **51 tests, all passing**
- Editor: 41 tests (CoordEngine: 17, History: 7, Store: 17)
- Server: 10 tests (Detection: 7, Chat: 3)

### Running Tests

```bash
pnpm run test           # All packages
pnpm run test --filter @formpdf/editor   # Editor only
pnpm run test --filter @formpdf/server   # Server only
```

---

## PHASE 4 — END-TO-END COMPLETENESS

**Status: Complete**
**Date: March 2026**

### What Was Added

Production-readiness features: schema round-tripping, error handling, and user feedback.

### New Components & Hooks

| File | Purpose |
|------|---------|
| `hooks/useSchemaImport.ts` | Import previously exported JSON schemas back into the editor |
| `components/ErrorBoundary.tsx` | React error boundary with recovery UI |
| `components/Toaster.tsx` | Toast notification system (`useToast` hook + `ToasterProvider`) |

### Schema Import
- `useSchemaImport()` hook: `importSchema(json)` and `importFile(file)`
- Validates schema version, field types, and coordinates
- Fields imported with PDF point coordinates (no conversion needed)
- Import button added to Toolbar

### Error Boundary
- Wraps entire `PdfFormEditor` component
- Custom `fallback` prop for library consumers

### Toast Notifications
- `useToast()` hook: `toast(message, 'success' | 'error' | 'info')`
- Auto-dismiss after 4s, click to dismiss
- Wired into export/import actions

### UI Polish (Phase 3.5)
- Instrument Serif display font for landing page headings
- Gradient logo mark, glass toolbar, noise texture, animated drop zone
- Spring animation on field selection
- Hero gradient orb, floating mockup, grain overlay

### Test Results: 55 tests, all passing (45 editor + 10 server)

---

## PHASE 5 — LIBRARY PACKAGING

**Status: Complete**
**Date: March 2026**

### What Was Added

npm-ready packaging for `@formpdf/editor` with proper metadata, documentation, and publish guard.

### Package Metadata
- `license`, `repository`, `homepage`, `keywords` fields
- `sideEffects: ["**/*.css"]` for tree-shaking
- `files: ["dist", "README.md", "CHANGELOG.md"]` — only publish dist output
- `prepublishOnly: "tsup"` — safety net, ensures build before publish

### Documentation
- `packages/pdf-form-editor/README.md` — full API docs (props, composable API, headless export, schema import, AI proxy contract, coordinate system)
- `packages/pdf-form-editor/CHANGELOG.md` — v0.1.0 release notes
- Root `README.md` — monorepo overview, architecture diagram, setup instructions

### Pack Verification
`pnpm pack --dry-run` confirms clean output: dist files, README, CHANGELOG, package.json. No source code leaking.

---

## PHASE 6 — CI/CD

**Status: Complete**
**Date: March 2026**

### What Was Added

GitHub Actions workflows for continuous integration and controlled npm releases.

### CI Pipeline (`.github/workflows/ci.yml`)
- Triggers on push/PR to `main`/`master`
- Concurrency: cancels in-progress runs for same ref
- Steps: install → build → typecheck → test → verify dist outputs
- Node 22, pnpm 10, `--frozen-lockfile`

### Publish Workflow (`.github/workflows/publish.yml`)
- Manual trigger (`workflow_dispatch`) with version bump selector (patch/minor/major)
- Full CI check before publish (build → typecheck → test)
- Publishes `@formpdf/editor` to npm with `--access public`
- Auto-commits version bump and git tags (`v0.x.x`)
- Requires `NPM_TOKEN` secret in repository settings

### Usage
```bash
# CI runs automatically on push/PR

# To publish:
# 1. Go to Actions → "Publish to npm" → Run workflow
# 2. Select version bump type
# 3. Workflow builds, tests, publishes, commits version, tags
```

---

## PHASE 7 — USER AUTH (Clerk) — IMPLEMENTED

**Status: Complete**

### What Was Built
- `@clerk/react` in `apps/web` — ClerkProvider wraps App, auto-detects `VITE_CLERK_PUBLISHABLE_KEY`
- `@clerk/backend` in `apps/server` — token verification middleware on all `/api/*` routes
- **Graceful degradation**: runs without auth when Clerk keys aren't configured (local dev)
- Auth middleware sets `userId`/`orgId` on Hono context, consumed by document routes
- `/api/health` and `/api/pdf-detect` allow unauthenticated access
- `/api/documents/*` requires auth when Clerk is configured

### Files
- `apps/web/src/main.tsx` — ClerkProvider wrapper (conditional)
- `apps/server/src/index.ts` — Auth middleware with `verifyToken`
- `apps/web/.env.example` — `VITE_CLERK_PUBLISHABLE_KEY`
- `apps/server/.env.example` — `CLERK_SECRET_KEY`

---

## PHASE 8 — DOCUMENT STORAGE (Drizzle + R2) — IMPLEMENTED

**Status: Complete**

### What Was Built
- **Drizzle ORM** with Postgres — `documents` table (id, orgId, createdBy, name, pdfKey, schema, fieldCount, timestamps)
- **Cloudflare R2** (S3-compatible) for PDF file storage with signed URLs
- **Document CRUD API** — full REST endpoints on `/api/documents`
- **Dashboard page** (`/dashboard`) — document list with cards, upload, delete
- **Auto-save hook** — `useAutoSave(docId)` saves every 30s when dirty + `sendBeacon` on tab close

### API Routes
```
POST   /api/documents              Upload PDF + create document
GET    /api/documents              List documents for org
GET    /api/documents/:id          Get document with schema
GET    /api/documents/:id/pdf-url  Get signed URL for original PDF
PUT    /api/documents/:id          Update schema (auto-save target)
DELETE /api/documents/:id          Delete document + storage
```

### Files
- `apps/server/src/db/schema.ts` — Drizzle schema
- `apps/server/src/db/client.ts` — Postgres connection (lazy singleton)
- `apps/server/src/lib/storage.ts` — R2 upload/download/delete
- `apps/server/src/routes/documents.ts` — Hono CRUD routes
- `apps/server/drizzle.config.ts` — Migration config
- `apps/web/src/DashboardPage.tsx` — Document management UI
- `apps/web/src/dashboard.css` — Dashboard styles
- `packages/pdf-form-editor/src/hooks/useAutoSave.ts` — Auto-save hook

### Setup
```bash
# Add to apps/server/.env:
DATABASE_URL=postgresql://user:pass@localhost:5432/formbase
R2_ENDPOINT=https://ACCOUNT.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=formbase-pdfs

# Run migrations:
cd apps/server && npx drizzle-kit push
```

---

## PHASE 9 — FIGMA BILATERAL SYNC — IMPLEMENTED

**Status: Complete (server + client)**

### What Was Built
- **Sync event types** — `SyncEvent` and `SyncEventPayload` in `packages/pdf-form-editor/src/sync/types.ts`
- **`useFieldSync` hook** — WebSocket client that connects to sync server, applies remote deltas (non-undoable), emits local changes
- **`apps/sync-server/`** — WebSocket server with Redis delta queuing
  - Room-based connections (`ws://localhost:3002/<docId>`)
  - Replays last 500 events on reconnect (24h TTL)
  - Graceful Redis failure (runs without persistence)
  - Port 3002, starts with `pnpm run dev`
- **`PdfFormEditorProps`** accepts `docId`, `syncServerUrl`, and `fetchFn`
- Remote changes don't pollute local undo stack (`undoable: false`)

### What's Left
- Figma plugin (`figma-plugin/code.ts`) — Y-flip at Figma boundary (spec preserved below)

### Props
```typescript
<PdfFormEditor
  docId="uuid"
  syncServerUrl="wss://sync.example"
  fetchFn={authFetch}    // custom fetch with auth headers
/>
```

---

## PHASE 10 — APP RESTRUCTURE & INFRASTRUCTURE

**Status: Complete**
**Date: March 2026**

### What Was Done

Major restructuring of `apps/web` from a flat hacky `pushState` router to proper React Router v7 with organized directories, plus Docker infrastructure and bug fixes.

### React Router Migration
- Replaced hand-rolled `pushState` router with **React Router v7** (`react-router-dom`)
- Proper nested layouts: `RootLayout` → `AuthLayout` (protected) → page routes
- Lazy-loaded route code-splitting (landing, editor, dashboard, sign-in all separate chunks)
- `<Link>` and `useNavigate()` instead of manual `window.history.pushState`

### File Structure (apps/web/src/)
```
src/
├── routes/
│   ├── root.tsx           # Root layout
│   ├── auth-layout.tsx    # Protected route (redirects to /sign-in)
│   ├── landing.tsx        # /
│   ├── sign-in.tsx        # /sign-in (Clerk or local fallback)
│   ├── dashboard.tsx      # /dashboard (auth-gated)
│   └── editor.tsx         # /editor?doc=<id>
├── lib/
│   ├── auth.ts            # hasClerk flag
│   ├── api.ts             # createAuthFetch helper
│   └── useAuthFetch.ts    # Hook: fetch with Clerk session token
├── styles/
│   ├── global.css
│   ├── landing.css
│   ├── dashboard.css
│   └── sign-in.css
├── router.tsx             # Route definitions
└── main.tsx               # Entry + ClerkProvider
```

### Auth-Aware API Calls
- `useAuthFetch()` hook — attaches Clerk Bearer token to all API requests
- Used by dashboard (list/upload/delete) and editor (auto-save)
- `PdfFormEditorProps.fetchFn` — pass custom fetch to the editor library for auto-save with auth
- Auto-save interval reduced from 30s to 15s, saves on unmount

### Document Round-Trip (Bug Fix)
- Editor route now fetches document + signed PDF URL when `?doc=<id>` is present
- Loads saved schema fields back into the store on open
- Full flow: upload → edit → auto-save → dashboard → reopen → fields restored

### PDF Thumbnails (Bug Fix)
- Dashboard cards render first page of PDF via pdfjs-dist canvas
- Server returns signed PDF URL in document list endpoint
- Thumbnail scales on hover with smooth transition

### Field Count (Bug Fix)
- Auto-save now uses `authFetch` so PUT requests succeed with auth
- Server correctly computes `fieldCount` from `schema.fields.length` on save

### Docker Compose
```yaml
# docker-compose.yml — all local infrastructure
services:
  postgres:   # Port 5432, user: formbase, pass: formbase
  redis:      # Port 6379
  minio:      # Port 9000 (S3 API), Port 9001 (web console)
```

### Database Scripts (apps/server)
- `pnpm db:push` — push schema to Postgres
- `pnpm db:generate` — generate migration files
- `pnpm db:migrate` — run migrations
- `pnpm db:studio` — visual DB browser

### MinIO (Local S3)
- S3-compatible storage for PDF files
- `forcePathStyle: true` in S3 client for MinIO compatibility
- Console at http://localhost:9001 (minioadmin/minioadmin)
- Bucket: `formbase-pdfs`

### Full Local Dev Command
```bash
docker compose up -d                        # Postgres + Redis + MinIO
cd apps/server && pnpm db:push && cd ../..  # Create tables
pnpm run dev                                # Starts 4 services
```

### Services Running
| Service | Port | Purpose |
|---------|------|---------|
| Vite | 5173 | Frontend (proxies /api → 3001) |
| Hono | 3001 | API server |
| Sync Server | 3002 | WebSocket (Figma sync) |
| Postgres | 5432 | Document metadata |
| Redis | 6379 | Sync event queue |
| MinIO | 9000/9001 | PDF file storage |

### Test Results: 55 tests, all passing

---

# Fieldset — Post-MVP Phases: Auth, Storage & Figma Sync (Original Spec)

> These phases are now implemented. The original spec is preserved below for reference.  
> They are documented here so architectural decisions are pre-made and the MVP
> is built with these phases in mind — not in a way that has to be torn apart later.
>
> **Nothing in Phases 1–6 should be designed to prevent these from working.**

---

## Table of Contents

1. [Phase 7 — User Auth](#phase-7--user-auth)
2. [Phase 8 — Document Storage](#phase-8--document-storage)
3. [Phase 9 — Figma Bilateral Sync](#phase-9--figma-bilateral-sync)
4. [How MVP Code Should Be Written to Accommodate These](#how-mvp-code-should-be-written-to-accommodate-these)
5. [Recommended Stack Additions](#recommended-stack-additions)
6. [What Not to Pre-optimize](#what-not-to-pre-optimize)

---

## Phase 7 — User Auth

### Decision: Use Clerk, not roll-your-own

Do not build auth from scratch. The problem space of PDF form editors has nothing to do with login flows, JWT rotation, password reset emails, or OAuth2 handshakes. Clerk handles all of it in ~20 lines.

More importantly, Clerk gives you an `orgId` and `userId` on every request with zero boilerplate. Document storage in Phase 8 keys everything off these two values.

```typescript
// apps/web/src/main.tsx — add ClerkProvider above everything
import { ClerkProvider } from '@clerk/nextjs'  // or @clerk/react if staying on Vite

ReactDOM.createRoot(document.getElementById('root')!).render(
  <ClerkProvider publishableKey={import.meta.env.VITE_CLERK_PUBLISHABLE_KEY}>
    <React.StrictMode>
      <App />
    </React.StrictMode>
  </ClerkProvider>
)
```

```typescript
// Every server route gets user identity for free
import { getAuth } from '@clerk/nextjs/server'

export async function POST(req: Request) {
  const { userId, orgId } = getAuth(req)
  if (!userId) return new Response('Unauthorized', { status: 401 })
  // ... rest of route
}
```

### What auth gates

| Feature | Gate |
|---|---|
| AI detection (`/api/pdf-detect`) | Must be authenticated — prevents API key abuse |
| Document save/load | Must be authenticated — documents are user-scoped |
| Figma sync room | Must be authenticated — room ID derived from `orgId + docId` |
| Schema export (JSON/PDF download) | Public — no auth required for the editor itself |

### Social login recommendation

Enable Google + GitHub only at launch. These cover 95% of the developer and designer audience. Email/password adds support burden for minimal gain.

### Teams model

Use Clerk Organizations from day one even if you don't expose the UI yet. It costs nothing to enable and retrofitting multi-user document ownership later without organizations is painful.

```
User → belongs to → Organization
Document → owned by → Organization (not individual User)
```

This means if someone leaves a company, their documents don't disappear.

---

## Phase 8 — Document Storage

### What needs to be stored

Three distinct things with different storage requirements:

```
┌─────────────────────────────────────────────────────────────┐
│  1. The original PDF file (binary, up to ~50MB)             │
│     Store: Object storage (S3 / Cloudflare R2)              │
│     Access: Signed URL, never public                        │
├─────────────────────────────────────────────────────────────┤
│  2. The form schema (FormSchema JSON, ~10KB)                 │
│     Store: Postgres (structured, queryable)                 │
│     Access: REST API, auth-gated                            │
├─────────────────────────────────────────────────────────────┤
│  3. The sync state (live field deltas during Figma sync)     │
│     Store: Redis (ephemeral, fast, evicts automatically)    │
│     Access: WebSocket server only                           │
└─────────────────────────────────────────────────────────────┘
```

### Database schema (Postgres via Drizzle ORM)

```typescript
// db/schema.ts
import { pgTable, text, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core'

export const documents = pgTable('documents', {
  id:          uuid('id').primaryKey().defaultRandom(),
  orgId:       text('org_id').notNull(),       // Clerk org ID
  createdBy:   text('created_by').notNull(),   // Clerk user ID
  name:        text('name').notNull(),
  pdfKey:      text('pdf_key').notNull(),      // S3/R2 object key
  schema:      jsonb('schema').notNull(),      // FormSchema (v2.0)
  createdAt:   timestamp('created_at').defaultNow().notNull(),
  updatedAt:   timestamp('updated_at').defaultNow().notNull(),
})

export type Document = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert
```

**Why Drizzle over Prisma:** Drizzle is type-safe without a code generation step, runs at the edge (Cloudflare Workers compatible), and the query builder maps cleanly to SQL. Prisma's generated client is too heavy for edge functions and the Prisma schema language is a non-standard DSL.

### File storage (Cloudflare R2 recommended over S3)

R2 has no egress fees. For a PDF editor where users repeatedly download large files, S3 egress costs become significant quickly. R2 is S3-compatible, so the AWS SDK works unchanged.

```typescript
// lib/storage.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,   // https://<account>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function uploadPdf(key: string, buffer: ArrayBuffer): Promise<void> {
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: 'application/pdf',
  }))
}

export async function getPdfSignedUrl(key: string): Promise<string> {
  // Signed URL expires in 1 hour — never expose the raw object URL
  return getSignedUrl(r2, new GetObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key: key,
  }), { expiresIn: 3600 })
}

export function makePdfKey(orgId: string, docId: string): string {
  // Namespace by org to make IAM policies easy if you ever shard buckets
  return `orgs/${orgId}/docs/${docId}/original.pdf`
}
```

### API routes to build in Phase 8

```
POST   /api/documents              Create document (upload PDF + schema)
GET    /api/documents              List documents for org
GET    /api/documents/:id          Get document schema
GET    /api/documents/:id/pdf-url  Get signed URL for original PDF
PUT    /api/documents/:id          Update schema
DELETE /api/documents/:id          Delete document + S3 object
```

### Auto-save pattern

The editor should auto-save the schema to the server every 30 seconds if dirty, and on `beforeunload`. Do not save on every field move — that's too noisy and will generate too many DB writes.

```typescript
// hooks/useAutoSave.ts — implement in Phase 8
const SAVE_INTERVAL_MS = 30_000

export function useAutoSave(docId: string) {
  const isDirty = useRef(false)

  // Mark dirty when fields change
  useFieldStore.subscribe(() => { isDirty.current = true })

  useEffect(() => {
    const interval = setInterval(() => {
      if (!isDirty.current) return
      const schema = useFieldStore.getState().exportJSON?.()  // wire up in Phase 8
      if (schema) {
        fetch(`/api/documents/${docId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ schema }),
        })
        isDirty.current = false
      }
    }, SAVE_INTERVAL_MS)

    const handleUnload = () => {
      if (isDirty.current) {
        // sendBeacon is the only reliable way to save on tab close
        const schema = useFieldStore.getState().exportJSON?.()
        if (schema) {
          navigator.sendBeacon(
            `/api/documents/${docId}`,
            JSON.stringify({ schema }),
          )
        }
      }
    }

    window.addEventListener('beforeunload', handleUnload)
    return () => {
      clearInterval(interval)
      window.removeEventListener('beforeunload', handleUnload)
    }
  }, [docId])
}
```

---

## Phase 9 — Figma Bilateral Sync

### The hard constraint you cannot engineer around

**Figma has no push/webhook API.** Changes in Figma only propagate when the plugin is actively open and running. If the designer closes the plugin tab in Figma, sync stops. There is no workaround for this — it is a Figma platform boundary.

What you can do: queue outbound deltas on the web side and replay them the next time the plugin connects. The designer sees "3 updates pending" when they re-open the plugin.

### Architecture

```
┌─────────────────────┐         ┌──────────────────────┐         ┌──────────────────────┐
│   Figma Canvas      │         │    Sync Server        │         │   Fieldset Editor    │
│                     │         │  (Node.js + ws)       │         │                      │
│  Plugin (must be    │◄───────►│                       │◄───────►│  useFieldSync() hook │
│  open to sync)      │  WS     │  Rooms keyed by       │  WS     │                      │
│                     │         │  orgId + docId        │         │  FieldStore (Zustand)│
│  Frames annotated   │         │                       │         │                      │
│  as [FormField]     │         │  Redis for delta      │         │  CoordEngine         │
│  with plugin data   │         │  queuing              │         │  (Y-flip on sync)    │
└─────────────────────┘         └──────────────────────┘         └──────────────────────┘
```

### Shared sync event type

Both sides speak the same event schema. All coordinates travel as PDF points (bottom-left origin). The Y-flip happens at the Figma boundary, not in transit.

```typescript
// packages/pdf-form-editor/src/sync/types.ts — create this in Phase 9

export type SyncEventPayload =
  | { type: 'field:move';   positionPt: { x: number; y: number; w: number; h: number } }
  | { type: 'field:resize'; positionPt: { x: number; y: number; w: number; h: number } }
  | { type: 'field:label';  label: string }
  | { type: 'field:required'; required: boolean }
  | { type: 'field:add';    field: import('../store/types').Field }
  | { type: 'field:delete' }
  | { type: 'text:edit';    textId: string; content: string }

export interface SyncEvent {
  docId:     string
  fieldId:   string
  origin:    'figma' | 'web'
  timestamp: number
  payload:   SyncEventPayload
}
```

### Sync server (100 lines of Node.js)

```typescript
// apps/sync-server/index.ts — new app in the monorepo, Phase 9
import { WebSocketServer, WebSocket } from 'ws'
import { createClient } from 'redis'
import type { SyncEvent } from '../../packages/pdf-form-editor/src/sync/types'

const wss = new WebSocketServer({ port: 3001 })
const redis = createClient({ url: process.env.REDIS_URL })
await redis.connect()

// rooms: docId → Set<WebSocket>
const rooms = new Map<string, Set<WebSocket>>()

wss.on('connection', (ws, req) => {
  const docId = new URL(req.url!, 'ws://localhost').pathname.slice(1)
  if (!docId) { ws.close(); return }

  if (!rooms.has(docId)) rooms.set(docId, new Set())
  rooms.get(docId)!.add(ws)

  // Replay any queued deltas from while this client was offline
  redis.lRange(`queue:${docId}`, 0, -1).then(queued => {
    queued.forEach(raw => ws.send(raw))
  })

  ws.on('message', async (raw) => {
    const event: SyncEvent = JSON.parse(raw.toString())

    // Broadcast to all OTHER clients in the room
    rooms.get(docId)?.forEach(client => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(raw.toString())
      }
    })

    // Queue the event for clients that are currently offline
    // Keep last 500 events per doc; older ones are irrelevant
    await redis.rPush(`queue:${docId}`, raw.toString())
    await redis.lTrim(`queue:${docId}`, -500, -1)
    await redis.expire(`queue:${docId}`, 60 * 60 * 24)  // 24 hour TTL
  })

  ws.on('close', () => {
    rooms.get(docId)?.delete(ws)
    if (rooms.get(docId)?.size === 0) rooms.delete(docId)
  })
})
```

### Web editor sync hook

```typescript
// packages/pdf-form-editor/src/hooks/useFieldSync.ts — Phase 9

export function useFieldSync(docId: string, syncServerUrl: string) {
  const wsRef = useRef<WebSocket | null>(null)
  const { updateField, addField, deleteField } = useFieldStore()
  const { engine } = useEditorContext()

  useEffect(() => {
    const ws = new WebSocket(`${syncServerUrl}/${docId}`)
    wsRef.current = ws

    ws.onmessage = (event) => {
      const delta: SyncEvent = JSON.parse(event.data)
      if (delta.origin === 'web') return  // Ignore own echoes

      // Remote changes are applied but NOT pushed to undo history
      // A designer moving a field in Figma should not pollute your local undo stack
      switch (delta.payload.type) {
        case 'field:move':
        case 'field:resize':
          updateField(delta.fieldId, {
            ptX: delta.payload.positionPt.x,
            ptY: delta.payload.positionPt.y,
            ptW: delta.payload.positionPt.w,
            ptH: delta.payload.positionPt.h,
          }, { undoable: false })
          break
        case 'field:label':
          updateField(delta.fieldId, { label: delta.payload.label }, { undoable: false })
          break
        case 'field:required':
          updateField(delta.fieldId, { required: delta.payload.required }, { undoable: false })
          break
        case 'field:add':
          addField(delta.payload.field)
          break
        case 'field:delete':
          deleteField(delta.fieldId)
          break
      }
    }

    return () => ws.close()
  }, [docId, syncServerUrl])

  // Call this whenever a local field change happens that should propagate to Figma
  const emit = useCallback((event: Omit<SyncEvent, 'origin'>) => {
    wsRef.current?.send(JSON.stringify({ ...event, origin: 'web' }))
  }, [])

  return { emit }
}
```

### Figma plugin (complete)

```typescript
// figma-plugin/code.ts — Phase 9
// The Y-flip happens HERE, at the Figma boundary.
// All coords in transit are PDF points (bottom-left). 
// Figma frames use top-left. We convert on entry and exit.

import type { SyncEvent, SyncEventPayload } from '../packages/pdf-form-editor/src/sync/types'

let ws: WebSocket | null = null
let currentDocId = ''
let pdfPageHeights: Record<number, number> = {}  // pageIdx → heightPt (needed for Y-flip)

figma.showUI(__html__, { width: 320, height: 480 })

figma.ui.onmessage = async (msg) => {

  if (msg.type === 'connect') {
    currentDocId = msg.docId
    pdfPageHeights = msg.pageHeights  // { 0: 792, 1: 792, ... }

    ws = new WebSocket(`${msg.syncServerUrl}/${msg.docId}`)

    ws.onmessage = (event) => {
      const delta: SyncEvent = JSON.parse(event.data)
      if (delta.origin === 'figma') return
      applyDeltaToFigma(delta)
    }

    ws.onopen = () => figma.notify('Connected to Fieldset sync')
    ws.onclose = () => figma.notify('Fieldset sync disconnected')
  }

  if (msg.type === 'import-schema') {
    // Initial load: create all frames from schema
    for (const field of msg.schema.fields) {
      createFieldFrame(field, msg.schema.pages)
    }
    figma.notify(`Imported ${msg.schema.fields.length} fields`)
  }
}

// Listen for changes made inside Figma and emit to sync server
figma.on('documentchange', (event) => {
  if (!ws || ws.readyState !== WebSocket.OPEN) return

  for (const change of event.documentChanges) {
    if (change.type !== 'PROPERTY_CHANGE') continue

    const node = figma.getNodeById(change.id)
    if (!node) continue

    const fieldId = node.getPluginData('fieldsetFieldId')
    if (!fieldId) continue

    const pageIdxStr = node.getPluginData('fieldsetPageIdx')
    const pageIdx = parseInt(pageIdxStr)
    const pageH = pdfPageHeights[pageIdx] ?? 792
    const frame = node as FrameNode

    // Y-flip: Figma top-left → PDF bottom-left
    const positionPt = {
      x: frame.x,
      y: pageH - frame.y - frame.height,  // ← THE Y-FLIP (Figma → PDF)
      w: frame.width,
      h: frame.height,
    }

    const payload: SyncEventPayload = { type: 'field:move', positionPt }

    ws.send(JSON.stringify({
      docId: currentDocId,
      fieldId,
      origin: 'figma',
      timestamp: Date.now(),
      payload,
    } satisfies SyncEvent))
  }
})

function applyDeltaToFigma(delta: SyncEvent) {
  const node = figma.currentPage.findOne(
    n => n.getPluginData('fieldsetFieldId') === delta.fieldId
  ) as FrameNode | null

  if (!node && delta.payload.type !== 'field:add') return

  const pageIdxStr = node?.getPluginData('fieldsetPageIdx') ?? '0'
  const pageIdx = parseInt(pageIdxStr)
  const pageH = pdfPageHeights[pageIdx] ?? 792

  switch (delta.payload.type) {
    case 'field:move':
    case 'field:resize': {
      const pt = delta.payload.positionPt
      node!.x = pt.x
      node!.y = pageH - pt.y - pt.h  // ← Y-FLIP (PDF → Figma)
      node!.resize(pt.w, pt.h)
      break
    }
    case 'field:label':
      node!.name = `[FormField] ${delta.payload.label}`
      const badge = node!.findOne(n => n.name === '__label') as TextNode | null
      if (badge) badge.characters = delta.payload.label
      break
    case 'field:delete':
      node!.remove()
      break
    case 'field:add':
      createFieldFrameFromField(delta.payload.field, pageH)
      break
  }
}

const TYPE_COLORS: Record<string, { r: number; g: number; b: number }> = {
  text:      { r: 0.15, g: 0.39, b: 0.92 },
  signature: { r: 0.06, g: 0.73, b: 0.51 },
  initials:  { r: 0.96, g: 0.62, b: 0.17 },
  date:      { r: 0.55, g: 0.36, b: 0.98 },
  checkbox:  { r: 0.94, g: 0.27, b: 0.27 },
  dropdown:  { r: 0.05, g: 0.65, b: 0.89 },
}

function createFieldFrameFromField(
  field: { id: string; type: string; label: string; pageIdx: number; ptX: number; ptY: number; ptW: number; ptH: number; required: boolean },
  pageH: number,
) {
  const frame = figma.createFrame()
  frame.name = `[FormField] ${field.label}`

  // Y-flip: PDF bottom-left → Figma top-left
  frame.x = field.ptX
  frame.y = pageH - field.ptY - field.ptH
  frame.resize(field.ptW, field.ptH)

  const color = TYPE_COLORS[field.type] ?? TYPE_COLORS.text
  frame.fills   = [{ type: 'SOLID', color, opacity: 0.08 }]
  frame.strokes = [{ type: 'SOLID', color }]
  frame.strokeWeight = 1.5
  frame.dashPattern  = [6, 4]
  frame.cornerRadius = 3
  frame.clipsContent = false

  // Label badge
  const labelNode = figma.createText()
  labelNode.name = '__label'
  labelNode.characters = field.label
  labelNode.fontSize = 9
  labelNode.fills = [{ type: 'SOLID', color }]
  labelNode.x = 4
  labelNode.y = 2
  frame.appendChild(labelNode)

  // Required badge
  if (field.required) {
    const req = figma.createText()
    req.name = '__required'
    req.characters = '✱ Required'
    req.fontSize = 8
    req.fills = [{ type: 'SOLID', color: { r: 0.9, g: 0.2, b: 0.2 } }]
    req.x = frame.width - 55
    req.y = 2
    frame.appendChild(req)
  }

  // Tag so we can find this frame later
  frame.setPluginData('fieldsetFieldId', field.id)
  frame.setPluginData('fieldsetPageIdx', String(field.pageIdx))

  figma.currentPage.appendChild(frame)
  return frame
}

function createFieldFrame(
  schemaField: { id: string; type: string; label: string; page: number; required: boolean; positionPt: { x: number; y: number; w: number; h: number } },
  pages: Array<{ page: number; heightPt: number }>,
) {
  const pageInfo = pages.find(p => p.page === schemaField.page)
  const pageH = pageInfo?.heightPt ?? 792
  const pageIdx = schemaField.page - 1

  createFieldFrameFromField({
    id: schemaField.id,
    type: schemaField.type,
    label: schemaField.label,
    pageIdx,
    ptX: schemaField.positionPt.x,
    ptY: schemaField.positionPt.y,
    ptW: schemaField.positionPt.w,
    ptH: schemaField.positionPt.h,
    required: schemaField.required,
  }, pageH)
}
```

---

## How MVP Code Should Be Written to Accommodate These

These are structural rules for Phases 1–6 that prevent Phase 7–9 from requiring rewrites.

### Rule 1 — Keep auth-injectable server routes

Every `/api/` route should be written with auth as an optional wrapper, not hardcoded anonymous access. This means when Clerk is added, you drop in `getAuth(req)` at the top without touching the rest of the route logic.

```typescript
// Good pattern — auth is additive, not structural
export async function POST(req: Request) {
  // Phase 7: uncomment when Clerk is added
  // const { userId } = getAuth(req)
  // if (!userId) return new Response('Unauthorized', { status: 401 })

  const { imageBase64, pageIndex } = await req.json()
  // ... detection logic unchanged
}
```

### Rule 2 — `PdfFormEditor` accepts an optional `docId` prop from day one

This prop does nothing in the MVP. In Phase 8 it becomes the key for auto-save and document loading. If it's not in the prop interface from day one, adding it later causes a breaking change to library consumers.

```typescript
interface PdfFormEditorProps {
  pdfUrl?: string
  pdfFile?: File
  aiProxyUrl: string
  docId?: string           // Phase 8: if provided, enables auto-save and load
  syncServerUrl?: string   // Phase 9: if provided, enables Figma bilateral sync
  onExport?: (schema: FormSchema) => void
  onSave?: (pdfBytes: Uint8Array) => void
}
```

### Rule 3 — Export function is accessible outside the component

`useFormExport()` is already a standalone hook. In Phase 8, the auto-save mechanism calls it from a store subscriber, outside the component tree. This will work as-is.

### Rule 4 — The sync server is a separate app in the monorepo

Do not colocate WebSocket handling inside the Next.js API routes or the Vite app. Create `apps/sync-server/` in Phase 9. This keeps it deployable independently (e.g., on Railway or Fly.io) and lets you scale it separately from the main API.

### Rule 5 — Document ID is a UUID from day one

Even in the MVP where nothing is persisted, use `crypto.randomUUID()` to generate a document ID when a PDF is loaded. Store it in React state. When Phase 8 arrives, this ID is simply persisted to the DB.

```typescript
// In PdfFormEditor.tsx
const [docId] = useState(() => props.docId ?? crypto.randomUUID())
```

---

## Recommended Stack Additions

| Phase | What | Why |
|---|---|---|
| 7 | Clerk | Auth without a 3-week detour |
| 8 | Drizzle ORM + Postgres (Neon or Supabase) | Type-safe, edge-compatible, free tier covers early users |
| 8 | Cloudflare R2 | S3-compatible, no egress fees |
| 9 | `ws` (Node.js WebSocket) | Minimal, well-maintained, no abstraction overhead |
| 9 | Redis (Upstash serverless) | Delta queuing, no persistent Redis server to manage |

### What not to add

- **Supabase Realtime** — tempting shortcut for sync, but it's Postgres LISTEN/NOTIFY under the hood, which adds latency and doesn't support the Figma plugin's disconnected-queue pattern cleanly.
- **Socket.io** — adds 60KB to the client bundle and the namespace/room abstraction fights with the simple per-doc room model above.
- **Firebase** — vendor lock-in on your most critical data layer for a developer tool is a bad trade.
- **PlanetScale** — removed free tier in 2024. Use Neon or Supabase instead.

---

## What Not to Pre-optimize

Some things sound like they need to be designed now. They don't.

**Conflict resolution in sync.** Last-write-wins is correct for a form editor where two people are unlikely to drag the same field simultaneously. Do not implement OT or CRDT for Phase 9. If it becomes a problem, add field-level locking (a user badge on the field that shows who has it selected).

**Offline mode.** Not worth building until you have users who request it. IndexedDB + service workers add significant complexity for a feature most enterprise users never need.

**PDF versioning.** Storing the original PDF + a schema per save is enough. Git-style history of the schema (every auto-save as a commit) sounds good but the query complexity is not worth it until users explicitly ask for "version history."

**Multi-region deployment.** Start with a single Postgres instance and a single sync server region. The Figma sync WebSocket connection is already latency-tolerant (it's not a game). Cross-region sync adds operational complexity with no user-visible benefit at early scale.

---

*Last updated: March 2026*  
*Status: Planned — do not begin until Phase 6 (library packaging) is complete*



# Fieldset — Server Architecture (Hono)

> This document replaces all Next.js API route patterns from the main architecture docs.
> The monorepo has three apps: `apps/web` (Vite + React), `apps/server` (Hono),
> and `apps/app` (if this is a separate client app — clarify and update accordingly).
> All backend logic lives in `apps/server`. The Hono server is the only thing
> that ever touches the Anthropic API key, database, or object storage.

---

## Monorepo Structure (Revised)

```
fieldset/
├── apps/
│   ├── web/                    # Vite + React — the editor UI
│   │   ├── src/
│   │   ├── public/
│   │   │   └── .gitkeep       # pdf.worker.min.mjs copied here by postinstall
│   │   ├── index.html
│   │   ├── vite.config.ts
│   │   └── package.json
│   │
│   ├── server/                 # Hono — all backend logic
│   │   ├── src/
│   │   │   ├── index.ts        # Hono app entry, route mounting
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts     # Clerk JWT verification middleware
│   │   │   │   └── cors.ts     # CORS for web app origin
│   │   │   ├── routes/
│   │   │   │   ├── detect.ts   # POST /api/pdf-detect — Anthropic proxy
│   │   │   │   ├── documents.ts # CRUD for saved documents (Phase 8)
│   │   │   │   └── sync.ts     # WebSocket upgrade for Figma sync (Phase 9)
│   │   │   ├── lib/
│   │   │   │   ├── anthropic.ts # Anthropic client wrapper
│   │   │   │   ├── storage.ts   # R2 / S3 wrapper (Phase 8)
│   │   │   │   └── db.ts        # Drizzle + Postgres client (Phase 8)
│   │   │   └── db/
│   │   │       └── schema.ts    # Drizzle schema (Phase 8)
│   │   └── package.json
│   │
│   └── app/                    # Clarify: is this a separate React Native app,
│                               # a different web client, or an alias for web/?
│                               # Update this section once confirmed.
│
├── packages/
│   └── pdf-form-editor/        # @fieldset/editor npm library
│
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

---

## `apps/server/package.json`

```json
{
  "name": "@fieldset/server",
  "private": true,
  "scripts": {
    "dev":       "tsx watch src/index.ts",
    "build":     "tsc",
    "start":     "node dist/index.js",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "hono":              "^4.6.0",
    "@hono/node-server": "^1.13.0",
    "@anthropic-ai/sdk": "^0.32.0",
    "@aws-sdk/client-s3":          "^3.0.0",
    "@aws-sdk/s3-request-presigner":"^3.0.0",
    "drizzle-orm":       "^0.36.0",
    "@neondatabase/serverless": "^0.10.0"
  },
  "devDependencies": {
    "typescript": "^5.6.0",
    "tsx":        "^4.19.0",
    "drizzle-kit":"^0.28.0"
  }
}
```

**Why `@hono/node-server`:** Hono is runtime-agnostic. The `@hono/node-server` adapter runs it on Node.js. If you later want to deploy to Cloudflare Workers, swap the adapter — the app code is unchanged.

---

## `apps/server/src/index.ts`

```typescript
import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { detectRoute } from './routes/detect'
import { documentsRoute } from './routes/documents'

const app = new Hono()

// CORS — allow requests from the web app
app.use('*', cors({
  origin: process.env.WEB_ORIGIN ?? 'http://localhost:5173',
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// Routes
app.route('/api/pdf-detect', detectRoute)
app.route('/api/documents',  documentsRoute)   // Phase 8

// Health check
app.get('/health', (c) => c.json({ ok: true }))

serve({
  fetch: app.fetch,
  port: parseInt(process.env.PORT ?? '3000'),
}, (info) => {
  console.log(`[fieldset/server] listening on http://localhost:${info.port}`)
})

export type AppType = typeof app
```

---

## `apps/server/src/routes/detect.ts`

The Anthropic proxy. This is the only file that knows the API key exists.

```typescript
import { Hono } from 'hono'
import Anthropic from '@anthropic-ai/sdk'

export const detectRoute = new Hono()

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,  // Server-side only — never in browser
})

const DETECTION_SYSTEM_PROMPT = `
You are a PDF form field detector. Analyze the page image and find ALL
blank areas where a user must fill in information.

Look for:
- Underlines after label text (Name: _______________)
- Blank rectangular boxes
- Dashed outlines
- Checkbox squares (□)
- Signature lines (long horizontal lines near "Signature:")
- Date placeholders (MM/DD/YYYY or similar)

Return ONLY valid JSON, no markdown, no explanation:
{
  "fields": [
    {
      "type": "text|signature|initials|date|checkbox|dropdown",
      "label": "inferred from nearest printed text label",
      "x": 0.0,
      "y": 0.0,
      "w": 0.0,
      "h": 0.0,
      "required": false
    }
  ]
}

Rules:
- Origin is top-left. x/y/w/h are decimal fractions of the page (0.0–1.0).
- x/y points to the blank INPUT area, NOT the printed label text.
- signature fields: h > 0.05, w > 0.3
- initials fields: roughly square, w < 0.15
- required: true only if marked with * or the word "required"
- Return empty fields array if no form fields found
`.trim()

detectRoute.post('/', async (c) => {
  // Phase 7: add auth check here
  // const user = c.get('user')
  // if (!user) return c.json({ error: 'Unauthorized' }, 401)

  let body: { imageBase64: string; pageIndex: number }

  try {
    body = await c.req.json()
  } catch {
    return c.json({ error: 'Invalid JSON body' }, 400)
  }

  if (!body.imageBase64) {
    return c.json({ error: 'imageBase64 is required' }, 400)
  }

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/jpeg',
              data: body.imageBase64,
            },
          },
          {
            type: 'text',
            text: DETECTION_SYSTEM_PROMPT,
          },
        ],
      }],
    })

    const text = response.content
      .filter(b => b.type === 'text')
      .map(b => (b as { type: 'text'; text: string }).text)
      .join('')

    let parsed: { fields: unknown[] }

    try {
      parsed = JSON.parse(text)
    } catch {
      console.error('[detect] Claude returned non-JSON:', text)
      return c.json({ fields: [] })
    }

    return c.json({ fields: parsed.fields ?? [] })

  } catch (e) {
    console.error('[detect] Anthropic API error:', e)
    return c.json({ error: 'Detection failed' }, 500)
  }
})
```

---

## `apps/server/src/middleware/auth.ts`

Stubbed now, activated in Phase 7 when Clerk is added.

```typescript
import type { MiddlewareHandler } from 'hono'

/**
 * Auth middleware — stub for Phase 7.
 *
 * Phase 7 implementation:
 *   import { createClerkClient } from '@clerk/backend'
 *   const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY })
 *
 *   export const authMiddleware: MiddlewareHandler = async (c, next) => {
 *     const token = c.req.header('Authorization')?.replace('Bearer ', '')
 *     if (!token) return c.json({ error: 'Unauthorized' }, 401)
 *     try {
 *       const payload = await clerk.verifyToken(token)
 *       c.set('userId', payload.sub)
 *       c.set('orgId', payload.org_id ?? null)
 *       await next()
 *     } catch {
 *       return c.json({ error: 'Invalid token' }, 401)
 *     }
 *   }
 *
 * Usage in routes:
 *   import { authMiddleware } from '../middleware/auth'
 *   detectRoute.use('*', authMiddleware)
 */

export const authMiddleware: MiddlewareHandler = async (_c, next) => {
  // Phase 7: replace this with real Clerk verification
  await next()
}
```

---

## `apps/server/src/routes/documents.ts` (Phase 8 stub)

```typescript
import { Hono } from 'hono'
// import { authMiddleware } from '../middleware/auth'
// import { db } from '../lib/db'
// import { documents } from '../db/schema'
// import { uploadPdf, getPdfSignedUrl, makePdfKey } from '../lib/storage'
// import { eq, and } from 'drizzle-orm'

export const documentsRoute = new Hono()

// Phase 7: enable auth
// documentsRoute.use('*', authMiddleware)

/**
 * Phase 8 routes:
 *
 * POST   /api/documents              — create document (multipart: pdf file + schema JSON)
 * GET    /api/documents              — list documents for org
 * GET    /api/documents/:id          — get document schema
 * GET    /api/documents/:id/pdf-url  — get signed URL (1hr expiry) for original PDF
 * PUT    /api/documents/:id          — update schema (auto-save)
 * DELETE /api/documents/:id          — delete document + R2 object
 */

documentsRoute.get('/', async (c) => {
  throw new Error('Not yet implemented: GET /api/documents — Phase 8')
})

documentsRoute.post('/', async (c) => {
  throw new Error('Not yet implemented: POST /api/documents — Phase 8')
})

documentsRoute.get('/:id', async (c) => {
  throw new Error('Not yet implemented: GET /api/documents/:id — Phase 8')
})

documentsRoute.get('/:id/pdf-url', async (c) => {
  throw new Error('Not yet implemented: GET /api/documents/:id/pdf-url — Phase 8')
})

documentsRoute.put('/:id', async (c) => {
  throw new Error('Not yet implemented: PUT /api/documents/:id — Phase 8')
})

documentsRoute.delete('/:id', async (c) => {
  throw new Error('Not yet implemented: DELETE /api/documents/:id — Phase 8')
})
```

---

## `apps/server/src/lib/anthropic.ts`

```typescript
import Anthropic from '@anthropic-ai/sdk'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('[fieldset/server] ANTHROPIC_API_KEY is not set. Add it to your .env file.')
}

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})
```

---

## `apps/server/src/lib/storage.ts` (Phase 8 stub)

```typescript
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Phase 8: Cloudflare R2 via S3-compatible API.
 * R2 has no egress fees — important for a PDF editor where users repeatedly
 * download large files. The AWS SDK works unchanged with R2.
 *
 * Required env vars (Phase 8):
 *   R2_ENDPOINT   = https://<account_id>.r2.cloudflarestorage.com
 *   R2_BUCKET     = fieldset-documents
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 */

function getR2Client(): S3Client {
  if (!process.env.R2_ENDPOINT) throw new Error('R2_ENDPOINT not set — Phase 8 only')
  return new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT,
    credentials: {
      accessKeyId:     process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

export function makePdfKey(orgId: string, docId: string): string {
  return `orgs/${orgId}/docs/${docId}/original.pdf`
}

export async function uploadPdf(key: string, buffer: ArrayBuffer): Promise<void> {
  await getR2Client().send(new PutObjectCommand({
    Bucket:      process.env.R2_BUCKET!,
    Key:         key,
    Body:        Buffer.from(buffer),
    ContentType: 'application/pdf',
  }))
}

export async function getPdfSignedUrl(key: string): Promise<string> {
  return getSignedUrl(
    getR2Client(),
    new GetObjectCommand({ Bucket: process.env.R2_BUCKET!, Key: key }),
    { expiresIn: 3600 },
  )
}

export async function deletePdf(key: string): Promise<void> {
  await getR2Client().send(new DeleteObjectCommand({
    Bucket: process.env.R2_BUCKET!,
    Key:    key,
  }))
}
```

---

## `apps/server/src/lib/db.ts` (Phase 8 stub)

```typescript
/**
 * Phase 8: Drizzle ORM with Neon (serverless Postgres).
 *
 * Why Drizzle over Prisma:
 * - No code generation step
 * - Runs at the edge (Cloudflare Workers compatible if you ever move there)
 * - Query builder maps directly to SQL — no magic
 * - Prisma's generated client is too heavy for edge deployment
 *
 * Why Neon:
 * - Serverless Postgres — no persistent connection pool to manage
 * - Free tier covers early users
 * - Branching for staging environments
 *
 * Required env vars (Phase 8):
 *   DATABASE_URL = postgres://...@...neon.tech/fieldset?sslmode=require
 */

export function getDb() {
  throw new Error('Not yet implemented: database client — Phase 8')
}
```

---

## `apps/server/src/db/schema.ts` (Phase 8)

```typescript
import { pgTable, text, jsonb, timestamp, uuid } from 'drizzle-orm/pg-core'
import type { FormSchema } from '@fieldset/editor'

export const documents = pgTable('documents', {
  id:        uuid('id').primaryKey().defaultRandom(),
  orgId:     text('org_id').notNull(),      // Clerk org ID — NOT userId
  createdBy: text('created_by').notNull(),  // Clerk user ID
  name:      text('name').notNull(),
  pdfKey:    text('pdf_key').notNull(),     // R2 object key
  schema:    jsonb('schema').$type<FormSchema>().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export type Document    = typeof documents.$inferSelect
export type NewDocument = typeof documents.$inferInsert

/**
 * Why orgId, not userId, as owner:
 * If a user leaves a team, documents must not disappear.
 * Documents belong to organizations. Users are members of organizations.
 * Clerk Organizations support this from day one at zero extra cost.
 */
```

---

## Environment Variables

### `apps/server/.env` (development)

```bash
# Required now (Phase 1–6)
ANTHROPIC_API_KEY=sk-ant-...
PORT=3000
WEB_ORIGIN=http://localhost:5173

# Required Phase 7 (auth)
CLERK_SECRET_KEY=sk_test_...
CLERK_PUBLISHABLE_KEY=pk_test_...

# Required Phase 8 (storage + database)
DATABASE_URL=postgres://...@...neon.tech/fieldset?sslmode=require
R2_ENDPOINT=https://<account_id>.r2.cloudflarestorage.com
R2_BUCKET=fieldset-documents
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...

# Required Phase 9 (sync)
REDIS_URL=redis://...
```

### `apps/web/.env` (development)

```bash
# The web app never holds API keys — only public config
VITE_SERVER_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...   # Phase 7 only — safe to expose (it's public)
```

---

## How the Web App Calls the Server

The `aiProxyUrl` prop in `PdfFormEditor` should point to the Hono server, not a same-origin API route (since web and server are separate apps).

```typescript
// apps/web/src/App.tsx
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? 'http://localhost:3000'

export default function App() {
  return (
    <PdfFormEditor
      aiProxyUrl={`${SERVER_URL}/api/pdf-detect`}
      onExport={(schema) => console.log(schema)}
    />
  )
}
```

In production, `VITE_SERVER_URL` points to your deployed Hono instance (e.g., `https://api.fieldset.dev`).

---

## Hono RPC (optional but worth knowing about)

Hono has a built-in RPC layer that generates a type-safe client from your route definitions — similar to tRPC but without the setup overhead. If you want type-safe calls from the web app to the server without writing fetch wrappers manually, add this in Phase 8 when the document routes are built.

```typescript
// apps/server/src/index.ts — export the type
export type AppType = typeof app

// apps/web/src/lib/api.ts — type-safe client
import { hc } from 'hono/client'
import type { AppType } from '@fieldset/server'  // if you expose the type

const api = hc<AppType>(import.meta.env.VITE_SERVER_URL)

// Now fully typed:
const res = await api.api.documents.$get()
const docs = await res.json()  // typed as Document[]
```

This is optional for Phase 1–6 but worth planning for — it eliminates an entire category of API contract drift between web and server.

---

## Deployment Targets

| App | Recommended target | Why |
|---|---|---|
| `apps/web` | Cloudflare Pages or Vercel | Static assets + CDN, free tier |
| `apps/server` | Railway or Fly.io | Persistent Node.js process, easy Hono deployment |
| Sync server (Phase 9) | Railway or Fly.io (separate service) | Needs persistent WebSocket connections — can't use serverless |
| Postgres (Phase 8) | Neon | Serverless Postgres, free tier, branches for staging |
| Redis (Phase 9) | Upstash | Serverless Redis, pay-per-request, no persistent server |
| R2 (Phase 8) | Cloudflare R2 | No egress fees |

**Why Railway for the Hono server and not Cloudflare Workers:**  
Cloudflare Workers don't support Node.js APIs (no `fs`, limited `net`). For Phase 9's WebSocket sync server, you need persistent connections, which Workers don't support. Railway runs Node.js directly — Hono works there out of the box with `@hono/node-server`. If you later want edge deployment for the AI proxy route specifically, you can split it off as a separate Worker — but that's a Phase 9+ optimization.

---

*Last updated: March 2026*