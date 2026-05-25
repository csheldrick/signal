# Plugin Runtime

The plugin runtime must remain sandboxed from core storage internals.

## Requirements

- Plugins cannot directly access the storage layer
- Plugin API surface is explicit and versioned
- Plugins run in isolation (separate context, no shared mutable state)
- Core functionality works without any plugins loaded
- Plugin lifecycle (install, enable, disable, uninstall) is managed by the core

## Loom/Weave implications

- Loom can detect plugin boundary violations via its dependency graph analysis
  (e.g., a plugin importing from `core/storage/` would appear as a `depends_on` edge
  crossing the subsystem boundary)
- Weave can track plugin health via execution results — failed plugin operations
  create `execution_failure` tensions at the relevant nodes
