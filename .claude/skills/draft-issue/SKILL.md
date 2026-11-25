---
name: draft-issue
description: Turn the owner's idea into a well-specified GitHub issue (labeled draft) for owner approval. Use when the owner says /draft-issue or asks to write an issue.
---

# Draft an issue

Input: the owner's idea, given in `$ARGUMENTS` or in chat.

1. Read only the parts of `docs/SPEC.md` and `docs/ARCHITECTURE.md` that the idea touches. Check open issues with `gh issue list --state open` to avoid duplicates.
2. Ask the owner **at most 3** clarifying questions, and only ones whose answers change the issue. Otherwise state your assumptions.
3. Decide whether it is a feature or a rule variant. For a variant, write a **falsifiable hypothesis** about the simulation metrics in SPEC §6.
4. Size it. If it is bigger than M (~400 lines), split it into several issues that can each be implemented on their own, and say what order they go in.
5. Write the issue body using the matching template in `.github/ISSUE_TEMPLATE/`. Acceptance criteria must be checkable, and the test plan must name concrete tests.
6. Show the draft to the owner in chat. Create it **only after the owner says to**: `gh issue create --label draft --label size:<S|M> [--label variant]`.
7. Never add the `ready` label. Only the owner does that.
