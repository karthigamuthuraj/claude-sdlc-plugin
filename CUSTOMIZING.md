# Customising <slug>-sdlc

Three levels. Use the smallest that works.

| Level | Where | Who it affects | Survives upgrade |
|---|---|---|---|
| 1. Project | `<workspace>/.sdlc/` (committed with the project) | that project | yes |
| 2. Edition | `<slug>-sdlc/custom/` | every project using this edition | yes |
| 3. Core | `sdlc-core/template/` | every edition, after regeneration | — |

Never edit generated edition files directly: `--upgrade` refuses when they differ from `edition.json`. Put the same path under `custom/` instead.

## 1. Project level (`.sdlc/`)

| File | Effect |
|---|---|
| `project.json` | tracker, repos, commands, branches, protected files, budgets, **lifecycle** |
| `steps/<name>.md` | instructions for a new lifecycle step, run by `/<slug>-sdlc:step <name>` |
| `extensions/<skill>.before.md` / `.after.md` | extra instructions run at the start / end of a skill |
| `templates/<name>` | replaces a document template (brief, design, pr-summary, qa-handover…) |
| `checklists/<name>` | appended to the core checklist of the same name |
| `steering/*.md` | project knowledge every skill reads |

## 2. Add a lifecycle step or a new track

Lifecycle settings live in `project.json -> lifecycle` (project) or `custom/lifecycle.json` (edition). The project wins over the edition, the edition over the built-in tracks.

Built-in tracks: `quick`, `standard`, `full`, `bug`, `hotfix`. See them with `sdlc flow`.

```json
"lifecycle": {
  "insert": [
    { "after": "verify", "steps": ["security-scan"], "tracks": ["standard", "full", "bug"] }
  ],
  "tracks": {
    "spike":   { "base": "quick", "description": "time-boxed investigation", "remove": ["pr", "handoff", "review"] },
    "release": { "base": "full",  "insert": [{ "before": "pr", "steps": ["changelog"] }] },
    "ui":      { "base": "standard", "steps": ["pickup", "analyze", "design", "ux-signoff", "kickoff", "tasks", "build", "verify", "commit", "pr", "handoff", "review", "qa-handover"] }
  },
  "steps": {
    "security-scan": { "required": true, "jiraStatus": null, "output": "security-scan.md" },
    "ux-signoff":    { "required": true }
  }
}
```

- `insert`: put steps `after` or `before` an existing step, in the listed `tracks` (all tracks when omitted).
- `tracks.<name>`: a new track. `base` is the built-in track whose gates and review budgets it uses. Give either a full `steps` list, or `insert` / `remove` edits on the base.
- `steps.<name>`: `required` (default true: later built-in skills are blocked until it is done), `jiraStatus` (status to move to when done; never a human-only status), `output` (file name under the ticket folder), `model`.
- `pickup`, `build`, `verify` and `commit` cannot be removed: they carry the safety gates.

Each new step needs instructions, in one of two places:

- **Project step**: `<workspace>/.sdlc/steps/<name>.md`, plain instructions. The `step` skill runs it: gate, log, do, save output, `sdlc step-done`.
- **Edition skill**: `custom/skills/<name>/SKILL.md`, a full skill (`/<slug>-sdlc:<name>`). Use the skeleton below.

Check the result: `sdlc flow` (all tracks), `sdlc flow <KEY>` (progress of one ticket), `sdlc doctor` (lists lifecycle problems). A ticket's track is chosen at pickup and can be any built-in or custom track.

### Project step example: `.sdlc/steps/security-scan.md`

```markdown
# security-scan
1. Run `composer audit` and `npm audit --omit=dev` in the changed repos.
2. List High/Critical findings with package, version and fix.
3. Failed if any High/Critical finding is introduced by this ticket's changes.
```

### Edition skill skeleton: `custom/skills/<name>/SKILL.md`

```markdown
---
name: <name>
description: <what it does and when to use it — Claude uses this to pick the skill>
model: sonnet
---

# <name>

Read `<plugin>/core/lifecycle.md` first.

## Steps
1. `sdlc gate <KEY> <name>` — stop on exit 4.
2. `sdlc log <KEY> <name> start`.
3. <the work>
4. `sdlc step-done <KEY> <name> "<result>"` (lifecycle step) — or nothing, for a helper skill outside the lifecycle.
5. `sdlc log <KEY> <name> end "<result>"`; tell the developer `sdlc next <KEY>`.
```

A skill that is not listed in any track is a normal helper skill: it runs whenever the developer calls it.

## 3. Edition level (`custom/`)

| Path | Effect |
|---|---|
| `custom/skills/<new>/SKILL.md` | adds a skill |
| `custom/skills/<core>/SKILL.md` | replaces that core skill (upgrade warns when the core one changes) |
| `custom/templates/…`, `custom/checklists/…`, `custom/stacks/<stack>.json`, `custom/core/…` | replaces or adds that file |
| `custom/lifecycle.json` | tracks and steps for every project on this edition (same format as above) |

Then rebuild and update:

```
node <sdlc-core>/generator/build-edition.mjs --upgrade <path>/<slug>-sdlc
/plugin update <slug>-sdlc
```

`custom/scripts/**`, `custom/hooks/**` and `custom/config/safety.json` are refused unless the build runs with `--allow-core-overrides` — they would replace the safety gates. Prefer `project.json` settings (`blockedCommands`, `protectedFiles`, `templateExceptions`).

## What customisation cannot change

Typed approvals and confirmations, protected and secret files, blocked git commands, human-only Jira statuses and the no-merge rule apply to custom steps and skills too. A step's instructions cannot switch them off.
