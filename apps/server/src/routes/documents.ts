import { Hono } from 'hono'
import { eq, and, desc } from 'drizzle-orm'
import { getDb } from '../db/client.js'
import { documents } from '../db/schema.js'
import { uploadPdf, getPdfSignedUrl, deletePdf, makePdfKey } from '../lib/storage.js'

type AppEnv = {
  Variables: {
    userId: string
    orgId: string
  }
}

/**
 * Document CRUD routes.
 *
 * Auth context (userId, orgId) is expected to be set by middleware
 * on c.get('userId') and c.get('orgId'). When auth is not configured,
 * falls back to 'anonymous'/'personal'.
 */
const app = new Hono<AppEnv>()

import type { Context } from 'hono'

function getUserId(c: Context<AppEnv>): string {
  return c.get('userId') ?? 'anonymous'
}

function getOrgId(c: Context<AppEnv>): string {
  return c.get('orgId') ?? 'personal'
}

// ── List documents ──
app.get('/', async (c) => {
  const orgId = getOrgId(c)
  const db = getDb()

  const docs = await db
    .select({
      id: documents.id,
      name: documents.name,
      fieldCount: documents.fieldCount,
      pdfKey: documents.pdfKey,
      createdAt: documents.createdAt,
      updatedAt: documents.updatedAt,
    })
    .from(documents)
    .where(eq(documents.orgId, orgId))
    .orderBy(desc(documents.updatedAt))

  // Generate signed PDF URLs for thumbnails
  const docsWithUrls = await Promise.all(
    docs.map(async (doc) => {
      let pdfUrl: string | null = null
      try {
        pdfUrl = await getPdfSignedUrl(doc.pdfKey)
      } catch {}
      return {
        id: doc.id,
        name: doc.name,
        fieldCount: doc.fieldCount,
        pdfUrl,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt,
      }
    }),
  )

  return c.json({ documents: docsWithUrls })
})

// ── Create document (multipart: pdf file + name) ──
app.post('/', async (c) => {
  const userId = getUserId(c)
  const orgId = getOrgId(c)
  const db = getDb()

  const body = await c.req.parseBody()
  const file = body.pdf
  const name = (body.name as string) || 'Untitled'

  if (!(file instanceof File)) {
    return c.json({ error: 'pdf file is required' }, 400)
  }

  // Generate doc ID first so we can build the storage key
  const docId = crypto.randomUUID()
  const pdfKey = makePdfKey(orgId, docId)

  // Upload PDF to R2/S3
  const buffer = await file.arrayBuffer()
  await uploadPdf(pdfKey, buffer)

  // Create empty schema
  const emptySchema = { version: '2.0', pages: [], fields: [] }

  const [doc] = await db.insert(documents).values({
    id: docId,
    orgId,
    createdBy: userId,
    name,
    pdfKey,
    schema: emptySchema,
    fieldCount: 0,
  }).returning()

  return c.json({ id: doc.id, name: doc.name }, 201)
})

// ── Get document schema ──
app.get('/:id', async (c) => {
  const orgId = getOrgId(c)
  const docId = c.req.param('id')
  const db = getDb()

  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.orgId, orgId)))
    .limit(1)

  if (!doc) return c.json({ error: 'Document not found' }, 404)

  return c.json(doc)
})

// ── Get signed PDF URL ──
app.get('/:id/pdf-url', async (c) => {
  const orgId = getOrgId(c)
  const docId = c.req.param('id')
  const db = getDb()

  const [doc] = await db
    .select({ pdfKey: documents.pdfKey })
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.orgId, orgId)))
    .limit(1)

  if (!doc) return c.json({ error: 'Document not found' }, 404)

  const url = await getPdfSignedUrl(doc.pdfKey)
  return c.json({ url })
})

// ── Update document schema ──
app.put('/:id', async (c) => {
  const orgId = getOrgId(c)
  const docId = c.req.param('id')
  const db = getDb()
  const body = await c.req.json()

  const schema = body.schema
  if (!schema) return c.json({ error: 'schema is required' }, 400)

  const fieldCount = Array.isArray(schema.fields) ? schema.fields.length : 0

  const [updated] = await db
    .update(documents)
    .set({
      schema,
      fieldCount,
      updatedAt: new Date(),
    })
    .where(and(eq(documents.id, docId), eq(documents.orgId, orgId)))
    .returning()

  if (!updated) return c.json({ error: 'Document not found' }, 404)

  return c.json({ id: updated.id, updatedAt: updated.updatedAt })
})

// ── Delete document ──
app.delete('/:id', async (c) => {
  const orgId = getOrgId(c)
  const docId = c.req.param('id')
  const db = getDb()

  const [doc] = await db
    .select({ pdfKey: documents.pdfKey })
    .from(documents)
    .where(and(eq(documents.id, docId), eq(documents.orgId, orgId)))
    .limit(1)

  if (!doc) return c.json({ error: 'Document not found' }, 404)

  // Delete from storage and DB
  await deletePdf(doc.pdfKey)
  await db.delete(documents).where(eq(documents.id, docId))

  return c.json({ deleted: true })
})

export default app
