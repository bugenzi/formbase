# AGENTS.md

Facts for agents changing this repo. Paths below were read in the tree. If `README.md`, `packages/pdf-form-editor/README.md`, or `packages/pdf-form-editor/CHANGELOG.md` disagrees with those files, follow the source and update the docs in the same change.

## Project

Formbase is a React PDF form editor. The npm library is `@bugenzi/formpdf-editor` (`packages/pdf-form-editor/package.json`, version `0.1.0`). The private playground and marketing app is `@formpdf/web` (`apps/web`). The root package is private `formpdf-monorepo`.

`packages/pdf-form-editor/package.json` sets `"license": "MIT"`. There is no `LICENSE` file in the repo. The root `package.json` has no `license` field. `apps/web/index.html` and `apps/web/src/routes/landing.tsx` also say MIT.

No `.ts`, `.tsx`, or `.js` file reads `process.env`, an API key, `localStorage`, or `sessionStorage`. PDF editing, JSON export, and AcroForm export do not call a backend. AI code runs only when the caller passes `aiProxyUrl` (see [AI](#ai)).

The production hostname is not in the repo. `vercel.json` deploys `apps/web`: install with `pnpm install`, build `@bugenzi/formpdf-editor` then `@formpdf/web`, output directory `apps/web/dist`, and rewrite all routes to `index.html`.

## Layout

```text
package.json              # root scripts
pnpm-workspace.yaml       # apps/*, packages/*
pnpm-lock.yaml
tsconfig.base.json
.nvmrc                    # 22
vercel.json
.github/workflows/ci.yml
.github/workflows/release-package.yml
apps/web/                 # @formpdf/web
packages/pdf-form-editor/# @bugenzi/formpdf-editor
```

Editor modules under `packages/pdf-form-editor/src`:

| Path | Role |
| --- | --- |
| `index.ts` | Root public exports |
| `engine/CoordEngine.ts` | PDF points, screen pixels, relative coords |
| `store/types.ts` | `Field`, `TextOverlay`, `FieldState`, `FormSchema`, `FIELD_DEFAULTS` |
| `store/useFieldStore.ts` | Zustand field store |
| `store/history.ts` | Immer patch undo stack |
| `schema/formSchema.ts` | Build, validate, and parse schema `2.0` |
| `context/EditorContext.tsx` | One `CoordEngine` and `aiProxyUrl` per provider |
| `hooks/useFormExport.ts` | JSON, pdf-lib AcroForm, pdfmake |
| `hooks/useSchemaImport.ts` | Load a schema into the store |
| `hooks/useAiDetection.ts` | Optional proxy detection |
| `hooks/useAlignmentGuides.ts` | Snap to other fields while dragging |
| `components/` | Editor UI |
| `styles/editor.css` | Editor CSS |

Web app: `apps/web/src/main.tsx`, `router.tsx`, `routes/landing.tsx`, `routes/editor.tsx`, `routes/root.tsx`, `styles/global.css`, `styles/landing.css`. `styles/dashboard.css` (`.db`) and `styles/sign-in.css` (`.si`) are not imported by any TSX file. `router.tsx` registers `/` (landing), `/editor`, and a catch-all redirect to `/`.

## Toolchain and commands

pnpm workspace globs are `apps/*` and `packages/*` (`pnpm-workspace.yaml`). Lockfile is `pnpm-lock.yaml`. No `packageManager` field.

Node: `.nvmrc` is `22`. Root and `apps/web` set `"engines.node": "22.x"`. The editor package does not. `.github/workflows/ci.yml` uses Node 22 and pnpm 10. `.github/workflows/release-package.yml` uses Node `22.14.0` and pnpm 10.

Checked with Node v22.23.4 and pnpm 10.33.4:

| Command | What it runs | Result |
| --- | --- | --- |
| `pnpm install` | Workspace install. `apps/web` `postinstall` copies `pdfjs-dist/build/pdf.worker.min.mjs` to `apps/web/public/` (gitignored). | Exited 0. Warned `Ignored build scripts: esbuild@0.25.12, esbuild@0.27.4` and suggested `pnpm approve-builds`. |
| `pnpm dev` | `pnpm -r --parallel run dev` | Editor: `tsup --watch`. Web: `vite`. Vite printed `http://localhost:5173/`. `apps/web/vite.config.ts` does not set a port. `GET /`, `GET /editor`, and `GET /pdf.worker.min.mjs` returned 200. |
| `pnpm build` | `pnpm --filter @bugenzi/formpdf-editor run build`, then the web `build` | Exited 0. tsup wrote `packages/pdf-form-editor/dist/index.js`, `.cjs`, `.css`, `.d.ts`, and `dist/engine/index.*`. Vite wrote `apps/web/dist`. |
| `pnpm test` | `pnpm -r run test` | Exited 0. Only the editor defines `test` (`vitest run`): 5 files, 48 tests. `@formpdf/web` has no test script. |
| `pnpm typecheck` | `pnpm -r run typecheck` (`tsc --noEmit`) | Failed before `dist/` existed: `apps/web/src/routes/editor.tsx` could not resolve `@bugenzi/formpdf-editor`. Passed after `pnpm build`. |
| `pnpm lint` | No script in any `package.json` | Failed: `Command "lint" not found` (pnpm exit 254). No ESLint, Prettier, or Biome config file is in the repo. |

`pnpm build:editor` and `pnpm build:web` are the same package filters `pnpm build` runs. They were not invoked on their own.

`pnpm-workspace.yaml` `allowBuilds` keys are the letters `b`, `d`, `e`, `i`, `l`, `s`, `u`, not the package name `esbuild`. `.pnpmrc.json` lists `onlyBuiltDependencies` for `esbuild` and `@esbuild/linux-x64`. This repo does not document whether pnpm reads `.pnpmrc.json`. The install warning shows those esbuild scripts were not approved. `pnpm build` and `pnpm dev` still finished after that warning.

Editor scripts (`packages/pdf-form-editor/package.json`): `build` and `prepublishOnly` are `tsup`, `dev` is `tsup --watch`, `test` is `vitest run`, `test:watch` is `vitest`, `typecheck` is `tsc --noEmit`.

Web scripts: `dev` is `vite`, `build` is `vite build`, `typecheck` is `tsc --noEmit`, plus the worker `postinstall`.

`apps/web` depends on `@bugenzi/formpdf-editor` via `workspace:*`. Package `exports` point at `dist`, not `src`. A playground session that does not have `tsup --watch` or a fresh editor build keeps serving the previous `dist`.

CI (`.github/workflows/ci.yml`), on push and pull request to `main` or `master`:

- `editor-validate` when `packages/pdf-form-editor/**`, root `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.nvmrc`, `.npmrc`, `tsconfig.json`, `tsconfig.*`, or the CI workflow changes. Steps: `pnpm install --frozen-lockfile`, build, test, and typecheck the editor, then assert `dist/index.js`, `dist/index.cjs`, `dist/index.d.ts`, and `dist/index.css` exist.
- `web-validate` for those paths plus `apps/web/**` and `vercel.json`. Steps: frozen install, build the editor, typecheck the web app, build the web app.
- Root markdown that matches none of those globs does not select either job.

`pnpm install --frozen-lockfile` was not run in this check. `pnpm install` reported the lockfile already up to date.

## Editor architecture

### Fields and store

`Field` in `packages/pdf-form-editor/src/store/types.ts`:

- `type`: `'text' | 'signature' | 'initials' | 'date' | 'checkbox' | 'dropdown'`
- `pageIdx`: zero-based
- `ptX`, `ptY`, `ptW`, `ptH`: PDF user space. Origin is the bottom-left of that page. Y grows upward. Units are points. The field object does not store screen pixels.
- `label`, `required`, `assignee`, optional `aiPending`, `fontSize`, `fontColor`, `placeholder`

`FIELD_DEFAULTS` (points): text 180×24, signature 240×48, initials 60×40, date 100×24, checkbox 14×14, dropdown 160×24. Not re-exported from `src/index.ts`.

`useFieldStore` (`store/useFieldStore.ts`) is a Zustand store created once at module scope. `fields` and `textOverlays` are id-keyed records. `selectedType` is `'field' | 'text' | null`.

Actions: `addField`, `updateField`, `deleteField`, `addTextOverlay`, `updateTextOverlay`, `deleteTextOverlay`, `selectField`, `selectText`, `undo`, `redo`, `canUndo`, `canRedo`, `clearAll`, `getField`.

Undo is a module-level `new HistoryStack(100)` (`store/history.ts`). `history.ts` calls immer `enablePatches()` on import. The store records `produceWithPatches` results and applies `applyPatches` on undo/redo. `addField` and `updateField` take `{ undoable?: boolean }` and default to recording. Deletes always record. Selection does not. `clearAll` resets fields, overlays, selection, and calls `history.clear()`. A new push drops the redo tail (`HistoryStack.push`).

`EditorProvider` memoizes one `CoordEngine` and keeps the `aiProxyUrl` string. The field store and history stack are not created there. Two providers in one page share fields and undo, and each has its own engine.

`FieldLayer` selects `s.fields`, then filters `pageIdx` outside the selector. The comment in that file says filtering inside the selector allocates a new array every call and loops under React 18 `useSyncExternalStore`.

Palette clicks and keyboard adds use `crypto.randomUUID()` and place the field at the center of the page in PDF points: `(pdfWidthPt - ptW) / 2`, `(pdfHeightPt - ptH) / 2` (`FieldPalette.tsx`, `PdfFormEditor.tsx`). Drops on `FieldLayer` convert the pointer position with `screenToPdf` before `addField`. `useAiDetection` uses `nanoid`.

No file under `components/` calls `addTextOverlay`. Overlays can be imported and included in JSON. `exportToPdf` and the pdfmake builder iterate `fields` only.

`PropsPanel.tsx` writes `label`, `assignee`, `placeholder`, `fontSize`, `fontColor`, and `ptX`/`ptY`/`ptW`/`ptH` on the store. Typing uses `{ undoable: false }`; blur uses `{ undoable: true }`. Coordinate inputs show `Math.round` of the PDF-point values.

### CoordEngine

Implemented only in `packages/pdf-form-editor/src/engine/CoordEngine.ts`.

- PDF user space: bottom-left origin, Y up, points. Stored fields and pdf-lib rects.
- Screen space: top-left origin, Y down, CSS pixels. interact.js and `style.left` / `style.top`.
- Relative space: top-left origin, both axes 0–1. `relToScreen` does not flip Y.

```text
scaleX = canvasWidthPx / pdfWidthPt
scaleY = canvasHeightPx / pdfHeightPt

screenX = ptX * scaleX
screenY = (pdfHeightPt - ptY - ptH) * scaleY
screenW = ptW * scaleX
screenH = ptH * scaleY

ptX = screenX / scaleX
ptY = pdfHeightPt - (screenY / scaleY) - (screenH / scaleY)
ptW = screenW / scaleX
ptH = screenH / scaleY
```

`pdfToScreen` and `screenToPdf` return `null` when that page index is not registered. `clamp` fits a screen rect to the page, or returns the input unchanged when the page is missing.

`registerPage` stores pdf.js `rotation`. When it is not `0`, `pdfToScreen` logs a warning and still uses the formula above. The comment in `CoordEngine.ts` says only 0° is supported. `PdfCanvas.tsx` calls `onPageWarning` with the same limitation and still renders with `page.getViewport({ scale: scale * devicePixelRatio, rotation: page.rotate })`.

After a page render, `PdfCanvas` registers `engine.registerPage(pageIdx, cssW / scale, cssH / scale, cssW, cssH, page.rotate)`, where CSS size is the viewport divided by `devicePixelRatio`. Field overlays are `createPortal`'d into that page's `.pdf-page-wrapper` (`data-page`), not into the scroll parent.

`FieldItem.tsx` places the node from `pdfToScreen`. Drag and resize update a ref and the DOM rect on move, and call `updateField` only on end. Drag end runs `clamp`, then `screenToPdf`, and stores `ptX`/`ptY`. Resize end runs `screenToPdf` and stores `ptX`/`ptY`/`ptW`/`ptH` without `clamp`. The effect calls `interactable.unset()` on cleanup. Minimum resize is 20×12 CSS pixels. The effect depends on `field.id` and `field.pageIdx`, not on the point values.

`useAlignmentGuides.ts` snaps to other fields on the same page within 6 CSS pixels (left/right/center and top/bottom/center) and appends `.alignment-guide` elements. There is no grid. `CHANGELOG.md` says "snap-to-grid"; this hook does not implement one.

### JSON schema

`buildFormSchema` (`schema/formSchema.ts`) returns `version: '2.0'`. Schema `page` is `pageIdx + 1`. `positionPt` is `{ x: ptX, y: ptY, w: ptW, h: ptH }`. `positionRel` is top-left:

```text
x = ptX / pageWidthPt
y = (pageHeightPt - ptY - ptH) / pageHeightPt
w = ptW / pageWidthPt
h = ptH / pageHeightPt
```

If the engine has no registration for that page, the divisors fall back to `1`.

`validateFormSchema` requires `version === '2.0'`, `fields` and `pages` arrays, and `textOverlays` either absent or an array. It does not validate each field.

`parseFormSchema` reads `positionPt` only. It does not read `positionRel`. It skips types outside `FIELD_DEFAULTS`, non-numeric rects, and `page < 1`. Defaults: `fontSize` 12, `fontColor` `#000000`, `placeholder` `''`, overlay `fontFamily` `Helvetica`.

`useSchemaImport` calls `useEditorContext`, so it throws outside `EditorProvider` (`void engine` — the engine is unused). `importFile` parses JSON, runs `validateFormSchema`, then `importSchema`. `clearExisting: true` calls `clearAll()` first. Each imported field and overlay is a separate `addField` / `addTextOverlay` history entry.

### PDF and pdfmake export

`useFormExport` (`hooks/useFormExport.ts`) also calls `useEditorContext` and throws outside `EditorProvider`.

- `exportJSON()` passes store fields, text overlays, and `engine.pages` to `buildFormSchema`.
- `exportToPdf(file)` loads the file with pdf-lib and returns `null` when `PDFDocument.load` throws. The `catch` logs a specific message when `error.message` includes `'encrypted'`. If an existing AcroForm field's `/FT` is `/Sig`, it `console.warn`s and still exports. The rect is `{ x: ptX, y: ptY, width: ptW, height: ptH }`. The field name is `label` or `id`.

| `Field.type` | Call in `exportToPdf` |
| --- | --- |
| `text`, `date` | `form.createTextField`, `setFontSize`, and `setText(placeholder)` when placeholder is set |
| `signature`, `initials` | `form.createTextField` and `setFontSize`. Not a signature field. |
| `checkbox` | `form.createCheckBox` |
| `dropdown` | `form.createDropdown` and `setFontSize`. No options are added. |

The hook parses `fontColor` into `rgb(...)` and then discards it (`void color`). It does not write `required` or `assignee` onto the widget, and it does not draw text overlays. A comment in the same file says pdf-lib cannot create digital signatures and mentions blank signature widgets; the `switch` never creates one.

- `downloadJson` and `downloadPdf` use `file-saver` `saveAs`.
- `exportToPdfMakeDefinition` / `exportPdfMakeDocDef` build a new pdfmake `TDocumentDefinitions` from field boxes. They do not embed the original PDF. `downloadPdfMake` uses `pdfMake.createPdf(docDef).download`. `downloadPdfMakeJson` saves that definition. Imports are `pdfmake/build/pdfmake` and `pdfmake/build/vfs_fonts`.

`PdfFormEditor.tsx` wires toolbar actions to `downloadJson`, `downloadPdf`, `downloadPdfMake`, `downloadPdfMakeJson`, and `importFile`. Button labels in `Toolbar.tsx`: Import, JSON, Export PDF, Template, pdfmake.

`PdfFormEditorProps` includes optional `onExport` and `onSave`. `EditorInner` destructures both and never calls them. `apps/web/src/routes/editor.tsx` passes both. `tsconfig.base.json` does not set `noUnusedLocals` or `noUnusedParameters`, and `pnpm typecheck` succeeded with those unused bindings after the package was built.

The web production build in this session emitted an editor route chunk of about 2.8 MB (`apps/web` `vite build`). `useFormExport.ts` imports pdfmake into the editor bundle.

### Public API

`src/index.ts` exports:

- `PdfFormEditor`, `PdfCanvas`, `FieldLayer`, `FieldItem`, `FieldPalette`, `PropsPanel`, `AiChatPanel`, `Toolbar`, `ErrorBoundary`
- `ToasterProvider`, `useToast`
- `EditorProvider`, `useEditorContext`
- `useFieldStore`, `useFormExport`, `useSchemaImport`, `useAiDetection`
- types `Field`, `FieldState`, `FormSchema`, `TextOverlay`, `PdfFormEditorProps`

`packages/pdf-form-editor/package.json` `exports`:

- `.` → `dist/index.js` (import), `dist/index.cjs` (require), `dist/index.d.ts`
- `./styles.css` → `dist/index.css`
- `./engine` → `dist/engine/index.js`, `.cjs`, `.d.ts`

`tsup.config.ts` entries are `src/index.ts` and `src/engine/CoordEngine.ts` (`engine/index`). Formats are ESM and CJS, `dts: true`, `react` and `react-dom` are external. `injectStyle` is not set. `PdfFormEditor.tsx` imports `../styles/editor.css`, and tsup emits `dist/index.css`. `"sideEffects"` is `["**/*.css"]`. The web editor route imports `@bugenzi/formpdf-editor/styles.css` separately.

`./engine` exports the `CoordEngine` class and types `PageRegistration`, `PdfRect`, `ScreenRect` (`dist/engine/index.d.ts`). The class is not in the root export list. `useEditorContext()` returns `{ engine: CoordEngine, aiProxyUrl: string }`, and `dist/index.d.ts` imports the `CoordEngine` type from `./engine/index.js`.

Not exported from `src/index.ts`: `FIELD_DEFAULTS`, `buildFormSchema`, `parseFormSchema`, `validateFormSchema`, `HistoryStack`, `useAlignmentGuides`.

Peers: `react` and `react-dom` `>=18`. Runtime dependencies include `pdfjs-dist`, `pdf-lib`, `zustand`, `immer`, `interactjs`, `nanoid`, `file-saver`, `pdfmake`, and `@types/pdfmake`.

`PdfCanvas.tsx` sets `pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'` in the same module as `getDocument`. The editor package has no copy step. `apps/web` `postinstall` copies the worker into `public/`. `getDocument` receives a `Uint8Array` plus `enableXfa: false`, `stopAtErrors: true`, and `isEvalSupported: false`.

`PdfFormEditor` (`components/PdfFormEditor.tsx`) renders `ErrorBoundary` > `EditorProvider` (`aiProxyUrl ?? ''`) > `ToasterProvider` > palette, toolbar, canvas, inspector, and `AiChatPanel`. It accepts `pdfUrl` or `pdfFile`. A missing file shows a drop target that accepts `application/pdf`. Palette drag data type is `application/x-formpdf-field-type`.

Keyboard handling in `PdfFormEditor.tsx`:

- `Ctrl/Cmd+Z` undo, `Ctrl/Cmd+Shift+Z` redo, `Ctrl/Cmd+D` duplicate (`ptX + 10`, `ptY - 10`, label plus `' copy'`). These run even when the target is an input, textarea, or select.
- Otherwise, if the target is one of those controls, the handler returns.
- `Delete` or `Backspace` deletes the selection. `Escape` calls `selectField(null)`.
- With a file loaded and no Ctrl/Cmd: `t` text, `s` signature, `i` initials, `d` date, `c` checkbox, `l` dropdown.

`Toolbar.tsx` zoom steps: `0.5`, `0.75`, `1`, `1.25`, `1.5`, `2`.

### AI

`useAiDetection` is exported from `src/index.ts` and is not imported by `PdfFormEditor` or any other component. It throws, via `assertAiProxyConfigured`, when `aiProxyUrl.trim()` is empty. It POSTs `{ imageBase64, pageIndex }` (JPEG from the page canvas) and reads `data.fields` as `{ type, label, x, y, w, h, required }` in 0–1 top-left fractions. Placement is `relToScreen`, then `screenToPdf`, then `addField` with `aiPending: true`. `detectAll` batches pages by 3. No proxy route or server exists in this repo.

`AiChatPanel.tsx` is mounted by `PdfFormEditor`. With an empty `aiProxyUrl` the input stays disabled. Send POSTs `{ message }` and displays `data.reply ?? data.message`.

`apps/web/src/routes/landing.tsx` marks AI assistance and headless fill as planned. The only `fillPdf(` text in the repo is inside those landing examples, next to the comment `Planned API example — not shipped yet`. There is no `fillPdf` function or export.

`FieldItem` shows confirm/discard controls when `field.aiPending` is set. Confirm calls `updateField(id, { aiPending: false })`. Discard calls `deleteField`.

## Web app

`apps/web/src/routes/editor.tsx` imports `PdfFormEditor` from `@bugenzi/formpdf-editor` and the package stylesheet. It does not import `CoordEngine`, `useFormExport`, or `useFieldStore`.

`src/main.tsx` renders `RouterProvider` and `@vercel/analytics/react`. `src/routes/root.tsx` is only `<Outlet />`. `vite.config.ts` uses `@vitejs/plugin-react` and sets `optimizeDeps.exclude` to `['pdfjs-dist']` (the comment says pdfjs-dist 4.x uses top-level await).

## Conventions

`tsconfig.base.json`: `target` ES2020, `module` ESNext, `moduleResolution` bundler, `jsx` react-jsx, `strict`, `skipLibCheck`, `declaration`, `declarationMap`, `sourceMap`, `esModuleInterop`, `allowSyntheticDefaultImports`. Editor `tsconfig.json` sets `rootDir` to `src`. Web `tsconfig.json` adds `"types": ["vite/client"]`. No path aliases.

The editor package is `"type": "module"`. Component files are PascalCase, hooks are `use*`, tests are `*.test.ts`. Existing TypeScript uses 2-space indentation, single quotes, and no semicolons. No EditorConfig, Prettier, ESLint, or Biome file enforces that.

Styles are global CSS. A search of `package.json`, TS, TSX, CSS, YAML, and Markdown found no Tailwind, CSS modules, or styled-components usage. Editor tokens are `--pfe-*` in `styles/editor.css`. Class names used by editor components include `pfe-`, `form-field`, `field-layer`, `field-palette`, `props-panel`, `ai-chat-panel`, `alignment-guide`, `pdf-page-wrapper`, and `pdf-canvas-container`. The package README says classes are only `pfe-` or `form-field`; that list is shorter than the source. Landing styles use the `lp-` prefix in `apps/web/src/styles/landing.css`. `global.css` is imported from `main.tsx` and loads DM Sans, Instrument Serif, and JetBrains Mono from Google Fonts. `editor.css` sets `--pfe-font` to the same family names and does not load the font files itself.

## Tests

Vitest `^4.1.0` on the editor. No `vitest.config.*`. No jsdom dependency. No coverage script. `pnpm test` does not start a browser.

| File | What the file imports and asserts |
| --- | --- |
| `src/__tests__/CoordEngine.test.ts` | `CoordEngine`: scale, Y-flip, round-trip, `relToScreen` without a Y-flip, `clamp` |
| `src/__tests__/history.test.ts` | `HistoryStack` constructed with max 5: undo, redo, dropped redo tail, max length, `clear` |
| `src/__tests__/useFieldStore.test.ts` | Add/update/delete, selection, undo/redo, `{ undoable: false }`, text-overlay add/delete, `clearAll` fields and selection |
| `src/schema/formSchema.test.ts` | `buildFormSchema`, `parseFormSchema`, `validateFormSchema`, `positionPt` / `positionRel`, overlay round-trip |
| `src/__tests__/useSchemaImport.test.ts` | Does not import `useSchemaImport`, `parseFormSchema`, or `validateFormSchema`. It calls `useFieldStore.getState().addField` itself. The header comment says the hook needs `EditorContext`. |

No test file imports `useFormExport`, `PdfCanvas`, or `PdfFormEditor`.

`CONTRIBUTING.md` asks for tests on behavior changes, and for docs and examples to stay aligned with public behavior.

## Release

Editor `publishConfig.access` is `"public"`. `files` is `dist`, `README.md`, `CHANGELOG.md`. `prepublishOnly` runs `tsup`. Repository directory is `packages/pdf-form-editor`.

`.github/workflows/release-package.yml` triggers on tags matching `editor-v*` and on `workflow_dispatch`. Permissions are `contents: read` and `id-token: write`. The file does not mention `NPM_TOKEN`. It installs with `--frozen-lockfile`, builds, tests, and typechecks `@bugenzi/formpdf-editor`, then runs `npm publish --access public` in `packages/pdf-form-editor` only when the event is `workflow_dispatch` or `github.ref_name` equals `editor-v` plus the `version` field. Any other tag sets `should_publish` false and reason `tag_does_not_match_package_version`.

The workflow comment and the root `README.md` describe a one-time local `npm publish --access public` and npm trusted-publisher settings (GitHub org `bugenzi`, repository `formbase`, workflow file `release-package.yml`). Those settings on npmjs.com were not queried.

`.github/dependabot.yml` schedules weekly npm updates for `/`, `/apps/web`, and `/packages/pdf-form-editor`, plus GitHub Actions.

## Do not break

- Store geometry only as PDF points on `ptX`, `ptY`, `ptW`, `ptH` (bottom-left, Y up). Derive screen pixels with `CoordEngine` at render time.
- Apply the Y-flip only in `pdfToScreen` and `screenToPdf`. Leave `relToScreen` and schema `positionRel.y` top-left. Keep import on `positionPt`.
- Schema `page` is 1-based. `Field.pageIdx` is 0-based.
- Treat `useFieldStore` and `HistoryStack` as process-wide singletons. Call `clearAll()` between store tests. Do not filter `fields` inside a Zustand selector (`FieldLayer.tsx`).
- `useFormExport` and `useSchemaImport` require `EditorProvider`.
- AcroForm placement uses the stored point rect. Signature and initials are text fields in `exportToPdf`. Font color, `required`, `assignee`, dropdown options, and text overlays are not written into that PDF.
- Non-zero pdf.js rotation is warned about and not converted. Do not treat it as supported without changing `CoordEngine` and its tests.
- `workerSrc` is the absolute path `/pdf.worker.min.mjs`. The web `postinstall` is what fills `apps/web/public/`. The editor package does not ship the worker.
- Do not require an API key or a backend for load, edit, JSON export, or AcroForm export. `aiProxyUrl` is optional and defaults to `''` in `PdfFormEditor`.
- Do not describe `useAiDetection` as part of the default editor UI. Nothing in `components/` calls it. Do not add or document `fillPdf` as an existing API. It is only sample text in `apps/web/src/routes/landing.tsx`.
- `onExport` and `onSave` are declared and unused. Calling them would be a behavior change.
- The web app typechecks and bundles `dist`. Build `@bugenzi/formpdf-editor` before `pnpm typecheck` on a clean tree.

## Before a PR

`CONTRIBUTING.md` and `.github/pull_request_template.md`:

- One change per PR. Do not mix refactors or formatting-only edits.
- Link an issue or explain the motivation. Non-trivial work should start from an issue or a short proposal.
- Run the tests, typecheck, and build for the area you changed. Build the editor before typechecking the web app.
- Add or update tests for behavior changes. Update the package README, and the landing or playground copy, when public behavior changes.
- UI changes: include a screenshot or recording.
- If code-generation tools were used, say so in the template and review the diff.
- Security reports go through `SECURITY.md`, not a public issue.

There is no lint command in this repo.
