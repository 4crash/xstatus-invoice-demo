import { assign, setup } from 'xstate'
import {
    DEFAULT_ROLE_CONFIG,
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

export const REQUIRED_VOTES = 2

// ─── Machine ──────────────────────────────────────────────────────────────────
// Guards are named references that delegate to the pure functions in guards.ts.
// This keeps the machine declaration declarative and the logic independently testable.

export const invoiceMachine = setup({
    types: {
        context: {} as InvoiceContext,
        events: {} as InvoiceEvent,
        input: {} as { roleConfig?: Partial<RoleConfig> },
    },

    guards: {
        /** Draft → Pending Review: allowed roles configurable. */
        canSubmit: ({ context, event }) =>
            'role' in event && context.roleConfig.submitRoles.includes(event.role),

        /** Vote recorded but quorum not yet met. */
        canVoteAndNotYet: ({ context, event }) =>
            'role' in event &&
            context.roleConfig.voteRoles.includes(event.role) &&
            !hasAlreadyVoted(context.votes, event.userId) &&
            !quorumReached(context.votes, event.userId, REQUIRED_VOTES),

        /** Vote recorded AND quorum reached → transition to approved. */
        canVoteAndReachesQuorum: ({ context, event }) =>
            'role' in event &&
            context.roleConfig.voteRoles.includes(event.role) &&
            !hasAlreadyVoted(context.votes, event.userId) &&
            quorumReached(context.votes, event.userId, REQUIRED_VOTES),

        /** Pending Review → Draft: allowed roles configurable. */
        canReject: ({ context, event }) =>
            'role' in event && context.roleConfig.voteRoles.includes(event.role),

        /** Approved → Paid: allowed roles configurable. */
        canPay: ({ context, event }) =>
            'role' in event && context.roleConfig.payRoles.includes(event.role),
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

}).createMachine({
    id: 'invoice',
    initial: 'draft',
    context: ({ input }) => ({
        invoiceId: 'INV-2026-0042',
        amount: 4_850,
        vendor: 'Acme Corp',
        votes: [],
        roleConfig: { ...DEFAULT_ROLE_CONFIG, ...input?.roleConfig },
    }),
    // UPDATE_CONFIG is accepted from any state without resetting the workflow.
    on: {
        UPDATE_CONFIG: { actions: 'updateConfig' },
    },
    states: {
        draft: {
            on: {
                SUBMIT: { target: 'pending_review', guard: 'canSubmit' },
            },
        },

        pending_review: {
            on: {
                // Ordered: check quorum-reaching first, otherwise just record the vote.
                VOTE_APPROVE: [
                    { target: 'approved', guard: 'canVoteAndReachesQuorum', actions: 'recordVote' },
                    { guard: 'canVoteAndNotYet', actions: 'recordVote' },
                ],
                REJECT: { target: 'draft', guard: 'canReject', actions: 'clearVotes' },
            },
        },

        approved: {
            on: {
                PAY: { target: 'paid', guard: 'canPay' },
            },
        },

        paid: { type: 'final' },
    },
})
