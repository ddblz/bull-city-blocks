# CLAUDE.md

Bull City Blocks is an original, Durham-themed set-collection card game with a rules-simulation lab.

## Read first (and only what you need)
- `docs/SPEC.md`: rules, deck and milestones. This is the source of truth for game behavior.
- `docs/ARCHITECTURE.md`: packages, engine API, flows and invariants.
- `docs/WORKFLOW.md`: the issue → PR loop and guardrails.

## Hard rules
1. Work only on an issue labeled `ready`, and do only what it says. If you find something else, note it in the PR under "Follow-ups". Don't fix it.
2. Never push to `main`, merge a PR or approve a PR.
3. The engine (`packages/engine`) stays pure: no I/O, no `Date`, no `Math.random`. Use the seeded RNG in state.
4. Don't add or upgrade dependencies unless the issue has the `deps-approved` label.
5. Keep PRs under 400 changed lines, excluding lockfiles, `content/`, `reports/`, `docs/`, test files (`*.test.ts`), fixtures (`fixtures/`, `__fixtures__/`) and stylesheets (`*.css`). If an issue won't fit, stop and comment asking to split it.
6. A behavior change to the rules requires a matching update to `docs/SPEC.md` in the same PR.
7. A `variant` issue requires `reports/<variant-id>.md`, produced by `pnpm sim` with 10,000 games against `base`.
8. If CI fails twice after your fixes, stop. Comment `blocked:` with your diagnosis.
9. Use original card names, text and art only. Don't use another game's name or marks, and don't use Durham business names or logos.

## Commands
- `pnpm install`, `pnpm test`, `pnpm lint`, `pnpm typecheck`
- `pnpm sim --base base --variant <id> --games 10000`

These become available after milestone M0.

## Conventions
- TypeScript strict mode. Prefer small pure functions. Use `Move` and `GameEvent` discriminated unions.
- Tests sit next to code (`*.test.ts`). Every rule in SPEC §3–4 gets at least one test that names the section, e.g. `it("§3.3 no change is given")`.
- Commit messages use the form `<area>: <what>`, e.g. `engine: implement Buyout`.
