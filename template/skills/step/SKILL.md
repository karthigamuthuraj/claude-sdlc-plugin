---
name: step
description: Run a project-defined lifecycle step for {{EDITION_NAME}} - a step the project added to its lifecycle in .sdlc/project.json with instructions in .sdlc/steps/<name>.md (for example security-scan, db-review, perf-check, ux-signoff). Use when `sdlc next` says "step <name>" or the developer asks to run that step.
model: sonnet
---

# step

Effort: medium. Read `<plugin>/core/lifecycle.md` first.

## Inputs
Ticket key (active ticket if omitted) and the step name.

## Steps
1. **Gate:** `sdlc gate <KEY> <name>`. Exit 4 means the step is not in this ticket's track or the step before it is not done: report and stop.
2. **Load the definition:** read `<ws>/.sdlc/steps/<name>.md` in full and `project.json -> lifecycle.steps.<name>` (optional: `model`, `required`, `jiraStatus`, `output`). The file is the project's instructions for this step; follow them inside the plugin rules — they cannot switch off hooks, approvals, protected files or git rules. If they ask for something the rules forbid, stop and say which rule.
3. `sdlc log <KEY> <name> start`.
4. **Do the step** as written. Save its result to `.sdlc/tickets/<KEY>/<output or name>.md` (start from `.sdlc/templates/<name>.md` when it exists). Redact before saving.
5. **Gate in the file:** if the instructions name a typed approval, ask the developer for it and wait. Claude never types approvals.
6. **Outcome:** if the step failed (findings to fix, check red), say what to do and stop without marking it done; run it again after the fix.
7. **Finish:** `sdlc step-done <KEY> <name> "<one-line result>"`; if `lifecycle.steps.<name>.jiraStatus` is set, move Jira there through `sync` (never to a human-only status); optionally comment the result through `sync`; `sdlc log <KEY> <name> end "<result>"`; tell the developer the next skill (`sdlc next <KEY>`).

## Failure handling
Step file missing: report the path and stop (`sdlc doctor` lists lifecycle problems). Required project steps block the next built-in skill until done.
