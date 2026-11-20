---
name: tasks
description: Break a {{EDITION_NAME}} ticket's kickoff checklist (or a quick or hotfix fix) into small, ordered, verifiable tasks with files, tests, covered acceptance criteria and dependencies, grouped into waves, and check that every criterion is covered.
model: sonnet
---

# tasks

Effort: medium. Method adapted from Superpowers `writing-plans` (MIT).

## Steps
1. `sdlc gate <KEY> tasks`, `sdlc log <KEY> tasks start`.
2. **Quick and hotfix tracks:** create the branch now if not created (`git worktree add -b` as in kickoff) and write one or two tasks from the ticket and `rca.md`.
3. **Other tracks:** split each kickoff step into tasks of about one commit: id, repo, exact files, the test that proves it (file or node id), criteria covered, dependencies.
4. **Waves:** group tasks with no dependency between them; order waves by dependency and landing order.
5. **Consistency check:** every AC has at least one task; every task traces to the design; no file outside the impact list (`sdlc get <KEY> impact`); tests named for every behaviour change.
6. Write `<ticket>/tasks.md`; `sdlc tasks <KEY> <total> 0 T1`; Jira comment with the task list (optional sub-tasks if `project.json` enables them); `sdlc stage <KEY> tasks_ready`; `sdlc log <KEY> tasks end "<n> tasks"`. Next: `build`.
