# Invoice Approval Workflow — XState Demo

An interactive demo of a role-based invoice approval workflow modelled as an XState v5 state machine, built with React, TypeScript, and Vite.

---

## App Logic

### State Machine (`invoiceMachine.ts`)

The workflow has four states:

| State | Description |
|---|---|
| `draft` | Initial state. Invoice is being prepared. |
| `pending_review` | Submitted and awaiting approval votes. |
| `approved` | Quorum of votes reached; ready for payment. |
| `paid` | Final state. Invoice fully processed. |

**Transitions:**

```
draft ──SUBMIT──▶ pending_review ──VOTE×2──▶ approved ──PAY──▶ paid (final)
                        │
                      REJECT
                        │
                        ▼
                      draft
```

- `SUBMIT` — moves `draft → pending_review`. Guard: only **accountants** may submit.
- `VOTE_APPROVE` — records a vote from the active user.
  - If quorum is not yet reached, the machine stays in `pending_review`.
  - If this vote reaches the required quorum (2 votes), it transitions to `approved`.
- `REJECT` — moves `pending_review → draft` and clears all recorded votes. Guard: **managers** or **CFOs** only.
- `PAY` — moves `approved → paid`. Guard: only **accountants** may pay.

### Business Rules / Guards (`guards.ts`)

Guards are pure functions with no XState dependency, making them independently testable:

| Guard | Logic |
|---|---|
| `canSubmitInvoice(role)` | Returns `true` only for `accountant`. |
| `canVoteOnInvoice(role)` | Returns `true` for `manager` or `cfo`. |
| `canPayInvoice(role)` | Returns `true` only for `accountant`. |
| `hasAlreadyVoted(votes, userId)` | Returns `true` if the user's ID is already in the votes array. |
| `quorumReached(votes, newVoterId, required)` | Returns `true` if adding the new voter would meet or exceed `required` (default 2). |

### Roles & Users

Three hard-coded demo users cover all three roles:

| User | Role |
|---|---|
| Carl Calculator | Accountant |
| Randal Ruler | Manager |
| Karl King | CFO |

The active user is selected via a toggle in the UI. All events are dispatched with the active user's `role` and `userId`, which the guards use to decide whether an action is permitted.

### UI Components

- **`InvoiceDemo.tsx`** — Main component. Renders the user selector, the invoice card (ID, vendor, amount, status badge), the approval vote tracker, and the available action buttons. Buttons are disabled with an explanation tooltip when the active user lacks permission.
- **`InvoiceFlowChart.tsx`** — A live React Flow diagram showing the four states as draggable nodes and the five transitions as labelled edges. The active state is highlighted with a white border and full opacity; inactive states are dimmed.

---

## Tech Stack

- [XState v5](https://stately.ai/docs) — state machine and guards
- [@xstate/react](https://stately.ai/docs/xstate-react) — `useMachine` hook
- [React Flow](https://reactflow.dev) — interactive state diagram
- React 19 + TypeScript + Vite

## React + TypeScript + Vite (template notes)

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

