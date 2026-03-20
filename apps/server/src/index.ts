import 'dotenv/config'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serve } from '@hono/node-server'
import { handleDetect, handleChat } from './handlers.js'
import documentRoutes from './routes/documents.js'

type AppEnv = {
  Variables: {
    userId: string
    orgId: string
  }
}

const app = new Hono<AppEnv>()

// ── CORS ──
app.use('/api/*', cors({
  origin: ['http://localhost:5173', 'http://localhost:4173'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowHeaders: ['Content-Type', 'Authorization'],
}))

// ── Auth middleware (optional — skips when Clerk keys not configured) ──
app.use('/api/*', async (c, next) => {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY

  if (!clerkSecretKey) {
    // No auth configured — set anonymous identity
    c.set('userId', 'anonymous')
    c.set('orgId', 'personal')
    return next()
  }

  // Verify Clerk session token from Authorization header
  try {
    const { verifyToken } = await import('@clerk/backend')

    const authHeader = c.req.header('Authorization')
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null

    if (!token) {
      // Allow unauthenticated access to health + pdf-detect (for now)
      const path = c.req.path
      if (path === '/api/health' || path === '/api/pdf-detect') {
        c.set('userId', 'anonymous')
        c.set('orgId', 'personal')
        return next()
      }
      return c.json({ error: 'Unauthorized' }, 401)
    }

    const result = await verifyToken(token, { secretKey: clerkSecretKey })
    if ('sub' in result) {
      c.set('userId', result.sub)
      c.set('orgId', (result as any).org_id ?? 'personal')
    } else {
      return c.json({ error: 'Invalid token' }, 401)
    }
    return next()
  } catch (e) {
    console.error('[Auth] Token verification failed:', (e as Error).message)
    return c.json({ error: 'Invalid session' }, 401)
  }
})

// ── AI routes ──
app.post('/api/pdf-detect', async (c) => {
  const body = await c.req.json()

  if (body.imageBase64 && body.pageIndex !== undefined) {
    if (!process.env.ANTHROPIC_API_KEY) {
      return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
    }
    return c.json(await handleDetect(body))
  }

  if (body.message) {
    if (!process.env.ANTHROPIC_API_KEY) {
      return c.json({ error: 'ANTHROPIC_API_KEY not configured' }, 500)
    }
    return c.json(await handleChat(body))
  }

  return c.json({ error: 'Invalid request. Send { imageBase64, pageIndex } or { message }.' }, 400)
})

// ── Document routes ──
app.route('/api/documents', documentRoutes)

// ── Health ──
app.get('/api/health', (c) => {
  return c.json({
    status: 'ok',
    hasApiKey: !!process.env.ANTHROPIC_API_KEY,
    hasDatabase: !!process.env.DATABASE_URL,
    hasStorage: !!process.env.R2_ENDPOINT,
    hasAuth: !!process.env.CLERK_SECRET_KEY,
  })
})

// ── Start ──
const port = parseInt(process.env.PORT || '3001', 10)

console.log(`[Formbase] Starting on port ${port}`)
if (!process.env.ANTHROPIC_API_KEY) {
  console.warn('[Formbase] ANTHROPIC_API_KEY not set — AI features disabled')
}
if (!process.env.DATABASE_URL) {
  console.warn('[Formbase] DATABASE_URL not set — document storage disabled')
}
if (!process.env.R2_ENDPOINT) {
  console.warn('[Formbase] R2_ENDPOINT not set — PDF file storage disabled')
}

serve({ fetch: app.fetch, port }, () => {
  console.log(`[Formbase] Ready at http://localhost:${port}`)
})
