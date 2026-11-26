# Bull City Blocks

An original, Durham, NC–themed set-collection card game, plus a lab for testing rule changes by simulation.

- **Spec:** [docs/SPEC.md](docs/SPEC.md)
- **Architecture and diagrams:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **How work gets done (the issue → PR loop):** [docs/WORKFLOW.md](docs/WORKFLOW.md)
- **Proposed first issues:** [docs/BACKLOG.md](docs/BACKLOG.md)

Status: design draft. Workspace scaffold only (M0).

## Development

Requires Node 22 (see `.nvmrc`) and pnpm (the version is pinned in `package.json`; run `corepack enable` to use it).

```sh
pnpm install     # install dependencies and link workspace packages
pnpm lint        # Biome lint + format check (`pnpm format` to fix)
pnpm typecheck   # tsc --build across all packages (strict mode)
pnpm test        # Vitest across packages/*
pnpm sim         # simulation CLI (stub: prints "not implemented")
```

Packages live in `packages/`: `engine` (no runtime deps), `bots` (→ engine) and `sim` (→ engine, bots).
