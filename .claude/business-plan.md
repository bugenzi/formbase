# Formbase Business Plan

## What We Are

An open-source PDF form editor + a headless SDK for programmatic PDF filling.

## Two Products

### 1. Editor (Free, Open Source)
- Upload PDF, visually place fields (text, signature, date, checkbox, dropdown, initials)
- AI-powered field detection (Claude vision)
- Export schema JSON (field positions, types, labels)
- Export filled PDF (AcroForm injection via pdf-lib)
- Runs in browser, React component, npm package: `@formbase/editor`

### 2. Headless Fill SDK (The Product)
- Pure function: PDF + schema + values → filled PDF
- No React, no browser — runs on Node, Bun, Deno, Lambda, edge
- npm package: `@formbase/sdk`

```ts
import { fillPdf } from '@formbase/sdk'

const filled = await fillPdf({
  pdf: readFileSync('./lease.pdf'),
  schema: readFileSync('./lease-schema.json'),
  values: {
    tenant_name: 'Jane Smith',
    monthly_rent: '$2,400',
    start_date: 'June 1, 2026',
  }
})

writeFileSync('./lease-jane.pdf', filled)
```

## User Journey

1. Developer finds `@formbase/editor` (open source, free)
2. Opens editor, uploads their PDF template
3. Drags fields onto it (or uses AI detection)
4. Exports schema JSON
5. Installs `@formbase/sdk` in their backend
6. Calls `fillPdf()` with schema + values for each document they need to generate
7. Done — no manual PDF work, no browser, runs at scale

## Who Pays

Any business generating repetitive documents from templates:

| Industry | Document | Volume |
|---|---|---|
| Real estate | Leases, disclosures, closing docs | Hundreds/month |
| HR | Offer letters, NDAs, onboarding packets | Per hire |
| Legal | Contracts, retainers, filings | Per client |
| Finance | Invoices, statements, tax forms | Thousands/month |
| Healthcare | Intake forms, consent forms | Per patient |
| Education | Transcripts, enrollment forms | Per student |

## Monetization (Future — Not Now)

### Option A: Server-side fill (enforceable)
- Free tier: local fill, watermarked output
- Paid tier: server-side fill via API, clean output, cannot be bypassed
- Pricing: $29/mo (1k fills), $99/mo (10k fills), enterprise (unlimited)
- Infra cost: ~$5-50/mo (one verify endpoint + Postgres)

### Option B: License key (zero infra)
- Sell npm access with license key (like AG Grid, Tailwind UI)
- No server needed, some piracy accepted
- Simpler, lower margin

### Option C: Open core (current plan)
- Everything open source and free
- Monetize later with hosted platform (dashboard, auth, storage, signing flow)
- Build community and trust first, monetize when there's traction

**Current decision: Option C — ship it free, prove it works, monetize later.**

## Iteration Plan

### Iteration 1 (NOW) — Core. No DB, no auth, no server.
- Editor works standalone in browser
- Place fields, export schema, export filled PDF
- Headless `fillPdf()` SDK — pure function, zero infra
- Everything local, everything free, everything works offline
- **Goal: someone can npm install both packages and go from PDF to filled output in 5 minutes**

### Iteration 2 — Auth + Storage
- Clerk auth (already built, just wire up)
- Postgres + S3 for saved documents
- Dashboard: list your templates, manage schemas
- Auto-save

### Iteration 3 — Hosted Platform
- Landing page with live playground (try the editor without installing)
- User accounts, API keys
- Usage metering, billing (Stripe)

### Iteration 4 — Signing Flow
- Public signing links (no auth for signers)
- Signing sessions (who signed what, when)
- Email delivery
- Webhooks on completion
- Audit trail

## What Exists Today

### Built & Working
- [x] PDF rendering (pdfjs-dist)
- [x] Field placement editor (React, interact.js, Zustand)
- [x] Coordinate engine (PDF points ↔ screen pixels ↔ relative)
- [x] AI field detection (Claude vision)
- [x] JSON schema export (FormSchema v2.0)
- [x] PDF export with AcroForm fields (pdf-lib)
- [x] pdfmake template export
- [x] Undo/redo (immer patches)
- [x] Schema import
- [x] Auth (Clerk, graceful degradation)
- [x] Storage (Postgres + S3/MinIO)
- [x] Auto-save
- [x] Figma sync (WebSocket + Redis)
- [x] Docker Compose local dev

### Needs to Be Built
- [ ] `name` field on Field type (stable developer key for value mapping)
- [ ] Headless `fillPdf()` function (no React, pure pdf-lib)
- [ ] Separate `@formbase/sdk` entry point (or package) — no React dependency
- [ ] Schema v2.1 with `name` field included in export
- [ ] Validation: required fields check, type coercion for values
- [ ] Checkbox value support (boolean → checked/unchecked)
- [ ] Dropdown options + value support
- [ ] Signature/initials as image buffer injection
- [ ] Tests for headless fill
- [ ] README / docs for SDK usage

### Nice to Have (Later)
- [ ] Flatten filled PDF (bake values, remove form fields)
- [ ] Batch fill (array of value objects → array of PDFs)
- [ ] CLI tool: `npx @formbase/fill --pdf lease.pdf --schema lease.json --values data.json`
- [ ] Hosted playground on landing page (upload PDF, try editor, no install)
- [ ] Signing flow (unique links, signer auth, completion webhooks)

## Architecture

```
@formbase/editor          (npm — React component, free, open source)
  └─ depends on pdf-lib, pdfjs-dist, zustand, interactjs, immer

@formbase/sdk             (npm — headless fill, free or paid)
  └─ depends on pdf-lib only (tiny, no React)

formbase.io               (hosted — landing page, playground, dashboard)
  └─ uses both packages internally
```

The SDK has ONE dependency (pdf-lib). That's it. No React, no browser APIs, no heavy bundles. Works anywhere JavaScript runs.

## Competition

| Competitor | Model | Our Angle |
|---|---|---|
| DocuSign | Enterprise SaaS, expensive | We're free + open source |
| PandaDoc | Full doc workflow, complex | We do one thing well (fill PDFs) |
| Documenso | Open-source signing | We're SDK-first, not platform-first |
| pdf-lib (raw) | Low-level library | We add visual editor + schema layer on top |
| Adobe Acrobat | Desktop app | We're code-first, automatable |

## Key Technical Decisions

1. **PDF points as source of truth** — not pixels, not percentages. Zoom-stable, export-correct.
2. **Schema is the bridge** — editor produces it, SDK consumes it. Two independent products connected by JSON.
3. **No server dependency for core flow** — editor works offline, SDK works offline. Server is optional.
4. **AI is a differentiator, not a dependency** — field detection is nice-to-have, manual placement always works.
