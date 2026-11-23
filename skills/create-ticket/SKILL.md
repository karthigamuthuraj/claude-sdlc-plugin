---
name: create-ticket
description: Create a Jira ticket straight from sdlc-core, without generating a project edition first - same skill as /<edition>:create-ticket. It reads the request, screenshots and screen recordings, checks existing Jira records, works out the space, type, priority, sprint, application(s), team(s) and who should work on it, and shows one preview; nothing is created until the developer confirms. Use to try or use ticket creation from the core plugin.
model: sonnet
---

# create-ticket (core)

`<core>` is the folder two levels above this file. This skill has no steps of its own: it runs the shared skill so there is one source of truth.

1. Read `<core>/template/skills/create-ticket/SKILL.md` and follow it exactly, with these substitutions:
   - `<plugin>` is `<core>/template`; `{{EDITION_NAME}}` is `sdlc-core`; `sdlc` is `node <core>/template/scripts/sdlc.mjs`.
   - Settings come from `.sdlc/project.json` (`ticketCreation`, `tracker`) in the current workspace when it exists (`sdlc` finds it from the current folder or `SDLC_WORKSPACE`). Without a profile they come from `<core>/template/config/ticket-creation.json` (shipped defaults) overridden key by key by `~/.claude/sdlc-core/ticket-creation.json` (the developer's own file: priority list, applications, teams, QA; edited at any time). `tracker.site` comes from `getAccessibleAtlassianResources` (link `<site url>/browse/<KEY>`). The application and team questions are asked when that file lists `applications`. Attachments are uploaded with `<plugin>/scripts/attach.mjs`, which needs no profile and nothing installed: the first time it asks once for the developer's API token and saves it in `~/.claude/sdlc-core/jira-upload.json`.
   - Templates come from `<core>/template/templates/jira/<version>/` unless the workspace has `.sdlc/templates/jira/<version>/`.
   - `sdlc redact -` works without a profile (core redaction rules only).
2. The request to turn into a ticket is whatever the developer typed after the command.

Screen recordings are read with `<plugin>/scripts/frames.mjs` (needs ffmpeg). Ask nothing about templates or boards; the shared skill decides everything it can, asks only what the evidence cannot decide (select-only), and nothing is created before the developer confirms the preview.
