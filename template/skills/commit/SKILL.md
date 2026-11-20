---
name: commit
description: Create a clean, traceable commit for a verified {{EDITION_NAME}} ticket - self-check the diff, stage only named planned files, write a "<KEY>: <change>" message, and commit only after the developer types CONFIRM COMMIT <KEY> for exactly these staged changes.
model: haiku
---

# commit

Effort: low.

## Steps
1. `sdlc gate <KEY> commit` (stage must be `verified`), `sdlc log <KEY> commit start`.
2. Per repo worktree, **self-check** `git diff`: only files in the impact list, task tests and approved deviations; no debug prints, commented-out code, unused imports, secrets or protected files.
3. **Stage by name:** `git -C <worktree> add <file> <file> ...` (no `.`, `-A` or wildcards — the hook blocks them).
4. **Message:** must match `project.json -> commitMessagePattern` (default `<KEY>: <what changed>`), imperative, under 72 characters, optional short body. No AI attribution trailers unless the project asks for them.
5. Show the staged files and message per repo, then ask the developer to type `CONFIRM COMMIT <KEY>`. The confirmation is bound to exactly what is staged; restaging voids it.
6. After the line: `git -C <worktree> commit -m "<message>"`. If a git hook blocks it, report the reason and go back to `build` or `verify`; never use `--no-verify` or `--amend`.
7. Jira comment with hash and message; `sdlc stage <KEY> committed`; `sdlc log <KEY> commit end "<hash>"`. Next: `pr`.
