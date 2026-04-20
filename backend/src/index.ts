import cors from 'cors'
import 'dotenv/config'
import express, { type Request, type Response } from 'express'
import { initDb, pool } from './db'

// ─── Types ────────────────────────────────────────────────────────────────────

interface WorkflowRow {
    id: number
    name: string
    definition: Record<string, unknown>
    created_at: string
    updated_at: string
}

// ─── App ──────────────────────────────────────────────────────────────────────

const app = express()

const corsOrigin = process.env.CORS_ORIGIN ?? '*'
app.use(cors({ origin: corsOrigin }))
app.use(express.json())

function parseId(param: string | string[]): number {
    return parseInt(Array.isArray(param) ? param[0] : param, 10)
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/workflows — list all (lightweight: id, name, timestamps only)
app.get('/api/workflows', async (_req: Request, res: Response) => {
    try {
        const { rows } = await pool.query<Pick<WorkflowRow, 'id' | 'name' | 'created_at' | 'updated_at'>>(
            'SELECT id, name, created_at, updated_at FROM workflows ORDER BY updated_at DESC'
        )
        res.json(rows)
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Database error' })
    }
})

// GET /api/workflows/:id — full definition
app.get('/api/workflows/:id', async (req: Request, res: Response) => {
    const id = parseId(req.params.id)
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return }

    try {
        const { rows } = await pool.query<WorkflowRow>(
            'SELECT id, name, definition, created_at, updated_at FROM workflows WHERE id = $1',
            [id]
        )
        if (!rows.length) { res.status(404).json({ error: 'Not found' }); return }
        const row = rows[0]
        res.json({ ...row.definition, id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Database error' })
    }
})

// POST /api/workflows — create
app.post('/api/workflows', async (req: Request, res: Response) => {
    const { name, id: _id, createdAt: _c, updatedAt: _u, ...definition } = req.body as Record<string, unknown>
    if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'name is required' }); return
    }

    try {
        const { rows } = await pool.query<Pick<WorkflowRow, 'id' | 'name' | 'created_at' | 'updated_at'>>(
            'INSERT INTO workflows (name, definition) VALUES ($1, $2) RETURNING id, name, created_at, updated_at',
            [name.trim(), definition]
        )
        const row = rows[0]
        res.status(201).json({ ...definition, id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Database error' })
    }
})

// PUT /api/workflows/:id — update
app.put('/api/workflows/:id', async (req: Request, res: Response) => {
    const id = parseId(req.params.id)
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return }

    const { name, id: _id, createdAt: _c, updatedAt: _u, ...definition } = req.body as Record<string, unknown>
    if (!name || typeof name !== 'string' || !name.trim()) {
        res.status(400).json({ error: 'name is required' }); return
    }

    try {
        const { rows } = await pool.query<Pick<WorkflowRow, 'id' | 'name' | 'created_at' | 'updated_at'>>(
            `UPDATE workflows
             SET name = $1, definition = $2, updated_at = NOW()
             WHERE id = $3
             RETURNING id, name, created_at, updated_at`,
            [name.trim(), definition, id]
        )
        if (!rows.length) { res.status(404).json({ error: 'Not found' }); return }
        const row = rows[0]
        res.json({ ...definition, id: row.id, name: row.name, createdAt: row.created_at, updatedAt: row.updated_at })
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Database error' })
    }
})

// DELETE /api/workflows/:id
app.delete('/api/workflows/:id', async (req: Request, res: Response) => {
    const id = parseId(req.params.id)
    if (isNaN(id)) { res.status(400).json({ error: 'Invalid id' }); return }

    try {
        const { rowCount } = await pool.query('DELETE FROM workflows WHERE id = $1', [id])
        if (!rowCount) { res.status(404).json({ error: 'Not found' }); return }
        res.status(204).end()
    } catch (err) {
        console.error(err)
        res.status(500).json({ error: 'Database error' })
    }
})

// ─── Boot ─────────────────────────────────────────────────────────────────────

const PORT = parseInt(process.env.PORT ?? '3001', 10)

initDb()
    .then(() => app.listen(PORT, () => console.log(`[api] http://localhost:${PORT}`)))
    .catch(err => { console.error('[db] init failed', err); process.exit(1) })
