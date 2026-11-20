# {{EDITION_NAME}} for other coding agents

This plugin's workflow is agent-neutral. Agents other than Claude Code can follow it:

- Rules: `core/lifecycle.md`, `core/context.md`, `core/approvals.md`, `core/review-loop.md`, `core/tracker-operations.md`.
- Steps: `skills/<skill>/SKILL.md` (ignore the frontmatter `model` field).
- Deterministic parts: `node scripts/sdlc.mjs ...` and `node adapters/tracker/jira.mjs ...`.
- Git safety: install `node scripts/sdlc.mjs install-git-hooks`. The Claude-only hooks in `hooks/hooks.json` must be replaced by the agent's own policy mechanism; until then a person enforces the approval lines.
