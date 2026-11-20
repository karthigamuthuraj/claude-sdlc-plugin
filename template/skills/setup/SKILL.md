---
name: setup
description: Onboard a project to {{EDITION_NAME}} - one repo, a monorepo, or a multi-repo workspace. Detects repos and stacks, drafts .sdlc/project.json, steering, a cross-repo map and missing CLAUDE.md files, installs git hooks, and checks everything (--doctor). Use once per project, when repos change (--refresh), or after a core upgrade (--migrate).
model: sonnet
---

# setup

Effort: medium (use Opus for the cross-repo map). Read `<plugin>/core/lifecycle.md` first.

## Inputs
- Workspace folder (default: current folder).
- Mode: first run (default), `--doctor`, `--refresh`, `--migrate`.

## Steps (first run)

1. **Detect the layout.** List child folders that are Git repos (`git -C <dir> rev-parse --show-toplevel`).
   - One repo or a monorepo: the profile lives in that repo.
   - Several repos under a folder that is not itself a Git repo: tell the developer the profile needs a home and offer: (a) make this folder a small workspace repo (recommended), (b) keep `.sdlc/` in one primary repo, (c) leave it uncommitted during a pilot. Wait for the choice; do not run `git init` yourself.
2. **Per repo:** `sdlc stack-detect <repo>` (no workspace needed); read README, existing `CLAUDE.md` / `AGENTS.md`, package or build files, CI files, default and protected branches (`git branch -a`), and test, lint and format commands. Read `<plugin>/stacks/<stack>.json` for hints.
3. **Per-repo CLAUDE.md (like /init):** if a repo has none, draft one from `<plugin>/templates/setup/CLAUDE-repo.md`: commands, structure, conventions Claude cannot infer, what not to touch. Short. If one exists, never overwrite: show proposed additions as a diff and apply only what the developer accepts.
4. **Workspace CLAUDE.md** (multi-repo only) from `templates/setup/CLAUDE-workspace.md`.
5. **Cross-repo map** `.sdlc/steering/cross-repo.md`: search for shared contracts (OpenAPI/JSON schemas, shared DTOs, client SDKs, env keys read by several repos, queue/topic names, package pins). Record producer, consumers, location, versioning and the landing order. Mark each row VERIFIED (seen in code) or ASSUMED.
6. **Steering:** `product.md`, `tech.md`, `structure.md` in `.sdlc/steering/` from code and docs.
7. **Profile** `.sdlc/project.json` from `<plugin>/schema/profile.schema.json`: project name and slug, tracker (confirm the Atlassian connector works by reading the Jira project and its statuses through it; set `tracker.access` to `connector` unless the developer wants the API-token fallback; ask which statuses are human-only), repos (path, stack, area, parent, commands), branching, areas, roles (leave empty for the team), risk triggers, protectedFiles, templateExceptions, logSources. Show it for review.
8. **Install git hooks:** `sdlc install-git-hooks`. Existing hooks are not replaced; a `.sdlc` copy is written to chain.
9. **CI:** offer to copy `<plugin>/ci/sdlc-checks.yml` into each repo's `.github/workflows/`; this is a normal change in each repo, committed through the usual flow by people.
10. **Doctor:** run `sdlc doctor` and each configured test command once on a single test file; report results.

## Other modes
- `--doctor`: step 10 only.
- `--refresh`: detect new or removed repos and changed commands; propose updates to `project.json`, steering and the cross-repo map as diffs.
- `--migrate`: after a breaking core upgrade, apply the changelog's profile migration and show the diff.

## Outputs
`.sdlc/project.json`, `.sdlc/steering/*.md`, drafts of missing `CLAUDE.md`, installed git hooks, doctor report.

## Gate
The developer reviews every generated file. Existing `CLAUDE.md` / `AGENTS.md` are never overwritten.

## Never
Read `.env` or other protected files (look at `.env.example` for keys); push; run `git init` without the developer's choice; guess roles or reviewer names.
