import { DEFAULT_ROLE_CONFIG, type Role, type RoleConfig } from './guards'

// ─── Types ────────────────────────────────────────────────────────────────────

/** A named guard with optional description and role allowlist. */
export interface GuardDefinition {
    name: string
    description?: string
    /** Roles that satisfy this guard. Empty = no role restriction. */
    allowedRoles?: Role[]
}

export interface WorkflowStateNode {
    id: string
    label: string
    color: string
    isFinal: boolean
    position: { x: number; y: number }
}

export interface WorkflowTransition {
    id: string
    source: string
    target: string
    event: string
    /** Display label shown on the edge. */
    label: string
    guard: string
    action?: string
    animated: boolean
    type?: string
    style?: Record<string, string>
    labelStyle?: Record<string, string>
}

export interface WorkflowDefinition {
    id?: number
    name: string
    initialState: string
    requiredVotes: number
    roleConfig: RoleConfig
    guardDefinitions: GuardDefinition[]
    states: WorkflowStateNode[]
    transitions: WorkflowTransition[]
    createdAt?: string
    updatedAt?: string
}

/** Shape returned by GET /api/workflows (list endpoint — no definition body). */
export interface WorkflowListItem {
    id: number
    name: string
    created_at: string
    updated_at: string
}

// ─── Default definition (mirrors the hardcoded machine) ───────────────────────

export const DEFAULT_WORKFLOW_DEFINITION: WorkflowDefinition = {
    name: 'Invoice Approval',
    initialState: 'draft',
    requiredVotes: 2,
    roleConfig: DEFAULT_ROLE_CONFIG,
    guardDefinitions: [
        { name: 'canSubmit', description: 'Only allowed submit roles may submit', allowedRoles: ['accountant'] },
        { name: 'canVoteAndNotYet', description: 'Vote role, not yet voted, quorum not reached', allowedRoles: ['manager', 'cfo'] },
        { name: 'canVoteAndReachesQuorum', description: 'Vote role, not yet voted, quorum reached', allowedRoles: ['manager', 'cfo'] },
        { name: 'canReject', description: 'Only vote roles may reject', allowedRoles: ['manager', 'cfo'] },
        { name: 'canPay', description: 'Only allowed pay roles may pay', allowedRoles: ['accountant'] },
    ],
    states: [
        { id: 'draft', label: 'Draft', color: '#475569', isFinal: false, position: { x: 30, y: 80 } },
        { id: 'pending_review', label: 'Pending Review', color: '#b45309', isFinal: false, position: { x: 230, y: 80 } },
        { id: 'approved', label: 'Approved', color: '#15803d', isFinal: false, position: { x: 470, y: 80 } },
        { id: 'paid', label: 'Paid', color: '#1d4ed8', isFinal: true, position: { x: 680, y: 80 } },
    ],
    transitions: [
        {
            id: 'e-submit',
            source: 'draft', target: 'pending_review',
            event: 'SUBMIT', label: 'SUBMIT\n(Accountant)',
            guard: 'canSubmit', animated: true,
        },
        {
            id: 'e-approve',
            source: 'pending_review', target: 'approved',
            event: 'VOTE_APPROVE', label: 'VOTE ×2\n(Mgr / CFO)',
            guard: 'canVoteAndReachesQuorum', action: 'recordVote', animated: true,
        },
        {
            id: 'e-reject',
            source: 'pending_review', target: 'draft',
            event: 'REJECT', label: 'REJECT',
            guard: 'canReject', action: 'clearVotes',
            animated: false, type: 'step',
            style: { stroke: '#ef4444' }, labelStyle: { fill: '#ef4444' },
        },
        {
            id: 'e-pay',
            source: 'approved', target: 'paid',
            event: 'PAY', label: 'PAY\n(Accountant)',
            guard: 'canPay', animated: true,
        },
    ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns a new WorkflowDefinition with node positions replaced by the
 * values from `positions` (keyed by state id). Used before saving.
 */
export function applyPositions(
    def: WorkflowDefinition,
    positions: Record<string, { x: number; y: number }>,
): WorkflowDefinition {
    return {
        ...def,
        states: def.states.map(s => ({
            ...s,
            position: positions[s.id] ?? s.position,
        })),
    }
}
