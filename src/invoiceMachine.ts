import { assign, setup } from 'xstate'
import {
    hasAlreadyVoted,
    quorumReached,
    type Role,
    type RoleConfig,
} from './guards'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface InvoiceContext {
    invoiceId: string
    amount: number
    vendor: string
    votes: string[]   // IDs of users who approved
    roleConfig: RoleConfig
}

/** All events share role + userId so guards can access them without narrowing. */
interface BaseEvent { role: Role; userId: string }

export type InvoiceEvent =
    | (BaseEvent & { type: 'SUBMIT' })
    | (BaseEvent & { type: 'VOTE_APPROVE' })
    | (BaseEvent & { type: 'REJECT' })
    | (BaseEvent & { type: 'PAY' })
    | { type: 'UPDATE_CONFIG'; config: Partial<RoleConfig> }

type GuardConfigKey = keyof RoleConfig

type SerializableGuard =
    | { type: 'hasRoleIn'; params: { configKey: GuardConfigKey } }
    | { type: 'alreadyVoted' }
    | { type: 'reachesRequiredVotes' }
    | { type: 'vendorIs'; params: { vendor: string } }
    | { type: 'allOf'; params: { guards: SerializableGuard[] } }
    | { type: 'anyOf'; params: { guards: SerializableGuard[] } }
    | { type: 'not'; params: { guard: SerializableGuard } }

export const REQUIRED_VOTES = 2

function evaluateSerializableGuard(
    context: InvoiceContext,
    event: InvoiceEvent,
    guard: SerializableGuard,
): boolean {
    switch (guard.type) {
        case 'hasRoleIn':
            return 'role' in event && context.roleConfig[guard.params.configKey].includes(event.role)
        case 'alreadyVoted':
            return 'userId' in event && hasAlreadyVoted(context.votes, event.userId)
        case 'reachesRequiredVotes':
            return 'userId' in event && quorumReached(context.votes, event.userId, REQUIRED_VOTES)
        case 'vendorIs':
            return context.vendor === guard.params.vendor
        case 'allOf':
            return guard.params.guards.every(item => evaluateSerializableGuard(context, event, item))
        case 'anyOf':
            return guard.params.guards.some(item => evaluateSerializableGuard(context, event, item))
        case 'not':
            return !evaluateSerializableGuard(context, event, guard.params.guard)
    }
}

// const loadedConfig = localStorage.getItem('invoiceRoleConfig')
// console.log('Loaded role config from localStorage:', loadedConfig ? JSON.parse(loadedConfig) : null)
// ─── Machine ──────────────────────────────────────────────────────────────────
// Guards are named references that delegate to the pure functions in guards.ts.
// This keeps the machine declaration declarative and the logic independently testable.

const machineSetup = setup({
    types: {
        context: {} as InvoiceContext,
        events: {} as InvoiceEvent,
        input: {} as { roleConfig?: Partial<RoleConfig> },
    },

    guards: {
        /** Generic role gate with params so createMachine can bind specific role groups. */
        hasRoleIn: ({ context, event }, params: { configKey: GuardConfigKey }) =>
            evaluateSerializableGuard(context, event, { type: 'hasRoleIn', params }),

        /** True when the acting user has already voted. Useful with not(...). */
        alreadyVoted: ({ context, event }) =>
            evaluateSerializableGuard(context, event, { type: 'alreadyVoted' }),

        /** True when the next vote would satisfy quorum. */
        reachesRequiredVotes: ({ context, event }) =>
            evaluateSerializableGuard(context, event, { type: 'reachesRequiredVotes' }),

        /** Tiny extra param guard only to illustrate or()/not() composition. */
        vendorIs: ({ context }, params: { vendor: string }) =>
            context.vendor === params.vendor,

        /** Serializable equivalent of and([...]). */
        allOf: ({ context, event }, params: { guards: SerializableGuard[] }) =>
            evaluateSerializableGuard(context, event, { type: 'allOf', params }),

        /** Serializable equivalent of or([...]). */
        anyOf: ({ context, event }, params: { guards: SerializableGuard[] }) =>
            evaluateSerializableGuard(context, event, { type: 'anyOf', params }),

        /** Serializable equivalent of not(...). */
        not: ({ context, event }, params: { guard: SerializableGuard }) =>
            evaluateSerializableGuard(context, event, { type: 'not', params }),
    },

    actions: {
        recordVote: assign({
            votes: ({ context, event }) =>
                'userId' in event ? [...context.votes, event.userId] : context.votes,
        }),
        clearVotes: assign({ votes: [] }),
        updateConfig: assign({
            roleConfig: ({ context, event }) =>
                event.type === 'UPDATE_CONFIG'
                    ? { ...context.roleConfig, ...event.config }
                    : context.roleConfig,
        }),
    },
})

const invoiceMachineConfig = {
    "id": "invoice",
    "initial": "draft",
    "context": {
        "invoiceId": "INV-2026-0042",
        "amount": 4850,
        "vendor": "Acme Corp",
        "votes": [],
        "roleConfig": { payRoles: ['accountant'], submitRoles: ['accountant'], voteRoles: ['manager', 'cfo'] },
    },
    "on": {
        "UPDATE_CONFIG": {
            "actions": "updateConfig"
        }
    },
    "states": {
        "draft": {
            "on": {
                "SUBMIT": {
                    "target": "pending_review",
                    "guard": {
                        "type": "allOf",
                        "params": {
                            "guards": [
                                { "type": "hasRoleIn", "params": { "configKey": "submitRoles" } },
                                {
                                    "type": "anyOf",
                                    "params": {
                                        "guards": [
                                            { "type": "hasRoleIn", "params": { "configKey": "submitRoles" } },
                                            { "type": "not", "params": { "guard": { "type": "vendorIs", "params": { "vendor": "Blocked Vendor" } } } }
                                        ]
                                    }
                                }
                            ]
                        }
                    }
                }
            }
        },
        "pending_review": {
            "on": {
                "VOTE_APPROVE": [
                    {
                        "target": "approved",
                        "guard": {
                            "type": "allOf",
                            "params": {
                                "guards": [
                                    { "type": "hasRoleIn", "params": { "configKey": "voteRoles" } },
                                    { "type": "not", "params": { "guard": { "type": "alreadyVoted" } } },
                                    { "type": "reachesRequiredVotes" }
                                ]
                            }
                        },
                        "actions": "recordVote"
                    },
                    {
                        "guard": {
                            "type": "allOf",
                            "params": {
                                "guards": [
                                    { "type": "hasRoleIn", "params": { "configKey": "voteRoles" } },
                                    { "type": "not", "params": { "guard": { "type": "alreadyVoted" } } },
                                    { "type": "not", "params": { "guard": { "type": "reachesRequiredVotes" } } }
                                ]
                            }
                        },
                        "actions": "recordVote"
                    }
                ],
                "REJECT": {
                    "target": "draft",
                    "guard": { type: 'hasRoleIn', params: { configKey: 'voteRoles' as const } },
                    "actions": "clearVotes"
                }
            }
        },
        "approved": {
            "on": {
                "PAY": {
                    "target": "paid",
                    "guard": { type: 'hasRoleIn', params: { configKey: 'payRoles' as const } }
                }
            }
        },
        "paid": {
            "type": "final"
        }
    }
} as Parameters<typeof machineSetup.createMachine>[0]

export const invoiceMachine = machineSetup.createMachine(invoiceMachineConfig)
