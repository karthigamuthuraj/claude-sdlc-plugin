---
name: analyse-and-plan-ticket
description: Analyse a Jira ticket's requirements straight from sdlc-core, without generating a project edition first - same skill as /<edition>:analyse-and-plan-ticket. It writes a requirements analysis and an implementation plan from a configurable template set, asks you to confirm them (OK or changes), then posts both on the ticket in a comment that starts with "CC:" and a real @mention of the general assignee.
model: opus
---

# analyse-and-plan-ticket (core)

`<core>` is the folder two levels above this file. This skill has no steps of its own: it runs the shared skill so there is one source of truth.

1. Read `<core>/template/skills/analyse-and-plan-ticket/SKILL.md` and follow it exactly, with these substitutions:
   - `<plugin>` is `<core>/template`; `{{EDITION_NAME}}` is `sdlc-core`; `sdlc` is `node <core>/template/scripts/sdlc.mjs`.
   - Settings: `<core>/template/config/ticket-analysis.json` (shipped defaults) overridden key by key by `~/.claude/sdlc-core/ticket-analysis.json` (the developer's own file), then `.sdlc/project.json -> ticketAnalysis` when a profile exists. `generalAssignee` comes from the merged ticket-creation config (`<core>/template/config/ticket-creation.json` and `~/.claude/sdlc-core/ticket-creation.json`).
   - Without a profile the Jira site comes from `getAccessibleAtlassianResources`, the files go to `.sdlc/tickets/<KEY>/` in the current folder, and attachments are not uploaded (`jira attach` needs a profile).
   - `sdlc redact <file>` works without a profile (core redaction rules only).
2. The ticket to analyse is whatever the developer typed after the command (a key or a Jira link).

Nothing is posted to Jira before the developer confirms both files.
