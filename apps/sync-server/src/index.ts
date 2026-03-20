import 'dotenv/config'
import { WebSocketServer, type WebSocket as WS } from 'ws'
import type { IncomingMessage } from 'node:http'
import { createClient, type RedisClientType } from 'redis'

interface SyncEvent {
  docId: string
  fieldId: string
  origin: 'figma' | 'web'
  timestamp: number
  payload: unknown
}

const port = parseInt(process.env.PORT || '3002', 10)
const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

// ── Redis ──
const redis: RedisClientType = createClient({ url: redisUrl })
redis.on('error', (err: Error) => console.error('[Sync] Redis error:', err))

// ── Rooms: docId → Set<WebSocket> ──
const rooms = new Map<string, Set<WS>>()

function getRoomSize(docId: string): number {
  return rooms.get(docId)?.size ?? 0
}

// ── WebSocket Server ──
const wss = new WebSocketServer({ port })

wss.on('connection', (ws: WS, req: IncomingMessage) => {
  // docId from URL path: ws://localhost:3002/<docId>
  const docId = new URL(req.url!, `ws://localhost:${port}`).pathname.slice(1)

  if (!docId) {
    ws.close(4000, 'Missing docId in URL path')
    return
  }

  // Join room
  if (!rooms.has(docId)) rooms.set(docId, new Set())
  rooms.get(docId)!.add(ws)

  console.log(`[Sync] Client joined room "${docId}" (${getRoomSize(docId)} clients)`)

  // Replay queued deltas from while this client was offline
  redis.lRange(`queue:${docId}`, 0, -1).then((queued: string[]) => {
    for (const raw of queued) {
      if (ws.readyState === ws.OPEN) {
        ws.send(raw)
      }
    }
    if (queued.length > 0) {
      console.log(`[Sync] Replayed ${queued.length} queued events for "${docId}"`)
    }
  }).catch((err: Error) => {
    console.error(`[Sync] Failed to replay queue for "${docId}":`, err)
  })

  // Handle incoming messages
  ws.on('message', async (raw: Buffer) => {
    const data = raw.toString()

    // Validate JSON
    try {
      JSON.parse(data) as SyncEvent
    } catch {
      return
    }

    // Broadcast to all OTHER clients in the room
    const room = rooms.get(docId)
    if (room) {
      for (const client of room) {
        if (client !== ws && client.readyState === ws.OPEN) {
          client.send(data)
        }
      }
    }

    // Queue for offline clients (keep last 500 per doc, 24h TTL)
    try {
      await redis.rPush(`queue:${docId}`, data)
      await redis.lTrim(`queue:${docId}`, -500, -1)
      await redis.expire(`queue:${docId}`, 60 * 60 * 24)
    } catch (err) {
      console.error(`[Sync] Failed to queue event for "${docId}":`, (err as Error).message)
    }
  })

  ws.on('close', () => {
    rooms.get(docId)?.delete(ws)
    const remaining = getRoomSize(docId)
    if (remaining === 0) rooms.delete(docId)
    console.log(`[Sync] Client left room "${docId}" (${remaining} clients)`)
  })

  ws.on('error', (err: Error) => {
    console.error(`[Sync] WebSocket error in room "${docId}":`, err.message)
  })
})

// ── Start ──
async function start() {
  try {
    await redis.connect()
    console.log(`[Sync] Redis connected at ${redisUrl}`)
  } catch (err) {
    console.warn(`[Sync] Redis not available (${(err as Error).message}) — running without queue persistence`)
  }

  console.log(`[Sync] WebSocket server ready on ws://localhost:${port}`)
  console.log(`[Sync] Connect with: ws://localhost:${port}/<docId>`)
}

start()
