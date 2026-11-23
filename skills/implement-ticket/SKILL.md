---
name: implement-ticket
description: Implement the plan of a Jira ticket straight from sdlc-core, without generating a project edition first - same skill as /<edition>:implement-ticket. It finds the plan (on the ticket, on its parent for a sub-task, or in the saved plan file), moves the ticket from To Do to In Progress, checks the code and shows which existing methods the change would break with a proposed fix, and implements only after the developer approves. It then tests every plan scenario and affected method, reports, and commits (developer as co-author, branch name in the message) after the developer confirms.
model: opus
---

# implement-ticket (core)

`<core>` is the folder two levels above this file. This skill has no steps of its own: it runs the shared skill so there is one source of truth.

1. Read `<core>/template/skills/implement-ticket/SKILL.md` and follow it exactly, with these substitutions:
   - `<plugin>` is `<core>/template`; `{{EDITION_NAME}}` is `sdlc-core`; `sdlc` is `node <core>/template/scripts/sdlc.mjs`.
   - Settings: `<core>/template/config/ticket-implementation.json` (shipped defaults) overridden key by key by `~/.claude/sdlc-core/ticket-implementation.json` (the developer's own file), then `.sdlc/project.json -> ticketImplementation` when a profile exists.
   - Without a profile the Jira site comes from `getAccessibleAtlassianResources`, the plan file is looked for in `.sdlc/tickets/<KEY>/` in the current folder, and the human-only statuses are Done, Closed, Resolved, Released, Approved, Rejected and Cancelled.
2. The ticket to implement is whatever the developer typed after the command (a key or a Jira link). A sub-task key works: the parent is read for the plan.

No code is changed before the developer approves the impact check.
