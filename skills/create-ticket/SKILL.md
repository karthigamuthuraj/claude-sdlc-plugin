---
name: create-ticket
description: Create a Jira ticket straight from sdlc-core, without generating a project edition first - same skill as /<edition>:create-ticket (select-only questions for space, type, priority, sprint or backlog, application(s), backend/frontend/both and the assignee; template-filled description; approval before anything is created). Use to try or use ticket creation from the core plugin.
model: sonnet
---

# create-ticket (core)

`<core>` is the folder two levels above this file. This skill has no steps of its own: it runs the shared skill so there is one source of truth.

1. Read `<core>/template/skills/create-ticket/SKILL.md` and follow it exactly, with these substitutions:
   - `<plugin>` is `<core>/template`; `{{EDITION_NAME}}` is `sdlc-core`; `sdlc` is `node <core>/template/scripts/sdlc.mjs`.
   - Settings come from `.sdlc/project.json` (`ticketCreation`, `tracker`) in the current workspace when it exists (`sdlc` finds it from the current folder or `SDLC_WORKSPACE`). Without a profile they come from `<core>/template/config/ticket-creation.json` (shipped defaults) overridden key by key by `~/.claude/sdlc-core/ticket-creation.json` (the developer's own file: priority list, applications, teams, QA; edited at any time). `tracker.site` comes from `getAccessibleAtlassianResources` (link `<site url>/browse/<KEY>`). The application and team questions are asked when that file lists `applications`. Attachments are attached by hand (`jira attach` needs a profile).
   - Templates come from `<core>/template/templates/jira/<version>/` unless the workspace has `.sdlc/templates/jira/<version>/`.
   - `sdlc redact -` works without a profile (core redaction rules only).
2. The request to turn into a ticket is whatever the developer typed after the command.

Ask nothing about templates or boards; everything else is asked by the shared skill, as select-only questions, and nothing is created before the developer approves the draft.
