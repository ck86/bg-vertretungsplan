import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'

let db: ReturnType<typeof drizzle<typeof schema>> | null = null

/**
 * Neon Postgres via HTTP (serverless-friendly). Requires `DATABASE_URL` from the Neon dashboard.
 */
export function getDb() {
  if (db) {
    return db
  }

  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error(
      'DATABASE_URL is not set. Add your Neon connection string (e.g. postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require).',
    )
  }

  db = drizzle(url, { schema })
  return db
}

/** No-op for Neon HTTP client (kept for compatibility with tests or future pooling). */
export function closeDb() {
  db = null
}

export { schema }
