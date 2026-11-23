# Changelog

## Unreleased

- `create-ticket` now uploads every file the developer provides (screenshots, recordings, documents, anything) to the ticket. New `scripts/attach.mjs` uses the developer's own Jira API token; nothing is installed or configured by hand: the first time the skill asks once for the token (email and site come from the Atlassian connector), tests it and saves the login in `~/.claude/sdlc-core/jira-upload.json`. The skill checks the upload before creating the ticket and waits for that one step instead of creating the ticket without the files, shows how each file will be attached, uploads after creation and verifies the attachments on the ticket. Any text file is scanned for personal data (a file over 20 MB is flagged, not skipped); credential-type files are never uploaded; the token goes only to the saved site. Previously core mode never uploaded files.
- `analyse-and-plan-ticket` asks the developer the open questions that decide the plan (select-only, before reading any code), records the answers in a new "Answers from the developer" section of the requirements analysis, and builds the plan from them; only unanswered questions stay open on the ticket.
- The analysis and plan files written by `analyse-and-plan-ticket` end with a `Template: analysis/<templateSet>/<file>` line, so each file shows which template set and template produced it (it is also in the Jira comment).
- New skill `analyse-and-plan-ticket` (also `/sdlc-core:analyse-and-plan-ticket`): analyses a Jira ticket (requirements first, then the code), writes `<KEY>-requirements-analysis.md` and `<KEY>-implementation-plan.md` from a configurable template set (`standard` or `detailed`, `ticketAnalysis.templateSet`), asks for confirmation, then posts both as one comment that starts with `CC:` and a real @mention of the general assignee. New `scripts/md-to-adf.mjs` converts the files to a Jira comment with the mention node.
- Every ticket is now a parent ticket assigned to the general assignee with one sub-task per developer and one QA sub-task (mandatory, never asked), each assigned to its own person. `structure: single` and `inference.qa: when-asked|never` keep the old behaviour.
- `ticketCreation.mode` is `auto` (the skill predicts application, team, assignee, priority, sprint and type and asks only what it cannot decide) or `manual` (`ask` is the same: it asks every decision, prediction marked Recommended). New `sprint.mode: follow` (default) follows `mode`.
- New Jira ticket template version `v2` (bug, story, task, epic, default), following the section structure of the jira-ticket-create skill: Bug Summary, Environment, Steps to Reproduce, Expected and Actual Behavior; Given-When-Then user stories; tasks with a Definition of Done; epics. `v2` is the default `templateVersion`; set `v1` to keep the old sections. Optional placeholders on list or table lines drop only that line.
- Every ticket description ends with `Ticket template: <version>/<file>` (for example `v1/bug.md`), and the preview shows it. The environments offered when none is named are an editable `environments` list in the config files.
- `create-ticket` is automatic by default (`ticketCreation.mode: auto`): it reads the request, screenshots and screen recordings, checks existing Jira records (similar tickets, possible duplicate, who worked on them), decides space, type, priority, sprint, application(s), team(s) and people with the evidence for each, and shows one preview to confirm. It asks only when the evidence cannot decide. `mode: ask` keeps the question-by-question flow. New settings: `mode`, `sprint.mode` (replaces `sprint.ask`), `inference.qa`, `media.maxFrames`, `similar.maxResults`.
- New `scripts/frames.mjs` extracts evenly spaced frames from a screen recording (ffmpeg or the Python package imageio-ffmpeg) so they can be read as images; audio is not analysed.

- New `create-ticket` skill: creates a Jira ticket from the predefined template (`templates/jira/<version>/`), with select-only questions and approval of the draft before anything is created. Configured in `project.json -> ticketCreation` (all optional):
  - priority list per team or space, with hints such as `P1`;
  - current sprint or backlog, showing the active sprint's name;
  - application(s), then backend, frontend, both or general, with developers de-duplicated across applications;
  - optional attachments and a redaction scan.
- Assignee question: multi-select when several applications or several teams (Backend, Frontend, QA, General) are ticked, single choice for one application and one team; with several people ticked, one parent ticket is created for the general assignee plus one sub-task per person, each assigned to that person (no "main assignee" question).
- No more template-details question: the skill fills Problem and Environment itself, analyses the request and screenshots into a fuller problem description, and shows it for approval before the ticket is created (`description.elaborate`, default on). Steps to reproduce, actual result, expected result and impact are filled from the screenshots, recordings and request (with their source), "To be confirmed" only where nothing supports a line. The approval question has an "Edit description" option for any section: shorter, original words only, or your own text.
- Priority choices follow the configured list in its order (like Jira's dropdown); without a profile the list lives in `~/.claude/sdlc-core/ticket-creation.json`, editable at any time.
- `/sdlc-core:create-ticket` runs the same skill from the core plugin, with no edition or profile needed (`claude --plugin-dir <this repo>`); `sdlc redact` now works without a workspace.

## 0.3.0

- Customisable lifecycle: new tracks (based on a built-in track) and new steps inserted before/after any step, in `project.json -> lifecycle` or the edition's `custom/lifecycle.json`.
- Project steps: instructions in `.sdlc/steps/<name>.md`, run by the new `step` skill; required steps block later skills until `sdlc step-done`.
- Edition `custom/` folder: add or replace skills, templates, checklists, stacks; kept on upgrade; safety files need `--allow-core-overrides`.
- New CLI: `sdlc flow`, `sdlc step-done`; doctor reports lifecycle problems.
- `CUSTOMIZING.md` guide (core and every edition).
- Generic `examples/acme-portal` profile; README with install methods, skills inventory and lifecycle reference; guide PDF.
- Jira through the connected Atlassian MCP tool by default (`tracker.access: connector`); the API-token fallback is opt-in (`access: token`), and doctor no longer asks for a token.

## 0.2.0 — 2026-11-19
- PHP / Laravel stack pack.
- Single-repo workspaces (repo path "" or ".") and `subprojects` (other stacks inside one Git repo).
- `commitMessagePattern` and `{KEY}` in branch patterns for teams with their own conventions.
- Ticket folders under `.sdlc/` are never treated as source; git hooks installed once per Git repo.
- Profile format: additive only, no migration needed.

## 0.1.0 — 2026-11-19
- First release: generator (`new-project`), 16 lifecycle skills plus `setup`, guard hooks (approvals, git safety, protected files, read-only investigation, formatting, done-check), git hooks, Jira fallback adapter, 8 stack packs, profile schema, CI checks.
- Profile format version 1 (no migration needed).
