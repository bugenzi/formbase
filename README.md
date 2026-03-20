# Formbase

Open-source PDF form editor for React. Drop fields onto any PDF, export AcroForm-ready documents, and build custom signing workflows.

## Packages

| Package | Description |
|---------|-------------|
| [`@formpdf/editor`](packages/pdf-form-editor) | Embeddable React component and composable API |
| [`@formpdf/web`](apps/web) | Demo app with landing page, dashboard, auth |
| [`@formpdf/server`](apps/server) | Hono API server (AI proxy, document CRUD, auth) |
| [`@formpdf/sync-server`](apps/sync-server) | WebSocket sync server (Figma bilateral sync) |

## Prerequisites

- Node.js 22+
- pnpm 10+
- Docker (for local Postgres, Redis, MinIO)

## Quick Start (local development)

```bash
# 1. Clone and install
git clone <repo-url> && cd formbase
pnpm install

# 2. Start infrastructure (Postgres, Redis, MinIO)
docker compose up -d

# 3. Create the MinIO storage bucket (first time only)
#    Open http://localhost:9001, login with minioadmin/minioadmin
#    Click "Create Bucket" → name it "formbase-pdfs"

# 4. Set up environment
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
#    Edit apps/server/.env — add your ANTHROPIC_API_KEY at minimum
#    The rest has working defaults for Docker

# 5. Push database schema
cd apps/server && pnpm db:push && cd ../..

# 6. Start everything
pnpm dev
```

Open `http://localhost:5173` — you're running.

### What each service does

| Service | Port | Purpose |
|---------|------|---------|
| **Vite** | 5173 | Frontend dev server (proxies `/api/*` to Hono) |
| **Hono** | 3001 | API server (AI, documents, auth) |
| **Sync server** | 3002 | WebSocket server for Figma sync |
| **Postgres** | 5432 | Document metadata + form schemas |
| **Redis** | 6379 | Sync event queue (offline replay) |
| **MinIO** | 9000 | S3-compatible PDF file storage |
| **MinIO Console** | 9001 | Web UI for managing buckets/files |

### Default credentials (Docker)

| Service | User | Password |
|---------|------|----------|
| Postgres | `formbase` | `formbase` |
| MinIO | `minioadmin` | `minioadmin` |
| Redis | — | no password |

### Environment variables

**`apps/server/.env`** — all services:

```bash
# Required for AI features
ANTHROPIC_API_KEY=sk-ant-...

# Auth (optional — works without for local dev)
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...

# Database (defaults work with Docker)
DATABASE_URL=postgresql://formbase:formbase@localhost:5432/formbase

# File storage (defaults work with Docker MinIO)
R2_ENDPOINT=http://localhost:9000
R2_ACCESS_KEY_ID=minioadmin
R2_SECRET_ACCESS_KEY=minioadmin
R2_BUCKET=formbase-pdfs

PORT=3001
```

**`apps/web/.env`** — frontend:

```bash
# Auth (optional — works without for local dev)
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### Feature availability by config

| Feature | Requires | Without it |
|---------|----------|------------|
| PDF editor | nothing | Always works |
| AI field detection | `ANTHROPIC_API_KEY` | Manual field placement only |
| Auth / sign-in | Clerk keys | Runs without auth |
| Document storage | `DATABASE_URL` + `R2_ENDPOINT` | No save/load, editor-only |
| Figma sync | Sync server + Redis | No real-time sync |

## Commands

```bash
pnpm dev              # Start all services (web + server + editor watcher)
pnpm build            # Build @formpdf/editor library
pnpm typecheck        # TypeScript check all packages
pnpm test             # Run all tests (55 tests)

# Database (from apps/server/)
pnpm db:push          # Push schema to database
pnpm db:generate      # Generate migration files
pnpm db:migrate       # Run migrations
pnpm db:studio        # Open Drizzle Studio (visual DB browser)

# Infrastructure
docker compose up -d  # Start Postgres + Redis + MinIO
docker compose down   # Stop all containers
```

## Using as a library

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
      aiProxyUrl="/api/pdf-detect"
      onSave={(pdfBytes) => upload(pdfBytes)}
    />
  )
}
```

See [`@formpdf/editor` README](packages/pdf-form-editor/README.md) for the full API.

## Routes (apps/web)

| Path | Auth | Description |
|------|------|-------------|
| `/` | Public | Landing page |
| `/sign-in` | Public | Clerk sign-in (or local dev fallback) |
| `/editor` | Public | PDF editor (manual field placement) |
| `/editor?doc=<id>` | Public | Editor with saved document (loads PDF + schema from API) |
| `/dashboard` | Protected | Document list, upload, delete |

## API Endpoints (apps/server)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `POST` | `/api/pdf-detect` | Optional | AI field detection (`imageBase64`) or chat (`message`) |
| `GET` | `/api/health` | No | Service health + config status |
| `GET` | `/api/documents` | Yes | List documents for org |
| `POST` | `/api/documents` | Yes | Upload PDF + create document |
| `GET` | `/api/documents/:id` | Yes | Get document with schema |
| `GET` | `/api/documents/:id/pdf-url` | Yes | Signed URL for original PDF |
| `PUT` | `/api/documents/:id` | Yes | Update schema (auto-save target) |
| `DELETE` | `/api/documents/:id` | Yes | Delete document + storage file |

## Architecture

```
┌─────────────────┐     proxy /api/*     ┌─────────────────┐     Anthropic
│  Vite (5173)    │ ──────────────────▶  │  Hono (3001)    │ ───────────▶ Claude
│  apps/web       │                      │  apps/server     │
└────────┬────────┘                      └────────┬────────┘
         │ imports                                │
┌────────▼────────┐                      ┌────────▼────────┐
│  @formpdf/editor │                      │  Postgres       │
│  packages/       │                      │  MinIO (S3)     │
│  pdf-form-editor │                      │  Redis          │
└─────────────────┘                      └─────────────────┘
                                                  │
                                         ┌────────▼────────┐
                                         │  Sync Server    │
                                         │  (3002, WS)     │
                                         └─────────────────┘
```

### Key design decisions

- **PDF points are the source of truth.** Field positions stored in PDF user space (bottom-left origin, 72pt/inch). Screen pixels derived at render time.
- **Y-flip at the engine layer.** `CoordEngine` converts between PDF (bottom-left) and DOM (top-left) so nothing else needs to.
- **Drag uses refs, not state.** Position written to `element.style` during drag. React state updated only on drag-end.
- **Undo/redo via immer patches.** Structural diffs, not snapshots. Memory-efficient for large documents.
- **AI stays server-side.** API keys never touch the browser. The editor sends to `aiProxyUrl` which you control.
- **Everything degrades gracefully.** No API key? AI disabled. No database? Storage disabled. No Clerk? Auth disabled. The editor always works.

## Project structure

```
formbase/
├── apps/
│   ├── web/                         # Vite + React app
│   │   ├── src/
│   │   │   ├── routes/              # React Router pages
│   │   │   │   ├── landing.tsx      # / — marketing page
│   │   │   │   ├── editor.tsx       # /editor — PDF editor
│   │   │   │   ├── dashboard.tsx    # /dashboard — document list (auth-gated)
│   │   │   │   ├── sign-in.tsx      # /sign-in — Clerk auth
│   │   │   │   ├── auth-layout.tsx  # Protected route wrapper
│   │   │   │   └── root.tsx         # Root layout
│   │   │   ├── lib/auth.ts          # Auth utilities
│   │   │   ├── styles/              # CSS per route
│   │   │   ├── router.tsx           # Route definitions
│   │   │   └── main.tsx             # Entry + ClerkProvider
│   │   └── vite.config.ts           # Proxy /api → :3001
│   ├── server/                      # Hono API server
│   │   ├── src/
│   │   │   ├── index.ts             # Routes, CORS, auth middleware
│   │   │   ├── handlers.ts          # AI detect + chat
│   │   │   ├── prompts.ts           # Claude system prompts
│   │   │   ├── db/schema.ts         # Drizzle ORM schema
│   │   │   ├── db/client.ts         # Postgres connection
│   │   │   ├── lib/storage.ts       # S3/R2/MinIO file storage
│   │   │   └── routes/documents.ts  # Document CRUD API
│   │   └── drizzle.config.ts        # Migration config
│   └── sync-server/                 # WebSocket sync server
│       └── src/index.ts             # Room-based WS + Redis queue
├── packages/
│   └── pdf-form-editor/             # @formpdf/editor npm library
│       ├── src/
│       │   ├── engine/              # CoordEngine (PDF ↔ screen transforms)
│       │   ├── store/               # Zustand + immer (state, history, types)
│       │   ├── components/          # PdfFormEditor, PdfCanvas, FieldItem, etc.
│       │   ├── hooks/               # useFormExport, useAiDetection, useAutoSave, useFieldSync
│       │   ├── sync/types.ts        # Sync event types (Figma bridge)
│       │   ├── context/             # EditorContext (engine + aiProxyUrl)
│       │   └── styles/              # Plain CSS with CSS variables
│       ├── README.md                # Library API docs
│       └── CHANGELOG.md
├── docker-compose.yml               # Postgres + Redis + MinIO
├── .github/workflows/
│   ├── ci.yml                       # Build + test + typecheck on push/PR
│   └── publish.yml                  # npm publish (manual dispatch)
├── package.json                     # pnpm workspace root
└── pnpm-workspace.yaml
```

## License

MIT
