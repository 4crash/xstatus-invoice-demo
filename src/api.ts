import type { WorkflowDefinition, WorkflowListItem } from './workflowSchema'

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:3001'

export async function listWorkflows(): Promise<WorkflowListItem[]> {
    const res = await fetch(`${BASE}/api/workflows`)
    if (!res.ok) throw new Error(await res.text())
    return res.json() as Promise<WorkflowListItem[]>
}

export async function getWorkflow(id: number): Promise<WorkflowDefinition> {
    const res = await fetch(`${BASE}/api/workflows/${id}`)
    if (!res.ok) throw new Error(await res.text())
    return res.json() as Promise<WorkflowDefinition>
}

export async function saveWorkflow(def: WorkflowDefinition): Promise<WorkflowDefinition> {
    const method = def.id ? 'PUT' : 'POST'
    const url = def.id ? `${BASE}/api/workflows/${def.id}` : `${BASE}/api/workflows`
    const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(def),
    })
    if (!res.ok) throw new Error(await res.text())
    return res.json() as Promise<WorkflowDefinition>
}
