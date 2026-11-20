# Changelog

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
