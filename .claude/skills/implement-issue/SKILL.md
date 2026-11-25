---
name: implement-issue
description: Implement one owner-approved GitHub issue end to end and open a PR. Use when the owner says /implement-issue N.
---

# Implement issue N

1. `gh issue view N`. **Stop** if the issue does not have the `ready` label. Tell the owner, and do nothing else.
2. Label it `in-progress`. Create branch `issue-N-<slug>` from the latest `main`.
3. Read `CLAUDE.md`, then only the docs sections the issue references.
4. Implement with tests. Run `pnpm lint && pnpm typecheck && pnpm test` locally before pushing.
5. If the issue has the `variant` label: run `pnpm sim --base base --variant <id> --games 10000` and commit `reports/<id>.md`.
6. Check the diff size with `git diff --stat main`. If it is over 400 lines, excluding lockfiles, `content/`, `reports/` and fixtures, stop and comment on the issue asking to split it.
7. Push, then open a PR with `.github/pull_request_template.md`. The PR must say `Closes #N`.
8. Wait for CI. On failure, fix and push, **at most 2 times**. If it still fails, comment `blocked: <diagnosis>`, add the `blocked` label and stop.
9. Never merge, never approve, never push to `main`.
