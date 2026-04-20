import 'dotenv/config'
import { Pool } from 'pg'

export const pool = new Pool({ connectionString: process.env.DATABASE_URL })

export async function initDb(): Promise<void> {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS workflows (
            id         SERIAL      PRIMARY KEY,
            name       TEXT        NOT NULL,
            definition JSONB       NOT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `)
    console.log('[db] table ready')
}
