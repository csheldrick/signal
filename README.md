# Signal

A local-first collaborative knowledge workspace with evolving architecture.

## Recommended Greenfield Layout

```text
signal/
├─ app/
├─ workspace/
├─ .loom/
├─ .weave/
└─ docs/
```

## Application Code (`app/`)

```text
app/
├─ src/
│  ├─ core/
│  ├─ sync/
│  ├─ storage/
│  ├─ editor/
│  ├─ graph/
│  ├─ ai/
│  ├─ plugins/
│  └─ ui/
├─ tests/
├─ package.json
└─ tsconfig.json
```

## Workspace Cognition Inputs (`workspace/`)

```text
workspace/
├─ goals/
│  ├─ local-first.md
│  ├─ realtime-sync.md
│  └─ plugin-runtime.md
├─ architecture/
│  ├─ decisions/
│  ├─ experiments/
│  └─ constraints/
├─ tasks/
├─ observations/
└─ history/
```

## Loom / Weave Runtime State

```text
.loom/
├─ topology/
├─ snapshots/
├─ semantic/
├─ abstractions/
├─ evolution/
├─ tensions/
└─ config.json

.weave/
├─ state/
│  ├─ snapshots/
│  ├─ traces/
│  └─ runs/
├─ injections/
├─ observations/
├─ activation/
├─ tensions/
└─ config.json
```

## Suggested Development Flow

```bash
# initialize project (pnpm can be installed externally)
mkdir signal
cd signal
pnpm init
mkdir app workspace

# initialize architecture topology
loom onboard

# initialize persistent cognition runtime
weave init
weave run

# inject goals/constraints
weave inject --type goal "support offline-first collaboration"
weave inject --type constraint "all sync operations must be eventually consistent"
weave inject --type architecture "plugin system must remain sandboxed"

# evolve + observe + execute
loom scan
weave tick --n 50
weave observe tensions
utilis run scaffold sync-engine
```

The app remains normal software engineering code. Loom and Weave provide persistent structural and runtime cognition layers around it.
