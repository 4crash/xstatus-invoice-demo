import { useCallback, useMemo, useState } from 'react'
import ReactFlow, {
    applyNodeChanges,
    Background,
    Controls,
    type Edge,
    type Node,
    type NodeChange,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { REQUIRED_VOTES } from './invoiceMachine'

const STATE_CONFIG: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: '#475569' },
    pending_review: { label: 'Pending Review', color: '#b45309' },
    approved: { label: 'Approved', color: '#15803d' },
    paid: { label: 'Paid', color: '#1d4ed8' },
}

interface Props {
    currentState: string
    votes: string[]
}

const initialNodes: Node[] = [
    { id: 'draft', position: { x: 30, y: 80 }, data: { label: 'Draft' } },
    { id: 'pending_review', position: { x: 230, y: 80 }, data: { label: 'Pending Review' } },
    { id: 'approved', position: { x: 470, y: 80 }, data: { label: 'Approved' } },
    { id: 'paid', position: { x: 680, y: 80 }, data: { label: 'Paid' } },
]

const edges: Edge[] = [
    {
        id: 'e-submit',
        source: 'draft', target: 'pending_review',
        label: 'SUBMIT\n(Accountant)',
        animated: true,
    },
    {
        id: 'e-approve',
        source: 'pending_review', target: 'approved',
        label: `VOTE ×${REQUIRED_VOTES}\n(Mgr / CFO)`,
        animated: true,
    },
    {
        id: 'e-reject',
        source: 'pending_review', target: 'draft',
        label: 'REJECT',
        animated: false,
        type: 'step',
        style: { stroke: '#ef4444' },
        labelStyle: { fill: '#ef4444' },
    },
    {
        id: 'e-pay',
        source: 'approved', target: 'paid',
        label: 'PAY\n(Accountant)',
        animated: true,
    },
]

export default function InvoiceFlowChart({ currentState, votes }: Props) {
    const [nodes, setNodes] = useState<Node[]>(initialNodes)

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => setNodes(nds => applyNodeChanges(changes, nds)),
        [],
    )

    const coloredNodes = useMemo(
        () =>
            nodes.map(n => {
                const cfg = STATE_CONFIG[n.id]
                const isActive = n.id === currentState
                const label =
                    n.id === 'pending_review'
                        ? `${cfg.label} (${votes.length}/${REQUIRED_VOTES})`
                        : cfg.label

                return {
                    ...n,
                    data: { label },
                    style: {
                        background: cfg.color,
                        border: isActive ? '3px solid #fff' : '1px solid rgba(255,255,255,0.15)',
                        borderRadius: 8,
                        color: '#fff',
                        fontWeight: isActive ? 700 : 400,
                        opacity: isActive ? 1 : 0.5,
                        boxShadow: isActive ? `0 0 0 5px ${cfg.color}55` : 'none',
                        minWidth: 130,
                        padding: '10px 16px',
                    },
                }
            }),
        [nodes, currentState, votes],
    )

    return (
        <div style={{ width: '100%', height: 400 }}>
            <ReactFlow
                nodes={coloredNodes}
                edges={edges}
                onNodesChange={onNodesChange}
                fitView
            >
                <Background color="#334155" gap={20} />
                <Controls />
            </ReactFlow>
        </div>
    )
}
