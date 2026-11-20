---
name: build
description: Implement a {{EDITION_NAME}} ticket one task at a time, test first, inside the task worktree and the approved impact list; record progress after every task and stop for a deviation when the plan does not fit. Use after tasks, or when verify sends gaps back.
model: sonnet
---

# build

Effort: medium. Use Opus when the ticket has risk triggers on the full track (`core/models.md`). Discipline adapted from Superpowers `test-driven-development` (MIT).

## Steps
1. `sdlc gate <KEY> build`, `sdlc log <KEY> build start "<task id>"`, `sdlc stage <KEY> building` (first time).
2. Take the next open task from `tasks.md` (or the gap list from `verify-report.md`). Work only in the task worktree.
3. **Test first:** write or extend the test that proves the task; run it and see it fail for the right reason.
4. **Code:** the smallest change that makes it pass, following the repo's `CLAUDE.md`, stack conventions and the design. New config keys follow the stack pack's key rule (template placeholder, settings code, list for the handoff).
5. Run the task's test and the repo's lint or type check on the changed files; fix until green.
6. Mark the task done in `tasks.md`; `sdlc tasks <KEY> <total> <done> <next id>`; `sdlc log <KEY> build end "<task id> done"`.
7. **Does not fit?** (a file outside the impact list, another repo, a different approach, an API or database change): stop, `sdlc deviation add <KEY> "<what and why>" <files...>`, explain, and wait for `APPROVE DEVIATION <KEY> D<n>`. Major deviations go back to `design` as a new version.
8. **Two failed attempts** at the same task: summarise, clear the context, continue one model level up (`core/models.md`).
9. When all tasks are done, hand on to `verify` (the Stop hook reminds you).

## Never
Edit files outside the worktree, impact list or approved deviations; touch foreign dirty files; read protected files; stage or commit (that is `commit`).
