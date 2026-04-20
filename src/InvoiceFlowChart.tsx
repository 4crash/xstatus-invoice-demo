import {
    applyNodeChanges,
    Background,
    Controls,
    ReactFlow,
    type Edge,
    type Node,
    type NodeChange,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_WORKFLOW_DEFINITION, type WorkflowDefinition } from './workflowSchema'

interface Props {
    currentState: string
    votes: string[]
    /** Full workflow definition. Defaults to the hardcoded invoice machine. */
    definition?: WorkflowDefinition
    /**
     * Called whenever node positions change (drag, etc.).
     * Parent stores this for serialization when saving.
     */
    onPositionsChange?: (positions: Record<string, { x: number; y: number }>) => void
}

export default function InvoiceFlowChart({
    currentState,
    votes,
    definition = DEFAULT_WORKFLOW_DEFINITION,
    onPositionsChange,
}: Props) {
    // Initialise nodes from the definition's stored positions.
    const [nodes, setNodes] = useState<Node[]>(() =>
        definition.states.map(s => ({
            id: s.id,
            position: s.position,
            data: { label: s.label },
        }))
    )

    // When a new definition is loaded (e.g. after a DB load), reset positions.
    useEffect(() => {
        setNodes(
            definition.states.map(s => ({
                id: s.id,
                position: s.position,
                data: { label: s.label },
            }))
        )
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [definition.id, definition.states.length])

    const onNodesChange = useCallback(
        (changes: NodeChange[]) => {
            setNodes(nds => {
                const updated = applyNodeChanges(changes, nds)
                onPositionsChange?.(
                    Object.fromEntries(updated.map(n => [n.id, n.position]))
                )
                return updated
            })
        },
        [onPositionsChange],
    )

    // Build a lookup: state id → definition metadata
    const stateMap = useMemo(
        () => Object.fromEntries(definition.states.map(s => [s.id, s])),
        [definition.states],
    )

    // Apply active/inactive visual styling to each node.
    const coloredNodes = useMemo(
        () =>
            nodes.map(n => {
                const cfg = stateMap[n.id]
                if (!cfg) return n
                const isActive = n.id === currentState
                const label =
                    n.id === 'pending_review'
                        ? `${cfg.label} (${votes.length}/${definition.requiredVotes})`
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
        [nodes, currentState, votes, stateMap, definition.requiredVotes],
    )

    // Derive edges from the definition's transitions.
    const edges: Edge[] = useMemo(
        () =>
            definition.transitions.map(t => ({
                id: t.id,
                source: t.source,
                target: t.target,
                label: t.label,
                animated: t.animated,
                type: t.type,
                style: t.style,
                labelStyle: t.labelStyle,
            })),
        [definition.transitions],
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
