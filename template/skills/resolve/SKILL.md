---
name: resolve
description: Resolve merge conflicts between a {{EDITION_NAME}} task branch and its parent safely - explain each conflicting hunk and what both sides intended, propose resolutions that keep both intents, apply only what the developer agrees, then re-verify and push.
model: opus
---

# resolve

Effort: high. Merging and rebasing are human-only: the developer runs the update command; this skill resolves the resulting conflicts.

## Steps
1. `sdlc log <KEY> resolve start`. Ask the developer to bring the parent into the task branch the way the team does it (for example `git merge origin/<parent> -m "<KEY>: merge <parent>"` in the worktree; the commit-msg hook needs the key) — the hook blocks Claude from running merge or rebase.
2. List conflicted files (`git -C <worktree> diff --name-only --diff-filter=U`).
3. For each hunk: what our side intended (from the design and tasks), what their side intended (`git log` on the parent for those lines), and a proposed resolution that keeps both. Flag any that cannot keep both.
4. Apply each resolution only after the developer agrees; never drop another person's change silently.
5. Run `verify` for the touched areas; then `commit` (the merge commit message starts with the key) and `pr` push, each with its confirmation line.
6. Jira comment if the resolution changed behaviour; `sdlc log <KEY> resolve end`.
