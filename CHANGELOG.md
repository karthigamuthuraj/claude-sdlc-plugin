# Changelog

## Unreleased

- New `create-ticket` skill: creates a Jira ticket from the predefined template (`templates/jira/<version>/`), with select-only questions and approval of the draft before anything is created. Configured in `project.json -> ticketCreation` (all optional):
  - priority list per team or space, with hints such as `P1`;
  - current sprint or backlog, showing the active sprint's name;
  - application(s), then backend, frontend, both or general, with developers de-duplicated across applications;
  - optional attachments and a redaction scan.
- Assignee question: multi-select when several applications or several teams (Backend, Frontend, QA, General) are ticked, single choice for one application and one team; with several people ticked, one parent ticket is created for the general assignee plus one sub-task per person, each assigned to that person (no "main assignee" question).
- No more template-details question: the skill fills Problem and Environment itself, analyses the request and screenshots into a fuller problem description, and shows it for approval before the ticket is created (`description.elaborate`, default on). The approval question has an "Edit problem summary" option: shorter, original words only, or your own text.
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
