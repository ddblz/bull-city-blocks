---
name: draft-issue
description: Turn the owner's idea into a well-specified GitHub issue (labeled draft) for owner approval. Use when the owner says /draft-issue or asks to write an issue.
---

# Draft an issue

Input: the owner's idea, given in `$ARGUMENTS` or in chat.

> GitHub GraphQL is unavailable in cloud sessions, so use the REST API through `gh api`, not `gh issue …`.

1. Read only the parts of `docs/SPEC.md` and `docs/ARCHITECTURE.md` that the idea touches. Check for duplicates with `gh api 'repos/{owner}/{repo}/issues?state=open&per_page=100' --jq '.[] | "#\(.number) \(.title)"'`.
2. Ask the owner **at most 3** clarifying questions, and only ones whose answers change the issue. Otherwise state your assumptions.
3. Decide whether it is a feature or a rule variant. For a variant, write a **falsifiable hypothesis** about the simulation metrics in SPEC §6.
4. Size it. If it is bigger than M (~400 lines), split it into several issues that can each be implemented on their own, and say what order they go in.
5. Write the body with the same headings as the matching template in `.github/ISSUE_TEMPLATE/`: Why, What, Acceptance criteria, Test plan, Out of scope, Size, New dependencies. Acceptance criteria must be checkable, and the test plan must name concrete tests.
6. Show the draft to the owner in chat. Create it **only after the owner says to**: write the body to a temp file, then run `gh api repos/{owner}/{repo}/issues -f title='…' -F body=@<file> -f 'labels[]=draft' -f 'labels[]=size:S'`. Add `-f 'labels[]=variant'` for variants.
7. Never add the `ready` label. Only the owner does that.
