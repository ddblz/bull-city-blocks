---
name: review-pr
description: Review a PR against its issue and the spec, and post review comments for the owner. Use when the owner says /review-pr N.
---

# Review PR N

Run this in a fresh session, not the one that wrote the code.

> GitHub GraphQL is unavailable in cloud sessions, so use the REST API through `gh api`.

1. Read the PR with `gh api repos/{owner}/{repo}/pulls/N --jq '{title, body, head: .head.ref}'`. Get the diff by checking out the branch and running `git diff origin/main...HEAD`. Read the linked issue as well.
2. Check against the issue: is every acceptance criterion met and tested? Is anything included that the issue didn't ask for?
3. Check against the spec: do rules match `docs/SPEC.md`? If a rule changed, was SPEC updated in the same PR?
4. Check the architecture: is the engine still pure? Do package dependencies still point one way? Is anything new from `package.json` without `deps-approved`?
5. Check correctness: run `/code-review medium` on the branch for bugs.
6. For variants: does the simulation report exist? Was it run with 10,000 games on paired seeds? Does the PR's conclusion match the confidence intervals?
7. Post one review: `gh api repos/{owner}/{repo}/pulls/N/reviews -f event=COMMENT -F body=@<file>`. **Never use event=APPROVE.** Put a short verdict for the owner at the top, for example "Looks mergeable: 0 blocking, 2 nits" or "Needs changes: 1 blocking". Follow it with findings ranked by severity, each with a file and line.
