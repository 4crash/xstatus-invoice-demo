import {
    addEdge,
    Background,
    Controls,
    MiniMap,
    ReactFlow,
    useEdgesState,
    useNodesState,
    type Connection,
    type Edge,
    type Node,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useState } from 'react'
import { saveWorkflow } from './api'
import { DEFAULT_ROLE_CONFIG, ROLE_COLORS, ROLE_LABELS, type Role, type RoleConfig } from './guards'
import type { WorkflowDefinition } from './workflowSchema'

// ─── Constants ────────────────────────────────────────────────────────────────

const AVAILABLE_GUARDS = [
    'canSubmit', 'canVoteAndNotYet', 'canVoteAndReachesQuorum', 'canReject', 'canPay',
] as const

const AVAILABLE_ACTIONS = ['recordVote', 'clearVotes', 'updateConfig'] as const

const ALL_ROLES: Role[] = ['accountant', 'manager', 'cfo']

const PRESET_COLORS = ['#475569', '#b45309', '#15803d', '#1d4ed8', '#7c3aed', '#be185d', '#0e7490']

// ─── Node / Edge data types ───────────────────────────────────────────────────

interface StateData extends Record<string, unknown> {
    label: string
    color: string
    isFinal: boolean
}

interface TransitionData extends Record<string, unknown> {
    event: string
    guard: string
    action?: string
}

type StateNode = Node<StateData>
type TransitionEdge = Edge<TransitionData>

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildNodeStyle(color: string, isFinal: boolean, selected: boolean): React.CSSProperties {
    return {
        background: color,
        border: selected ? '3px solid #fff' : isFinal ? '2px dashed rgba(255,255,255,0.55)' : '1px solid rgba(255,255,255,0.15)',
        borderRadius: 8,
        color: '#fff',
        fontWeight: selected ? 700 : 400,
        minWidth: 130,
        padding: '10px 16px',
        boxShadow: selected ? `0 0 0 5px ${color}55` : 'none',
    }
}

// ─── Form value types ─────────────────────────────────────────────────────────

interface StateFormValue { id: string; label: string; color: string; isFinal: boolean }
interface TransitionFormValue { id: string; source: string; target: string; event: string; label: string; guard: string; action: string; animated: boolean; edgeType: string; strokeColor: string }

const EMPTY_STATE_FORM: StateFormValue = { id: '', label: '', color: '#475569', isFinal: false }
const EMPTY_TRANS_FORM: TransitionFormValue = { id: '', source: '', target: '', event: '', label: '', guard: '', action: '', animated: true, edgeType: '', strokeColor: '#94a3b8' }

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
            <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-5">
                    <h3 className="text-base font-semibold text-white">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-2xl leading-none">×</button>
                </div>
                {children}
            </div>
        </div>
    )
}

// ─── State form ───────────────────────────────────────────────────────────────

function StateForm({ initial, isEditing, existingIds, onSubmit, onCancel }: {
    initial: StateFormValue; isEditing: boolean; existingIds: string[]
    onSubmit: (v: StateFormValue) => void; onCancel: () => void
}) {
    const [v, setV] = useState<StateFormValue>(initial)
    function set<K extends keyof StateFormValue>(key: K, val: StateFormValue[K]) {
        setV(prev => ({ ...prev, [key]: val }))
    }
    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const id = v.id.trim()
        const label = v.label.trim()
        if (!id || !label) return
        if (!isEditing && existingIds.includes(id)) { alert(`State "${id}" already exists`); return }
        onSubmit({ ...v, id, label })
    }
    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
                <label className="block text-xs text-gray-400 mb-1">ID (machine key)</label>
                <input value={v.id} onChange={e => set('id', e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    disabled={isEditing} required placeholder="e.g. pending_review"
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500 disabled:opacity-50" />
            </div>
            <div>
                <label className="block text-xs text-gray-400 mb-1">Label</label>
                <input value={v.label} onChange={e => set('label', e.target.value)} required placeholder="e.g. Pending Review"
                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500" />
            </div>
            <div>
                <label className="block text-xs text-gray-400 mb-2">Color</label>
                <div className="flex gap-2 flex-wrap items-center">
                    {PRESET_COLORS.map(c => (
                        <button key={c} type="button" onClick={() => set('color', c)}
                            style={{ background: c }}
                            className={`w-7 h-7 rounded-full border-2 transition-all ${v.color === c ? 'border-white scale-110' : 'border-transparent'}`} />
                    ))}
                    <input type="color" value={v.color} onChange={e => set('color', e.target.value)}
                        className="w-7 h-7 rounded cursor-pointer border border-gray-600" title="Custom color" />
                </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={v.isFinal} onChange={e => set('isFinal', e.target.checked)} className="w-4 h-4 accent-violet-500" />
                <span className="text-sm text-gray-300">Final state</span>
            </label>
            <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm bg-gray-800 text-gray-300 hover:bg-gray-700">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-violet-700 hover:bg-violet-600 text-white font-medium">
                    {isEditing ? 'Update State' : 'Add State'}
                </button>
            </div>
        </form>
    )
}

// ─── Transition form ──────────────────────────────────────────────────────────

function TransitionForm({ initial, isEditing, stateIds, onSubmit, onCancel }: {
    initial: TransitionFormValue; isEditing: boolean; stateIds: string[]
    onSubmit: (v: TransitionFormValue) => void; onCancel: () => void
}) {
    const [v, setV] = useState<TransitionFormValue>(initial)
    function set<K extends keyof TransitionFormValue>(key: K, val: TransitionFormValue[K]) {
        setV(prev => ({ ...prev, [key]: val }))
    }
    function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const event = v.event.trim().toUpperCase()
        if (!event || !v.source || !v.target) return
        const label = v.label.trim() || event
        const id = v.id || `e-${v.source}-${v.target}-${event.toLowerCase()}-${Date.now()}`
        onSubmit({ ...v, id, event, label })
    }
    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Source state</label>
                    <select value={v.source} onChange={e => set('source', e.target.value)} required
                        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500">
                        <option value="">Select…</option>
                        {stateIds.map(id => <option key={id} value={id}>{id}</option>)}
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Target state</label>
                    <select value={v.target} onChange={e => set('target', e.target.value)} required
                        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500">
                        <option value="">Select…</option>
                        {stateIds.map(id => <option key={id} value={id}>{id}</option>)}
                    </select>
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Event name</label>
                    <input value={v.event} onChange={e => { set('event', e.target.value.toUpperCase()) }} required placeholder="e.g. SUBMIT"
                        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500" />
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Display label</label>
                    <input value={v.label} onChange={e => set('label', e.target.value)} placeholder="Same as event if empty"
                        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500" />
                </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Guard</label>
                    <input list="guard-list" value={v.guard} onChange={e => set('guard', e.target.value)} placeholder="Guard name"
                        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500" />
                    <datalist id="guard-list">
                        {AVAILABLE_GUARDS.map(g => <option key={g} value={g} />)}
                    </datalist>
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Action (optional)</label>
                    <input list="action-list" value={v.action} onChange={e => set('action', e.target.value)} placeholder="Action name"
                        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500" />
                    <datalist id="action-list">
                        {AVAILABLE_ACTIONS.map(a => <option key={a} value={a} />)}
                    </datalist>
                </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Edge style</label>
                    <select value={v.edgeType} onChange={e => set('edgeType', e.target.value)}
                        className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500">
                        <option value="">Default</option>
                        <option value="step">Step</option>
                        <option value="smoothstep">Smooth step</option>
                        <option value="straight">Straight</option>
                    </select>
                </div>
                <div>
                    <label className="block text-xs text-gray-400 mb-1">Stroke color</label>
                    <input type="color" value={v.strokeColor} onChange={e => set('strokeColor', e.target.value)}
                        className="w-full h-9.5 rounded cursor-pointer bg-gray-800 border border-gray-700" />
                </div>
                <label className="flex flex-col gap-1 cursor-pointer">
                    <span className="text-xs text-gray-400">Animated</span>
                    <div className="flex items-center h-9.5">
                        <input type="checkbox" checked={v.animated} onChange={e => set('animated', e.target.checked)}
                            className="w-4 h-4 accent-violet-500" />
                    </div>
                </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={onCancel} className="px-4 py-2 rounded-lg text-sm bg-gray-800 text-gray-300 hover:bg-gray-700">Cancel</button>
                <button type="submit" className="px-4 py-2 rounded-lg text-sm bg-violet-700 hover:bg-violet-600 text-white font-medium">
                    {isEditing ? 'Update Transition' : 'Add Transition'}
                </button>
            </div>
        </form>
    )
}

// ─── Role config group ────────────────────────────────────────────────────────

function RoleConfigGroup({ label, configKey, roleConfig, onToggle }: {
    label: string; configKey: keyof RoleConfig; roleConfig: RoleConfig
    onToggle: (key: keyof RoleConfig, role: Role) => void
}) {
    return (
        <div>
            <p className="text-xs text-gray-400 mb-1">{label}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-1">
                {ALL_ROLES.map(role => (
                    <label key={role} className="flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" checked={roleConfig[configKey].includes(role)}
                            onChange={() => onToggle(configKey, role)} className="w-3.5 h-3.5 accent-violet-500" />
                        <span className={`text-xs font-medium ${ROLE_COLORS[role]}`}>{ROLE_LABELS[role]}</span>
                    </label>
                ))}
            </div>
        </div>
    )
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children, action }: { title: string; children: React.ReactNode; action?: React.ReactNode }) {
    return (
        <div className="px-4 py-4 border-b border-gray-800">
            <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</p>
                {action}
            </div>
            {children}
        </div>
    )
}

// ─── WorkflowCreator ──────────────────────────────────────────────────────────

export default function WorkflowCreator({ onBack }: { onBack: () => void }) {
    // ── Workflow metadata ──────────────────────────────────────────────────
    const [wfName, setWfName] = useState('New Workflow')
    const [initialState, setInitialState] = useState('')
    const [requiredVotes, setRequiredVotes] = useState(2)
    const [roleConfig, setRoleConfig] = useState<RoleConfig>(DEFAULT_ROLE_CONFIG)

    // ── XYFlow state ──────────────────────────────────────────────────────
    const [nodes, setNodes, onNodesChange] = useNodesState<StateNode>([])
    const [edges, setEdges, onEdgesChange] = useEdgesState<TransitionEdge>([])
    const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
    const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null)

    // ── Modal state ───────────────────────────────────────────────────────
    const [stateModal, setStateModal] = useState<{ open: boolean; form: StateFormValue; isEditing: boolean }>
        ({ open: false, form: EMPTY_STATE_FORM, isEditing: false })
    const [transModal, setTransModal] = useState<{ open: boolean; form: TransitionFormValue; isEditing: boolean }>
        ({ open: false, form: EMPTY_TRANS_FORM, isEditing: false })

    // ── Save status ───────────────────────────────────────────────────────
    const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')

    // ── Role config ───────────────────────────────────────────────────────
    function toggleRole(key: keyof RoleConfig, role: Role) {
        setRoleConfig(prev => {
            const arr = prev[key]
            return { ...prev, [key]: arr.includes(role) ? arr.filter(r => r !== role) : [...arr, role] }
        })
    }

    // ── XYFlow handlers ───────────────────────────────────────────────────
    const onConnect = useCallback((connection: Connection) => {
        if (!connection.source || !connection.target) return
        setTransModal({
            open: true, isEditing: false,
            form: { ...EMPTY_TRANS_FORM, source: connection.source, target: connection.target },
        })
    }, [])

    const onNodeClick = useCallback((_: React.MouseEvent, node: StateNode) => {
        setSelectedNodeId(node.id)
        setSelectedEdgeId(null)
    }, [])

    const onEdgeClick = useCallback((_: React.MouseEvent, edge: TransitionEdge) => {
        setSelectedEdgeId(edge.id)
        setSelectedNodeId(null)
    }, [])

    // ── State CRUD ────────────────────────────────────────────────────────
    function openAddState() {
        setStateModal({ open: true, form: EMPTY_STATE_FORM, isEditing: false })
    }

    function openEditState(node: StateNode) {
        setStateModal({
            open: true, isEditing: true,
            form: { id: node.id, label: node.data.label, color: node.data.color, isFinal: node.data.isFinal },
        })
    }

    function submitState(v: StateFormValue) {
        if (stateModal.isEditing) {
            setNodes(prev => prev.map(n =>
                n.id === v.id ? { ...n, data: { label: v.label, color: v.color, isFinal: v.isFinal } } : n
            ))
        } else {
            const newNode: StateNode = {
                id: v.id,
                position: { x: 80 + nodes.length * 220, y: 160 },
                data: { label: v.label, color: v.color, isFinal: v.isFinal },
                style: buildNodeStyle(v.color, v.isFinal, false),
            }
            setNodes(prev => [...prev, newNode])
            if (!initialState) setInitialState(v.id)
        }
        setStateModal(s => ({ ...s, open: false }))
    }

    function deleteState(id: string) {
        setNodes(prev => prev.filter(n => n.id !== id))
        setEdges(prev => prev.filter(e => e.source !== id && e.target !== id))
        if (initialState === id) setInitialState('')
        if (selectedNodeId === id) setSelectedNodeId(null)
    }

    // ── Transition CRUD ───────────────────────────────────────────────────
    function openAddTransition() {
        setTransModal({ open: true, form: EMPTY_TRANS_FORM, isEditing: false })
    }

    function openEditTransition(edge: TransitionEdge) {
        const strokeColor = (edge.style?.stroke as string | undefined) ?? '#94a3b8'
        setTransModal({
            open: true, isEditing: true,
            form: {
                id: edge.id, source: edge.source, target: edge.target,
                event: edge.data?.event ?? '', label: String(edge.label ?? ''),
                guard: edge.data?.guard ?? '', action: edge.data?.action ?? '',
                animated: edge.animated ?? true, edgeType: edge.type ?? '', strokeColor,
            },
        })
    }

    function submitTransition(v: TransitionFormValue) {
        const edgeStyle = { stroke: v.strokeColor }
        const edgeLabelStyle = { fill: v.strokeColor }
        if (transModal.isEditing) {
            setEdges(prev => prev.map(e =>
                e.id === v.id ? {
                    ...e, source: v.source, target: v.target, label: v.label,
                    animated: v.animated, type: v.edgeType || undefined,
                    style: edgeStyle, labelStyle: edgeLabelStyle,
                    data: { event: v.event, guard: v.guard, action: v.action || undefined },
                } : e
            ))
        } else {
            const newEdge: TransitionEdge = {
                id: v.id, source: v.source, target: v.target, label: v.label,
                animated: v.animated, type: v.edgeType || undefined,
                style: edgeStyle, labelStyle: edgeLabelStyle,
                data: { event: v.event, guard: v.guard, action: v.action || undefined },
            }
            setEdges(prev => addEdge(newEdge, prev))
        }
        setTransModal(s => ({ ...s, open: false }))
    }

    function deleteTransition(id: string) {
        setEdges(prev => prev.filter(e => e.id !== id))
        if (selectedEdgeId === id) setSelectedEdgeId(null)
    }

    // ── Derived display nodes (selection highlight) ───────────────────────
    const displayNodes = nodes.map(n => ({
        ...n,
        style: buildNodeStyle(n.data.color, n.data.isFinal, n.id === selectedNodeId),
    }))

    // ── Save ──────────────────────────────────────────────────────────────
    async function handleSave() {
        if (nodes.length === 0) { alert('Add at least one state first.'); return }
        if (!initialState) { alert('Select an initial state in Settings.'); return }
        setSaveStatus('saving')
        try {
            const def: WorkflowDefinition = {
                name: wfName,
                initialState,
                requiredVotes,
                roleConfig,
                states: nodes.map(n => ({
                    id: n.id, label: n.data.label, color: n.data.color,
                    isFinal: n.data.isFinal, position: n.position,
                })),
                transitions: edges.map(e => ({
                    id: e.id, source: e.source, target: e.target,
                    event: e.data?.event ?? '', label: String(e.label ?? e.data?.event ?? ''),
                    guard: e.data?.guard ?? '', action: e.data?.action,
                    animated: e.animated ?? true, type: e.type,
                    style: e.style ? { stroke: String(e.style.stroke ?? '') } : undefined,
                    labelStyle: e.labelStyle
                        ? { fill: String((e.labelStyle as Record<string, unknown>).fill ?? '') }
                        : undefined,
                })),
            }
            await saveWorkflow(def)
            setSaveStatus('saved')
            setTimeout(() => setSaveStatus('idle'), 2500)
        } catch {
            setSaveStatus('error')
            setTimeout(() => setSaveStatus('idle'), 3000)
        }
    }

    const stateIds = nodes.map(n => n.id)

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col h-screen bg-gray-950 text-gray-100 overflow-hidden">

            {/* ── Top bar ──────────────────────────────────────────────────── */}
            <div className="flex items-center gap-3 px-5 py-3 bg-gray-900 border-b border-gray-800 shrink-0">
                <button onClick={onBack} className="text-gray-400 hover:text-white transition-colors text-sm shrink-0">
                    ← Back
                </button>
                <span className="text-gray-700">|</span>
                <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 shrink-0">
                    Workflow Creator
                </span>
                <input
                    value={wfName}
                    onChange={e => setWfName(e.target.value)}
                    className="ml-1 px-3 py-1.5 rounded-lg text-sm bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-violet-500 w-56"
                    placeholder="Workflow name"
                />
                <div className="ml-auto">
                    <button
                        onClick={handleSave}
                        disabled={saveStatus === 'saving'}
                        className={`px-5 py-1.5 rounded-lg text-sm font-medium transition-all ${saveStatus === 'saved' ? 'bg-green-700 text-white' :
                                saveStatus === 'error' ? 'bg-red-800 text-white' :
                                    saveStatus === 'saving' ? 'bg-gray-700 text-gray-400 cursor-not-allowed' :
                                        'bg-violet-700 hover:bg-violet-600 text-white'
                            }`}
                    >
                        {saveStatus === 'saving' ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : saveStatus === 'error' ? 'Error' : 'Save Workflow'}
                    </button>
                </div>
            </div>

            {/* ── Body ─────────────────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── Left sidebar ─────────────────────────────────────────── */}
                <div className="w-72 bg-gray-900 border-r border-gray-800 flex flex-col overflow-y-auto shrink-0">

                    {/* Settings */}
                    <Section title="Settings">
                        <div className="flex flex-col gap-3">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Initial state</label>
                                <select value={initialState} onChange={e => setInitialState(e.target.value)}
                                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500">
                                    <option value="">— select —</option>
                                    {stateIds.map(id => <option key={id} value={id}>{id}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Required votes</label>
                                <input type="number" min={1} value={requiredVotes} onChange={e => setRequiredVotes(Number(e.target.value))}
                                    className="w-full px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-white focus:outline-none focus:border-violet-500" />
                            </div>
                            <div className="flex flex-col gap-2.5">
                                <p className="text-xs text-gray-400 font-medium">Role permissions</p>
                                <RoleConfigGroup label="Can Submit" configKey="submitRoles" roleConfig={roleConfig} onToggle={toggleRole} />
                                <RoleConfigGroup label="Can Vote / Reject" configKey="voteRoles" roleConfig={roleConfig} onToggle={toggleRole} />
                                <RoleConfigGroup label="Can Pay" configKey="payRoles" roleConfig={roleConfig} onToggle={toggleRole} />
                            </div>
                        </div>
                    </Section>

                    {/* States */}
                    <Section title={`States (${nodes.length})`} action={
                        <button onClick={openAddState}
                            className="text-xs px-2.5 py-1 rounded bg-violet-800 hover:bg-violet-700 text-white font-medium transition-colors">
                            + Add
                        </button>
                    }>
                        {nodes.length === 0
                            ? <p className="text-xs text-gray-600 italic">No states yet.</p>
                            : (
                                <div className="flex flex-col gap-1.5">
                                    {nodes.map(n => (
                                        <div key={n.id}
                                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${selectedNodeId === n.id ? 'border-violet-500 bg-violet-900/20' : 'border-gray-800 hover:border-gray-600'}`}
                                            onClick={() => { setSelectedNodeId(n.id); setSelectedEdgeId(null) }}
                                        >
                                            <span style={{ background: n.data.color }} className="w-3 h-3 rounded-full shrink-0" />
                                            <span className="text-xs text-gray-200 flex-1 truncate">{n.data.label}</span>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {n.data.isFinal && <span className="text-xs text-gray-500 font-mono">fin</span>}
                                                {initialState === n.id && <span className="text-xs text-violet-400 font-mono">init</span>}
                                                <button onClick={e => { e.stopPropagation(); openEditState(n) }}
                                                    className="text-gray-500 hover:text-white text-xs px-1 transition-colors" title="Edit">✎</button>
                                                <button onClick={e => { e.stopPropagation(); deleteState(n.id) }}
                                                    className="text-gray-500 hover:text-red-400 text-xs px-1 transition-colors" title="Delete">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        }
                    </Section>

                    {/* Transitions */}
                    <Section title={`Transitions (${edges.length})`} action={
                        <button onClick={openAddTransition}
                            className="text-xs px-2.5 py-1 rounded bg-violet-800 hover:bg-violet-700 text-white font-medium transition-colors">
                            + Add
                        </button>
                    }>
                        {edges.length === 0
                            ? <p className="text-xs text-gray-600 italic">No transitions. Draw connections on the canvas or click + Add.</p>
                            : (
                                <div className="flex flex-col gap-1.5">
                                    {edges.map(e => (
                                        <div key={e.id}
                                            className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border cursor-pointer transition-all ${selectedEdgeId === e.id ? 'border-violet-500 bg-violet-900/20' : 'border-gray-800 hover:border-gray-600'}`}
                                            onClick={() => { setSelectedEdgeId(e.id); setSelectedNodeId(null) }}
                                        >
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-gray-300 truncate">{e.source} → {e.target}</p>
                                                <p className="text-xs text-gray-500 truncate font-mono">{e.data?.event}</p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                <button onClick={ev => { ev.stopPropagation(); openEditTransition(e) }}
                                                    className="text-gray-500 hover:text-white text-xs px-1 transition-colors" title="Edit">✎</button>
                                                <button onClick={ev => { ev.stopPropagation(); deleteTransition(e.id) }}
                                                    className="text-gray-500 hover:text-red-400 text-xs px-1 transition-colors" title="Delete">✕</button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )
                        }
                    </Section>

                    {/* Tip */}
                    <div className="px-4 py-4 mt-auto">
                        <p className="text-xs text-gray-600">
                            Tip: drag from a node handle to another node to quickly add a transition.
                            Press <kbd className="text-gray-500">Delete</kbd> to remove selected elements.
                        </p>
                    </div>
                </div>

                {/* ── Canvas ───────────────────────────────────────────────── */}
                <div className="flex-1 relative">
                    {nodes.length === 0 && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none z-10 gap-2">
                            <p className="text-gray-600 text-sm">Add your first state to get started</p>
                            <p className="text-gray-700 text-xs">Use the States panel on the left</p>
                        </div>
                    )}
                    <ReactFlow
                        nodes={displayNodes}
                        edges={edges}
                        onNodesChange={onNodesChange}
                        onEdgesChange={onEdgesChange}
                        onConnect={onConnect}
                        onNodeClick={onNodeClick}
                        onEdgeClick={onEdgeClick}
                        onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null) }}
                        fitView
                        deleteKeyCode="Delete"
                    >
                        <Background color="#334155" gap={20} />
                        <Controls />
                        <MiniMap
                            nodeColor={n => (n.data as StateData).color ?? '#475569'}
                            style={{ background: '#1e293b' }}
                            maskColor="rgba(15,23,42,0.7)"
                        />
                    </ReactFlow>
                </div>
            </div>

            {/* ── Modals ───────────────────────────────────────────────────── */}
            {stateModal.open && (
                <Modal title={stateModal.isEditing ? 'Edit State' : 'Add State'}
                    onClose={() => setStateModal(s => ({ ...s, open: false }))}>
                    <StateForm initial={stateModal.form} isEditing={stateModal.isEditing}
                        existingIds={stateIds} onSubmit={submitState}
                        onCancel={() => setStateModal(s => ({ ...s, open: false }))} />
                </Modal>
            )}
            {transModal.open && (
                <Modal title={transModal.isEditing ? 'Edit Transition' : 'Add Transition'}
                    onClose={() => setTransModal(s => ({ ...s, open: false }))}>
                    <TransitionForm initial={transModal.form} isEditing={transModal.isEditing}
                        stateIds={stateIds} onSubmit={submitTransition}
                        onCancel={() => setTransModal(s => ({ ...s, open: false }))} />
                </Modal>
            )}
        </div>
    )
}
