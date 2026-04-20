# BPMN → XState Migration Guide

## How BPMN is currently used in linkinq

### 1. Server-side process engine (`bpmn-server`)

Located in `src/lib/bpmn-web/`. This is the core workflow runtime.

| File | Role |
|---|---|
| `configuration.ts` | Bootstraps `BPMNServer` with DB stores, delegate, script handler, cache |
| `appDelegate.ts` | Extends `DefaultAppDelegate` — handles service task resolution, detects hung items on startup |
| `appServices.ts` | Implements service task handlers (e.g. `echo`, `getSupervisorUser`) called from BPMN scripts |
| `appUtils.ts` | Helpers for user resolution, email notifications triggered by tasks |
| `routes.ts` | Express routes: start instance, get instance by item ID, get node form fields, execute task |
| `datastore/` | Custom MongoDB-backed `ModelsDatastore` (process definitions) and `DataStore` (execution state with save points) |

Key runtime behaviors:
- Processes are loaded as XML `.bpmn` files from DB (`ModelsDatastore`)
- Execution state is persisted per-instance in MongoDB (`DataStore` with save points)
- `BPMNAPI` exposes `start`, `invoke`, `signal` operations via routes
- `Behaviour_names.CamundaFormData` is used to extract form field definitions from task nodes
- Cron-based timer support via `timers.precision`

### 2. BPMN process definitions (`.bpmn` XML)

Stored in `src/configurations/processes/` and in the DB (`wf_models` entity).

Custom `linkinq:` namespace extends standard BPMN elements:

| Attribute | Scope | Meaning |
|---|---|---|
| `linkinq:entity` | `<bpmn:process>` | Which DB entity/table this workflow manages |
| `linkinq:filter` | `<bpmn:process>` | JSON filter applied to fetch records |
| `linkinq:default` | `<bpmn:process>` | Whether this is the default workflow for the entity |
| `linkinq:style` | `<bpmn:userTask>` | CSS style object for the node in the visual editor |
| `linkinq:updateFields` | `<bpmn:userTask>` | DB fields to update when the task is entered (e.g. `{"status": "Assign", "assignee": "$user"}`) |
| `camunda:formKey` | `<bpmn:userTask>` | Form action key (identifies which transition to invoke) |
| `camunda:formData` / `camunda:formField` | `extensionElements` | Field definitions shown to user when executing the task |

### 3. Client-side visual editor (`@xyflow/react`)

Located in `src/client/components/BpmnDiagram/`.

| File | Role |
|---|---|
| `helpers/bpmnToReactFlow.tsx` | Converts BPMN JSON → React Flow nodes/edges (`bpmnToReactFlow`) |
| `helpers/bpmnToReactFlow.tsx` | Converts React Flow diagram → BPMN JSON (`reactFlowToBpmnJson`) |
| `utils/xmlJsonParser.ts` | Converts BPMN XML ↔ JSON (`parseXml2Json`, `parseJson2Xml`) |
| `Diagram.tsx` | React Flow canvas for visual editing |
| `customContextPadProvider.ts` | Custom context menu for bpmn-js elements |

The admin Workflow page (`src/client/pages/admin/workflow/`) loads `.bpmn` XML from the DB, converts it to React Flow nodes/edges for editing, and saves back as XML.

---

## Concept mapping: BPMN → XState

| BPMN concept | XState equivalent |
|---|---|
| `<bpmn:process>` | `createMachine({ id, initial, states })` |
| `<bpmn:startEvent>` | `initial` state |
| `<bpmn:endEvent>` | State with `type: 'final'` |
| `<bpmn:userTask>` | State with `on: { EVENT: 'nextState' }` transitions |
| `<bpmn:serviceTask>` | State with `invoke: { src: asyncFn }` |
| `<bpmn:sequenceFlow>` | Transition inside `on: {}` |
| Exclusive gateway | Guards on transitions: `guard: (ctx, evt) => ...` |
| Parallel gateway | `type: 'parallel'` states |
| `camunda:formData` fields | State `meta.fields` or `context` shape |
| `linkinq:updateFields` | `entry` actions: `assign({ status: 'Assign' })` |
| `linkinq:style` | State `meta.style` |
| `linkinq:entity` / `linkinq:filter` | Machine `meta.entity` / `meta.filter` |
| Process instance | XState actor: `createActor(machine, { input })` |
| `DataStore` (execution persistence) | Custom `inspect` + snapshot serialization to DB |
| `ModelsDatastore` (definition loading) | Machine factory loaded from DB JSON |
| `AppDelegate.getServicesProvider` | Actor logic / `fromPromise` implementations |
| `AppServices` methods | Named actors/services invoked from states |
| Timer events | `after: { delay: ms, target: 'nextState' }` |

---

## Migration plan

### Phase 1 — Replace the server-side engine

**1. Define machines in TypeScript instead of BPMN XML**

```ts
// Before (BPMN XML):
// <bpmn:userTask id="Activity_18jjnij" name="Nový"
//   linkinq:updateFields='{"status":"New"}' ...>

// After (XState):
import { createMachine, assign } from 'xstate';

const taskMachine = createMachine({
  id: 'tasks',
  initial: 'New',
  meta: { entity: 'tasks', filter: { kind: 1 }, default: true },
  context: { status: '', assignee: '' },
  states: {
    New: {
      meta: { style: { background: '#4ca6ca' }, formKey: 'move1' },
      entry: assign({ status: 'New' }),
      on: {
        toAssignee: 'Assigned',
        toClose: 'Closed',
      },
    },
    Assigned: {
      meta: { style: { background: 'red' }, formKey: 'move2' },
      entry: assign({ status: 'Assign', assignee: '$user' }),
      on: {
        toPause: 'Paused',
        toClose: 'Closed',
      },
    },
    Closed: { type: 'final' },
  },
});
```

**2. Persist machine snapshots to DB (replace `DataStore`)**

```ts
import { createActor } from 'xstate';

async function startWorkflow(machineId: string, input: object, db: Knex) {
  const machine = await loadMachineFromDB(machineId, db); // replaces ModelsDatastore
  const actor = createActor(machine, { input });

  actor.subscribe(snapshot => {
    db('wf_instances').where({ guid: instanceId }).update({
      snapshot: JSON.stringify(snapshot),
      state: snapshot.value,
    });
  });

  actor.start();
  return actor;
}

async function continueWorkflow(instanceId: string, event: string, db: Knex) {
  const row = await db('wf_instances').where({ guid: instanceId }).first();
  const machine = await loadMachineFromDB(row.machine_id, db);
  const actor = createActor(machine);
  actor.start(JSON.parse(row.snapshot)); // restore from snapshot
  actor.send({ type: event });
}
```

**3. Replace `AppServices` with XState actors (replace service tasks)**

```ts
// Before: AppServices.getSupervisorUser called by bpmn-server script
// After: fromPromise actor invoked from XState state

import { fromPromise } from 'xstate';

const getSupervisorActor = fromPromise(async ({ input }) => {
  return db('users').where({ userName: input.userName }).first();
});

// In machine:
states: {
  FetchingSupervisor: {
    invoke: {
      src: getSupervisorActor,
      input: ({ context }) => ({ userName: context.requester }),
      onDone: { target: 'Assigned', actions: assign({ supervisor: ({ event }) => event.output }) },
      onError: 'Failed',
    },
  },
}
```

**4. Replace `BpmnRoutes` Express routes**

```ts
// Before: bpmnAPI.engine.start(processName, payload, user)
// After:
app.post('/workflow/start', async (req, res) => {
  const actor = await startWorkflow(req.body.machineId, req.body.data, db);
  res.json({ instanceId: actor.id, state: actor.getSnapshot().value });
});

app.post('/workflow/signal', async (req, res) => {
  await continueWorkflow(req.body.instanceId, req.body.event, db);
  res.json({ ok: true });
});
```

---

### Phase 2 — Replace the visual editor

Instead of converting BPMN XML ↔ React Flow, store workflow definitions as JSON (XState machine config) and build a React Flow editor that reads/writes that format directly.

| Current | Replacement |
|---|---|
| `bpmnToReactFlow(xml)` | `xstateMachineToReactFlow(machineConfig)` |
| `reactFlowToBpmnJson(diagram)` | `reactFlowToXstateMachine(nodes, edges)` |
| `parseXml2Json` / `parseJson2Xml` | Not needed — JSON-native |
| `bpmn-js` context pad | Custom React Flow node toolbar |

**Node shape in React Flow:**
```ts
// Each XState state → React Flow node
{
  id: 'Assigned',
  type: 'userTask',           // maps to XState state type
  data: {
    label: 'Přiděleno',
    meta: { style: { background: 'red' }, formKey: 'move2' },
    entry: [{ type: 'assign', params: { status: 'Assign' } }],
  },
}

// Each transition → React Flow edge
{
  id: 'Assigned->Closed',
  source: 'Assigned',
  target: 'Closed',
  data: { event: 'toClose', guard: null },
}
```

---

### Packages to add

```json
"xstate": "^5.x"
```

### Packages to remove after migration

```json
"bpmn-server": "^2.2.13",
"bpmn-js": "^18.12.0",
"camunda-bpmn-moddle": "^7.0.1",
"@bpmn-io/form-js": "^1.19.0",
"fast-xml-parser": "^5.3.3"   // only used for BPMN XML parsing
```

---

## Key risks and considerations

- **bpmn-server uses MongoDB** for the datastore — the current custom `DataStore` wraps this. XState snapshots can be stored in any DB (PostgreSQL via existing `pg`).
- **Camunda form bindings** (`camunda:formData`) are tightly coupled to `bpmn-server`'s `Behaviour_names` API. These need to be reimplemented as XState state `meta`.
- **Timer events** — `bpmn-server` handles BPMN timers via its internal cron. With XState, use `after` delays + your existing `node-cron` for durable timers.
- **Script expressions** — BPMN supports inline scripts (e.g. `#(appServices.getSupervisorUser(this.data.requester))`). These need to be rewritten as explicit TypeScript actors.
- **Existing `.bpmn` process files** need a one-time migration script to convert to XState machine JSON.
