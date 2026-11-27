---
name: implement-issue
description: Implement one owner-approved GitHub issue end to end and open a PR. Use when the owner says /implement-issue N.
---

# Implement issue N

> GitHub GraphQL is unavailable in cloud sessions, so use the REST API through `gh api`.

1. Read the issue with `gh api repos/{owner}/{repo}/issues/N --jq '{title, body, labels: [.labels[].name]}'`. **Stop** if it does not have the `ready` label. Tell the owner, and do nothing else.
2. Add the `in-progress` label: `gh api repos/{owner}/{repo}/issues/N/labels -f 'labels[]=in-progress'`. Create branch `issue-N-<slug>` from the latest `origin/main`.
3. Read `CLAUDE.md`, then only the docs sections the issue references.
4. Implement with tests. Run `pnpm lint && pnpm typecheck && pnpm test` locally before pushing.
5. If the issue has the `variant` label: run `pnpm sim --base base --variant <id> --games 10000` and commit `reports/<id>.md`.
6. Check the diff size with `git diff --stat origin/main`. If it is over 400 lines, excluding lockfiles, `content/`, `reports/`, `docs/`, test files, fixtures and `*.css`, stop and comment on the issue asking to split it.
7. Push the branch with `git push -u origin issue-N-<slug>`, then open a PR: `gh api repos/{owner}/{repo}/pulls -f title='…' -f head=issue-N-<slug> -f base=main -F body=@<file>`. Fill in the body from `.github/pull_request_template.md`, and it must say `Closes #N`.
8. Wait for CI: `gh api repos/{owner}/{repo}/commits/<sha>/check-runs --jq '.check_runs[] | "\(.name) \(.status) \(.conclusion)"'`. On failure, fix and push, **at most 2 times**. If it still fails, comment `blocked: <diagnosis>` with `gh api repos/{owner}/{repo}/issues/N/comments -F body=@<file>`, add the `blocked` label and stop.
9. Never merge, never approve, never push to `main`.
