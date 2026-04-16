// ─────────────────────────────────────────────────────────────────────────────
// Pure business-logic guards – no XState dependency.
// The machine wires these into setup().guards so they stay testable in isolation.
// ─────────────────────────────────────────────────────────────────────────────

export type Role = 'accountant' | 'manager' | 'cfo'

/** Which roles are permitted to perform each workflow action. */
export interface RoleConfig {
    submitRoles: Role[]
    voteRoles: Role[]
    payRoles: Role[]
}

export const DEFAULT_ROLE_CONFIG: RoleConfig = {
    submitRoles: ['accountant'],
    voteRoles: ['manager', 'cfo'],
    payRoles: ['accountant'],
}

export interface User {
    id: string
    name: string
    role: Role
}

export const USERS: User[] = [
    { id: 'alice', name: 'Carl Calculator', role: 'accountant' },
    { id: 'bob', name: 'Randal Ruler', role: 'manager' },
    { id: 'carol', name: 'Karl King', role: 'cfo' },
]

export const ROLE_LABELS: Record<Role, string> = {
    accountant: 'Accountant',
    manager: 'Manager',
    cfo: 'CFO',
}

export const ROLE_COLORS: Record<Role, string> = {
    accountant: 'text-sky-400',
    manager: 'text-emerald-400',
    cfo: 'text-violet-400',
}

/** Only accountants may submit an invoice for review (default). */
export function canSubmitInvoice(role: Role): boolean {
    return role === 'accountant'
}

/** Managers and CFOs are eligible to vote on invoice approval (default). */
export function canVoteOnInvoice(role: Role): boolean {
    return role === 'manager' || role === 'cfo'
}

/** Only accountants may mark an approved invoice as paid (default). */
export function canPayInvoice(role: Role): boolean {
    return role === 'accountant'
}

/** Returns true if adding newVoterId reaches (or exceeds) the required quorum. */
export function quorumReached(
    existingVotes: string[],
    newVoterId: string,
    required = 2,
): boolean {
    if (existingVotes.includes(newVoterId)) return false
    return existingVotes.length + 1 >= required
}

/** Returns true if the user has already cast a vote. */
export function hasAlreadyVoted(votes: string[], userId: string): boolean {
    return votes.includes(userId)
}
