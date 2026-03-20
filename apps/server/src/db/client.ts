import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema.js'

let _db: ReturnType<typeof drizzle> | null = null

export function getDb() {
  if (!_db) {
    const connectionString = process.env.DATABASE_URL
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set. Document storage is unavailable.')
    }
    const sql = postgres(connectionString)
    _db = drizzle(sql, { schema })
  }
  return _db
}
