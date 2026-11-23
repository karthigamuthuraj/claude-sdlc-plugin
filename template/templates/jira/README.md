# Jira ticket templates

`ticketCreation.templateVersion` (config) picks the folder; the skill never asks. The file is chosen from the issue type in lower case (`Bug` -> `bug.md`), else `default.md`. Every ticket ends with a line `Ticket template: <version>/<file>`.

Placeholders: `{{name}}` required (the skill's material, else "To be confirmed"); `{{?name}}` optional (the section, or just the list/table line, is left out when empty); `{{attachments}}` / `{{?attachments}}` the attached files with a few words on each. A line with several placeholders is repeated once per item.

| Version | Files | Shape |
|---|---|---|
| `v1` | bug, story, task, default | The original sections (Summary of the problem, Environment, Steps, Actual, Expected, Impact...). |
| `v2` | bug, story, task, epic, default | Bug Summary / Environment (environment, browser and OS, version) / Steps to Reproduce / Expected Behavior / Actual Behavior / Screenshots and Logs / Additional Context; User Story (As a / I want / So that) with Given-When-Then acceptance criteria; Technical Task with Requirements, Testing and a Definition of Done checklist; Epic with goals, success metrics, scope and timeline. |

`v2` follows the section structure of the `jira-ticket-create` skill in `bradtaylorsf/alphaagent-team` (MIT); the wording is ours and the markup is Markdown, because the skill creates tickets with `contentFormat: markdown`. Its priority scale and story-point guidance are not used (priorities come from the config and Jira).

`v2` is the default. To use `v1`, set `"templateVersion": "v1"` in your own `~/.claude/sdlc-core/ticket-creation.json`. To add a version, copy a folder, edit it and set the version; keep old versions so the config can switch back. In an edition, `.sdlc/templates/jira/<version>/` overrides these files.
