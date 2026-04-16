import { useMachine } from '@xstate/react'
import { useState } from 'react'
import {
    hasAlreadyVoted,
    ROLE_COLORS,
    ROLE_LABELS,
    USERS,
    type Role,
    type RoleConfig,
    type User,
} from './guards'
import InvoiceFlowChart from './InvoiceFlowChart'
import { invoiceMachine, REQUIRED_VOTES } from './invoiceMachine'

// ─── Status badge styles ──────────────────────────────────────────────────────

const STATE_LABEL: Record<string, string> = {
    draft: 'Draft',
    pending_review: 'Pending Review',
    approved: 'Approved',
    paid: 'Paid',
}

const STATE_BADGE: Record<string, string> = {
    draft: 'bg-slate-700 text-slate-200',
    pending_review: 'bg-amber-800 text-amber-100',
    approved: 'bg-green-800 text-green-100',
    paid: 'bg-blue-800 text-blue-100',
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function InvoiceDemo() {
    const [activeUserId, setActiveUserId] = useState<string>(USERS[0].id)
    const [configOpen, setConfigOpen] = useState(false)
    const [state, send] = useMachine(invoiceMachine, { input: {} })

    const current = state.value as string
    const { invoiceId, amount, vendor, votes, roleConfig } = state.context
    const activeUser: User = USERS.find(u => u.id === activeUserId)!

    const eligibleVoters = USERS.filter(u => roleConfig.voteRoles.includes(u.role))
    const alreadyVoted = hasAlreadyVoted(votes, activeUser.id)

    function dispatch(type: 'SUBMIT' | 'VOTE_APPROVE' | 'REJECT' | 'PAY') {
        send({ type, role: activeUser.role, userId: activeUser.id })
    }

    function toggleRole(key: keyof RoleConfig, role: Role) {
        const current = roleConfig[key]
        const next = current.includes(role)
            ? current.filter(r => r !== role)
            : [...current, role]
        send({ type: 'UPDATE_CONFIG', config: { [key]: next } })
    }

    return (
        <div className="flex flex-col gap-8 w-full max-w-7xl h-screen mx-auto px-4 py-10">

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">
                        Invoice Approval Workflow
                    </h1>
                    <p className="text-sm text-gray-400 mt-1">
                        XState guards enforce role-based permissions.&nbsp;
                        Approval requires <span className="text-white font-medium">{REQUIRED_VOTES}</span> of{' '}
                        <span className="text-white font-medium">{eligibleVoters.length}</span> eligible voters.
                    </p>
                </div>
                <button
                    onClick={() => setConfigOpen(o => !o)}
                    className="mt-1 px-4 py-2 rounded-lg text-sm font-medium bg-gray-800 border border-gray-700 text-gray-300 hover:border-gray-500 transition-all"
                >
                    {configOpen ? 'Hide Config' : 'Configure Roles'}
                </button>
            </div>

            {/* ── Role config panel ──────────────────────────────────────────── */}
            {configOpen && (
                <div className="bg-gray-900 rounded-xl border border-gray-700 p-5">
                    <p className="text-xs font-semibold uppercase tracking-widest text-gray-500 mb-4">
                        Role permissions
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                        <RoleConfigGroup
                            label="Can Submit"
                            description="Move draft → pending review"
                            configKey="submitRoles"
                            roleConfig={roleConfig}
                            onToggle={toggleRole}
                        />
                        <RoleConfigGroup
                            label="Can Vote / Reject"
                            description="Cast approval votes or reject"
                            configKey="voteRoles"
                            roleConfig={roleConfig}
                            onToggle={toggleRole}
                        />
                        <RoleConfigGroup
                            label="Can Pay"
                            description="Mark approved invoice as paid"
                            configKey="payRoles"
                            roleConfig={roleConfig}
                            onToggle={toggleRole}
                        />
                    </div>
                </div>
            )}

            {/* ── User selector ──────────────────────────────────────────────── */}
            <div className="flex flex-col gap-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">
                    Acting as
                </p>
                <div className="flex gap-2 flex-wrap">
                    {USERS.map(u => (
                        <button
                            key={u.id}
                            onClick={() => setActiveUserId(u.id)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium border transition-all ${u.id === activeUserId
                                ? 'bg-violet-700 border-violet-500 text-white shadow-lg shadow-violet-900/40'
                                : 'bg-gray-800 border-gray-700 text-gray-300 hover:border-gray-500'
                                }`}
                        >
                            {u.name}
                            <span className="ml-2 text-xs opacity-60">({ROLE_LABELS[u.role]})</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Invoice card ───────────────────────────────────────────────── */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 divide-y divide-gray-800">

                {/* Invoice header */}
                <div className="flex items-start justify-between p-6">
                    <div>
                        <p className="text-xs text-gray-500 uppercase tracking-widest">Invoice</p>
                        <h2 className="text-xl font-bold text-white mt-0.5">{invoiceId}</h2>
                        <p className="text-gray-400 text-sm mt-1">Vendor: {vendor}</p>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                        <span className={`text-xs font-semibold px-3 py-1 rounded-full ${STATE_BADGE[current]}`}>
                            {STATE_LABEL[current]}
                        </span>
                        <span className="text-2xl font-bold text-white">
                            ${amount.toLocaleString()}
                        </span>
                    </div>
                </div>

                {/* Vote progress (visible during review + after) */}
                {(current === 'pending_review' || current === 'approved' || current === 'paid') && (
                    <div className="px-6 py-4">
                        <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                            Approval votes — {votes.length} / {REQUIRED_VOTES} required
                        </p>
                        <div className="flex gap-2 flex-wrap">
                            {eligibleVoters.map(u => (
                                <span
                                    key={u.id}
                                    className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${votes.includes(u.id)
                                        ? 'bg-green-900/60 border-green-700 text-green-300'
                                        : 'bg-gray-800 border-gray-700 text-gray-500'
                                        }`}
                                >
                                    {votes.includes(u.id) ? '✓ ' : '○ '}
                                    {u.name}
                                    <span className="opacity-50 ml-1">({ROLE_LABELS[u.role]})</span>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {/* Actions */}
                <div className="px-6 py-4">
                    <p className="text-xs text-gray-500 uppercase tracking-widest mb-3">
                        Your actions —{' '}
                        <span className={`font-semibold ${ROLE_COLORS[activeUser.role]}`}>
                            {activeUser.name} ({ROLE_LABELS[activeUser.role]})
                        </span>
                    </p>

                    <div className="flex gap-3 flex-wrap items-start">
                        {current === 'draft' && (
                            <ActionButton
                                label="Submit for Review"
                                allowed={roleConfig.submitRoles.includes(activeUser.role)}
                                reason="Your role cannot submit invoices"
                                onClick={() => dispatch('SUBMIT')}
                            />
                        )}

                        {current === 'pending_review' && (
                            <>
                                <ActionButton
                                    label={alreadyVoted ? 'Vote Approve (already voted)' : 'Vote Approve'}
                                    allowed={roleConfig.voteRoles.includes(activeUser.role) && !alreadyVoted}
                                    reason={
                                        !roleConfig.voteRoles.includes(activeUser.role)
                                            ? 'Your role cannot vote'
                                            : 'You have already voted'
                                    }
                                    onClick={() => dispatch('VOTE_APPROVE')}
                                />
                                <ActionButton
                                    label="Reject"
                                    allowed={roleConfig.voteRoles.includes(activeUser.role)}
                                    reason="Your role cannot reject invoices"
                                    onClick={() => dispatch('REJECT')}
                                    variant="danger"
                                />
                            </>
                        )}

                        {current === 'approved' && (
                            <ActionButton
                                label="Mark as Paid"
                                allowed={roleConfig.payRoles.includes(activeUser.role)}
                                reason="Your role cannot pay invoices"
                                onClick={() => dispatch('PAY')}
                                variant="success"
                            />
                        )}

                        {current === 'paid' && (
                            <p className="text-sm text-green-400 font-medium py-2">
                                ✓ Invoice fully processed
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* ── State machine flow chart ────────────────────────────────────── */}
            <div className="bg-gray-900 rounded-xl border border-gray-800 overflow-hidden">
                <p className="text-xs text-gray-500 uppercase tracking-widest px-5 pt-4 pb-1">
                    State machine
                </p>
                <InvoiceFlowChart currentState={current} votes={votes} />
            </div>
        </div>
    )
}

// ─── Role config group ───────────────────────────────────────────────────────

const ALL_ROLES: Role[] = ['accountant', 'manager', 'cfo']

interface RoleConfigGroupProps {
    label: string
    description: string
    configKey: keyof RoleConfig
    roleConfig: RoleConfig
    onToggle: (key: keyof RoleConfig, role: Role) => void
}

function RoleConfigGroup({ label, description, configKey, roleConfig, onToggle }: RoleConfigGroupProps) {
    return (
        <div className="flex flex-col gap-2">
            <div>
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className="text-xs text-gray-500">{description}</p>
            </div>
            <div className="flex flex-col gap-1.5">
                {ALL_ROLES.map(role => (
                    <label key={role} className="flex items-center gap-2 cursor-pointer group">
                        <input
                            type="checkbox"
                            checked={roleConfig[configKey].includes(role)}
                            onChange={() => onToggle(configKey, role)}
                            className="w-4 h-4 accent-violet-500"
                        />
                        <span className={`text-sm font-medium ${ROLE_COLORS[role]}`}>
                            {ROLE_LABELS[role]}
                        </span>
                    </label>
                ))}
            </div>
        </div>
    )
}

// ─── Action button ────────────────────────────────────────────────────────────

interface ActionButtonProps {
    label: string
    allowed: boolean
    reason: string
    onClick: () => void
    variant?: 'default' | 'danger' | 'success'
}

function ActionButton({
    label,
    allowed,
    reason,
    onClick,
    variant = 'default',
}: ActionButtonProps) {
    const enabledStyle: Record<string, string> = {
        default: 'bg-violet-700 hover:bg-violet-600 text-white',
        danger: 'bg-red-800   hover:bg-red-700   text-white',
        success: 'bg-green-800 hover:bg-green-700 text-white',
    }

    return (
        <div className="flex flex-col gap-1">
            <button
                disabled={!allowed}
                onClick={onClick}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-all ${allowed
                    ? enabledStyle[variant]
                    : 'bg-gray-800 text-gray-600 border border-gray-700 cursor-not-allowed'
                    }`}
                title={!allowed ? reason : undefined}
            >
                {label}
            </button>
            {!allowed && (
                <p className="text-xs text-gray-600">{reason}</p>
            )}
        </div>
    )
}
