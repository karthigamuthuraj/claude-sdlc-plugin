# Lifecycle (read by every skill)

One Jira ticket = one controlled, traceable delivery. Every skill does one step, writes its document under the ticket folder, updates Jira through `sync`, and stops at its gate.

## Paths used in every skill

- `<plugin>`: the folder two levels above the skill's `SKILL.md`.
- `<ws>`: the workspace root (the folder holding `.sdlc/project.json`). Run commands from there.
- `sdlc`: `node <plugin>/scripts/sdlc.mjs` (the deterministic half of every skill).
- `jira`: `node <plugin>/adapters/tracker/jira.mjs` (fallback when the Atlassian connector cannot write).
- `<ticket>`: `<ws>/.sdlc/tickets/<KEY>/` (or `project.json -> ticketDir`).
- `/{{EDITION_NAME}}:<skill>`: how a developer runs a skill.

## Command placeholders

Commands in `project.json` may use: `{files}` (test files, space-separated, relative to the repo or subproject), `{filter}` (test name filter), `{file}` (absolute path of one file), `{wsfile}` (that file relative to the workspace root, for tools that run inside a container), `{reldir}` (the working folder — repo or task worktree — relative to the workspace root). Substitute them before running.

## Custom tracks and steps

A project or edition can add tracks and steps (`project.json -> lifecycle`, `custom/lifecycle.json`; see `CUSTOMIZING.md`). Always take the order from `sdlc flow <KEY>` and the next step from `sdlc next <KEY>`, never from the built-in lists below. `step <name>` means: run the `step` skill for that project step. Required custom steps block later built-in skills (`sdlc gate` exit 4) until `sdlc step-done` records them.

## Tracks

| Track | Steps |
|---|---|
| quick | pickup → tasks → build → verify → commit → pr → handoff → review |
| standard | pickup → analyze + design (one `brief.md`) → kickoff → tasks → build → verify → commit → pr → handoff → review → qa-handover |
| full | pickup → analyze → design → kickoff → tasks → build → verify → commit → pr → handoff → review → qa-handover |
| bug | pickup → logs → rca → analyze + design (`bugfix.md` + fix design in `brief.md`) → kickoff → … → qa-handover |
| hotfix | pickup → logs → rca → tasks → build → verify → commit → pr (release/hotfix branch) → handoff → expedited review → qa-handover (smoke test) |

`resolve` runs whenever a PR conflicts. `sync` runs under every step. `sdlc next <KEY>` prints the next skill.

## Stages

`picked_up` → `investigated` → `analyzed` → `designed` → `kicked_off` → `tasks_ready` → `building` → `verified` → `committed` → `pr_open` → `handed_off` → `reviewed` → `qa_handed_over`

## Rules every skill follows

1. **Start:** `sdlc use <KEY>`, `sdlc get <KEY>`, `sdlc gate <KEY> <skill>`, then `sdlc log <KEY> <skill> start "<what>"`. If the gate fails, report its message and stop.
2. **Read before writing:** steering (`<ws>/.sdlc/steering/*.md`), the root and repo `CLAUDE.md` / `AGENTS.md` files of every repo you touch, and the ticket's earlier documents.
3. **Templates:** copy from `<ws>/.sdlc/templates/<name>` if it exists, else `<plugin>/templates/<name>`. Append `<ws>/.sdlc/checklists/<name>` to the core checklist of the same name.
4. **Extensions:** run `<ws>/.sdlc/extensions/<skill>.before.md` first and `<skill>.after.md` last, if present.
5. **Gates are typed by people.** Never write an approval or confirmation yourself; the hook records only lines the developer types.
6. **Jira:** every write goes through the `sync` skill rules (redaction, human-only statuses, queue on failure).
7. **Finish:** `sdlc stage <KEY> <stage>`; if `project.json -> tracker.transitionsBySkill.<this skill>` is set, move the Jira ticket to that status through `sync`; `sdlc log <KEY> <skill> end "<result>"`; tell the developer the next skill.
8. **Never:** merge, approve a PR, force-push, read or edit protected files, move a ticket to a human-only status, or bypass a hook.
