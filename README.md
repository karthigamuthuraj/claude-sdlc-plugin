# Claude SDLC plugin (sdlc-core)

A Claude Code plugin that runs a developer's software delivery lifecycle on one Jira ticket: pickup, root cause, requirements, design, tasks, build, verify, commit, pull request, handoff, review and QA handover. It adds typed human approvals, protected files, git safety rules and Jira updates through the Atlassian MCP connector.

`sdlc-core` is a **generator**. Each project creates its own plugin, called an **edition**, named after the project: `acme-portal-sdlc`, with commands like `/acme-portal-sdlc:pickup ACME-123`. Project settings live in the project's `.sdlc/` folder.

- 19 skills (the lifecycle ones plus `create-ticket`) plus `new-project`, each with a set model and reasoning effort
- 5 built-in tracks (quick, standard, full, bug, hotfix) and project-defined tracks and steps
- Approvals typed by people, bound to document versions and staged changes
- Hooks that block secret files, unsafe git commands, merges and human-only Jira statuses
- Stack packs: Python, Node, PHP, Java, .NET, Go, Ruby, mobile, infrastructure
- Plain Node 18 scripts, no npm dependencies

Full guide: [sdlc-core-guide.pdf](sdlc-core-guide.pdf) · Customising: [CUSTOMIZING.md](CUSTOMIZING.md) · Quick install: [INSTALL.md](INSTALL.md) · Changes: [CHANGELOG.md](CHANGELOG.md)

---

## Contents

1. [How it fits together](#1-how-it-fits-together)
2. [Requirements](#2-requirements)
3. [Install](#3-install)
4. [Lifecycle](#4-lifecycle)
5. [Skills inventory](#5-skills-inventory)
6. [Approvals, gates and guardrails](#6-approvals-gates-and-guardrails)
7. [Customising](#7-customising)
8. [Repository layout](#8-repository-layout)
9. [CLI reference](#9-cli-reference)
10. [Development and tests](#10-development-and-tests)

---

## 1. How it fits together

| Layer | Where it lives | Who changes it | Contains |
|---|---|---|---|
| Core | this repo | Plugin maintainers | Generator and template: skills, rules, scripts, hooks, templates, stack packs |
| Edition | `<slug>-sdlc` (generated, one per project) | Generated; own changes go in its `custom/` folder | The installable Claude Code plugin with the project name |
| Project profile | `<project root>/.sdlc/` (committed with the project) | The project team | `project.json` (Jira, repos, commands, branches, lifecycle), steering notes, project steps |

```
sdlc-core --(new-project)--> acme-portal-sdlc --(install + setup)--> project/.sdlc/
```

A core upgrade regenerates the edition but never touches the edition's `custom/` folder or the project's `.sdlc/` folder.

## 2. Requirements

| Need | Notes |
|---|---|
| Claude Code | Latest version |
| Node.js 18+ and git | On PATH |
| Jira | Atlassian MCP connector connected in Claude Code; no API token needed (`tracker.access: "connector"`) |
| GitHub | GitHub MCP connector or the `gh` CLI, for pull requests |
| Project toolchain | Whatever runs the project's tests (Python, Node, PHP, Docker ...); setup records the commands |

## 3. Install

`<tools>` below is any folder you keep plugin files in, for example `C:\dev\tools` or `~/tools`.

### 3.1 Install sdlc-core

**From GitHub (recommended)**

```
/plugin marketplace add karthigamuthuraj/claude-sdlc-plugin
/plugin install sdlc-core@concertidc-sdlc
```

**From a local clone**

```
git clone https://github.com/karthigamuthuraj/claude-sdlc-plugin.git <tools>/sdlc-core
/plugin marketplace add <tools>/sdlc-core
/plugin install sdlc-core@concertidc-sdlc
```

### 3.2 Create the project's edition (one person, once per project)

In Claude Code run `/sdlc-core:new-project`, give the project name and an output folder. Or without Claude:

```
node <tools>/sdlc-core/generator/build-edition.mjs --name "Acme Portal" --out <tools>/acme-portal-sdlc
```

Push the generated `acme-portal-sdlc` folder to its own git repo so the team can install it.

### 3.3 Set up the project (once per project, in the project root)

```
/plugin marketplace add <tools>/acme-portal-sdlc        # or <org>/acme-portal-sdlc from GitHub
/plugin install acme-portal-sdlc@acme-portal-plugins    # choose project scope, then restart Claude Code
/acme-portal-sdlc:setup
```

Setup detects repos and stacks, asks for test, lint and format commands, reads the Jira project and statuses through the connector, asks which statuses only people may set, and records branch rules, protected files and blocked commands. It writes `.sdlc/project.json`, steering notes and `CLAUDE.md` (if missing), and installs git hooks.

If the project already has git hooks, setup writes `pre-commit.sdlc` and `commit-msg.sdlc` beside them. Chain them by adding near the top of each existing hook:

```
"$(dirname "$0")/pre-commit.sdlc" "$@" || exit 1     # in pre-commit
"$(dirname "$0")/commit-msg.sdlc" "$@" || exit 1     # in commit-msg
```

Then run `/acme-portal-sdlc:setup doctor` and fix what it lists. Commit `.sdlc/` through your normal PR flow; keep `.sdlc/tickets/` and `.sdlc/active` out of git.

### 3.4 Other developers on the project

1. Pull the project (they get `.sdlc/`).
2. Install the edition (3.3, first two lines) and restart Claude Code.
3. Run `/acme-portal-sdlc:setup`: it reuses the shared profile, installs their hooks and runs doctor.
4. Connect the Atlassian MCP connector.

### 3.5 Update and uninstall

| Task | Commands |
|---|---|
| New sdlc-core version | `git pull` in sdlc-core, then `node <tools>/sdlc-core/generator/build-edition.mjs --upgrade <tools>/acme-portal-sdlc`, push the edition |
| Developers pick up an edition change | `/plugin marketplace update acme-portal-plugins` then `/plugin update acme-portal-sdlc` |
| Uninstall from a project | `/plugin uninstall acme-portal-sdlc@acme-portal-plugins`, `/plugin marketplace remove acme-portal-plugins`, remove the hook chain lines and `*.sdlc` hook files, optionally delete `.sdlc/` |

## 4. Lifecycle

### 4.1 Tracks

`pickup` proposes a track; the developer confirms it. `sdlc flow` lists all tracks, including project ones.

| Track | Use for | Steps |
|---|---|---|
| quick | One file, obvious fix, no risk trigger | pickup > tasks > build > verify > commit > pr > handoff > review |
| standard | Normal stories and tasks | pickup > analyze > design (brief) > kickoff > tasks > build > verify > commit > pr > handoff > review > qa-handover |
| full | Features or any risk trigger | as standard, with separate requirements and design documents and a critic pass |
| bug | Defects | pickup > logs > rca > analyze > design > kickoff > tasks > build > verify > commit > pr > handoff > review > qa-handover |
| hotfix | Production incidents that cannot wait | pickup > logs > rca > tasks > build > verify > commit > pr > handoff > review > qa-handover |

Risk triggers: several repos, high-risk paths, API contract, database migration, auth, personal data, prompt or model change, production config, new dependency.

### 4.2 Stages

Each ticket has a context file (`.sdlc/tickets/<KEY>/context.json`) and a log (`log.md`). The stage moves forward only through skills:

`picked_up > investigated > analyzed > designed > kicked_off > tasks_ready > building > verified > committed > pr_open > handed_off > reviewed > qa_handed_over`

After `review`, people approve and merge the PR; `qa-handover` follows.

### 4.3 Documents and review loop

`rca`, `analyze` and `design` write versioned documents. Each goes through a review loop: author draft, fresh-context reviewer (findings graded Blocker, Critical, Major, Minor), revision, optional critic, then the developer approves with a typed line. Editing an approved document voids its approval and marks documents built on it as stale.

| Track | Author rounds | Reviewer rounds | Critic rounds | Developer change cycles |
|---|---|---|---|---|
| quick | 1 | 0 | 0 | 2 |
| standard | 2 | 1 | 0 | 3 |
| full | 3 | 2 | 1 | 3 |
| bug | 2 | 1 | 0 | 3 |
| hotfix | 1 | 1 | 0 | 1 |

Budgets are maximums; a document is presented as soon as no Blocker or Critical remains. Verify can send work back to build at most 3 times; review runs at most 2 fix rounds. Extra rounds need `AUTHORIZE REVIEW <KEY> +1` typed by the developer.

### 4.4 Jira

All Jira reads and writes go through the Atlassian MCP connector. Developers' statuses are set by skills when configured (`tracker.transitionsBySkill`, for example pickup to In Progress, handoff to Dev Complete). Statuses in `tracker.humanOnlyStatuses` (for example In QA, Done) are never set by Claude. Comments pass a redaction scan first; failed writes are queued in the ticket's `pending-jira/` folder and replayed by `sync`.

**Creating tickets (`create-ticket`)** is configured in `project.json -> ticketCreation` (see `examples/acme-portal`); every key is optional:

| Key | Purpose |
|---|---|
| `templateVersion` | Template folder under `templates/jira/`: `v1` or `v2` (default: Bug Summary / Steps / Expected / Actual bugs, Given-When-Then stories, tasks with a Definition of Done, epics; see `templates/jira/README.md`); never asked. Every ticket ends with a line `Ticket template: <version>/<file>` so you can see which template created it |
| `mode` | `auto` (default): the skill predicts the application, teams, assignee, priority, sprint and type from the evidence, asks only what it cannot decide, and shows one preview; `manual` (`ask` is the same): it asks you every decision, with its prediction marked Recommended |
| `sprint.mode` | `follow` (default): decided when `mode` is `auto`, asked when it is `manual`; or fix it: `ask`, `auto` (current sprint for High or Highest, else backlog), `current`, `backlog` |
| `inference.qa` | Add a QA sub-task `when-asked` (default), `always` or `never` |
| `environments` | Environments offered when none is named in the request or screenshots (the skill asks, with "Not sure" and an Other box) |
| `media.maxFrames`, `similar.maxResults` | Frames read from a screen recording (default 12) and Jira records read per search (default 6) |
| `priorities.default`, `priorities.bySpace.<KEY>`, `priorities.hints` | The priority names offered (per team or space; empty means all Jira priorities) and the mapping from request hints such as `P1` |
| `applications` | Your projects (any number), each with `urlKeywords` and `teams.backend` / `teams.frontend` / `teams.qa` people (a name, or `{name, email}`) |
| `qa` | The QA team shared by every application |
| `generalAssignee` | Owner of the parent ticket when several people work on it |

**Automatic by default.** The skill reads your request, screenshots and screen recordings, checks existing Jira records, and works out the space, issue type, priority, sprint, application(s), team(s) and who should work on it. It writes the whole description (problem summary, environment, steps to reproduce, actual result, expected result, impact) from the request, screenshots and recordings, saying where each part came from, and marks "To be confirmed" only where nothing supports a line, then shows **one preview** with the reason for each choice and the existing tickets it used, including a possible duplicate. Nothing is created until you select "Create ticket"; "Edit description" (any section: shorter, original words only, or your own text) and "Change something" adjust the preview first. It asks a question only when the evidence cannot decide (for example no sign of which application).

- **Screen recordings** are read as evenly spaced frames with `template/scripts/frames.mjs`, which needs ffmpeg (on PATH, or the Python package `imageio-ffmpeg`). Audio is not analysed; without ffmpeg the preview says the recording was not analysed.
- **People:** the person who worked on similar tickets is preferred, then the one with fewer open tickets in the active sprint, then list order. One person gives one ticket; several give a parent ticket for the general assignee plus one sub-task per person ("Fix: ..." for developers, "Test: ..." for QA). A person listed in several applications or teams counts once.
- Every list is plain JSON you can edit at any time. `mode: manual` brings back the question-by-question flow; `description.elaborate: false` turns the written description off.

## 5. Skills inventory

Models are Claude Code aliases, so newer model versions need no change. Defaults are in `template/config/models.json`; projects override them in `project.json -> models`.

| Skill | Purpose | Model | Effort | Gate before it starts | Jira |
|---|---|---|---|---|---|
| new-project (core) | Generate or upgrade a project edition | Sonnet | Low | None | None |
| setup | Onboard the project: profile, steering, CLAUDE.md, git hooks, doctor | Sonnet | Medium | None | Reads project and statuses |
| create-ticket | Create a Jira ticket with almost no questions: reads the request, screenshots and recordings, checks existing Jira records, decides space, type, priority, sprint, application(s), team(s) and people, shows one preview | Sonnet | Medium | Developer confirms the preview | Reads similar tickets; creates the ticket and sub-tasks |
| pickup | Duplicate check, read the ticket, repos, risk, track, ticket context | Sonnet | Medium | Key matches the project pattern | Comment; In Progress |
| logs | Read-only log analysis (bug, hotfix) | Sonnet | Medium | Track confirmed; read-only mode | Comment |
| rca | Root cause with evidence; review loop | Opus | High | Track confirmed; read-only mode | Comment |
| analyze | Requirements or bug-fix spec; review loop | Opus | High | Bug/hotfix: RCA confirmed | Comment, attachment |
| design | Brief (standard, bug) or design (full); review loop | Opus | High | Full: requirements approved | Summary, attachment |
| kickoff | Branch, worktree, approved file list | Opus | Medium | Brief (standard, bug) or design (full) approved | Comment, attachment |
| tasks | Task breakdown with acceptance criteria | Sonnet | Medium | Kickoff done | Comment (optional sub-tasks) |
| build | Implement one task at a time | Sonnet (Opus on risk) | Medium | Kickoff done; required project steps done | None |
| verify | Focused tests and acceptance-criteria evidence | Sonnet (Opus on risk) | Medium | None; run when all tasks are done | Comment |
| commit | Stage named files and commit after confirmation | Haiku | Low | Verify passed; every criterion verified | Comment with hash |
| pr | Push after confirmation; PR with summary | Sonnet | Low | Something committed | PR link |
| handoff | Feature handoff after push | Sonnet | Medium | PR open | Comment, PR link; Dev Complete if configured |
| review | Fresh-context AI review, then reviewers' comments | Opus | High | None; run after the PR is open | Comment |
| resolve | Merge-conflict help without overwriting others' work | Opus | High | None; run when a conflict appears | Comment if behaviour changed |
| qa-handover | QA test cases, tester assignment, worklog | Sonnet | Medium | PR approved and merged by people | Test cases (Jira, Xray, Zephyr or sheet), assign, worklog |
| sync | All Jira writes, redaction, replay of queued writes | Haiku | Low | None | All writes |
| step | Run a project-defined lifecycle step from `.sdlc/steps/` | Sonnet | Medium | Step in the ticket's track; previous step done | Optional status |

Model rules:

- **Risk escalation:** a risk trigger moves build and verify to Opus.
- **Failure escalation:** after 2 failed attempts at the same task or check, clear the context with a summary and continue one level up (Haiku, Sonnet, Opus) at higher effort.
- **Reviewer and critic passes** run on Opus at high effort in a fresh context.

## 6. Approvals, gates and guardrails

### 6.1 Lines only people type

| Line | Unlocks | Bound to |
|---|---|---|
| `CONFIRM RCA <KEY> v<n>` | analyze, design, kickoff on bug and hotfix | That RCA version |
| `APPROVE REQUIREMENTS <KEY> v<n>` | design (full) | That version |
| `APPROVE BRIEF <KEY> v<n>` | kickoff, tasks, build (standard, bug) | That version |
| `APPROVE DESIGN <KEY> v<n>` | kickoff, tasks, build (full) | That version |
| `... TECHLEAD <name>` (suffix) | Approval of a high-risk brief or design | Required when risk is high |
| `APPROVE DEVIATION <KEY> D<n>` | Editing a file outside the approved list | That deviation |
| `CONFIRM COMMIT <KEY>` | One commit | The exact staged changes; single use |
| `CONFIRM PUSH <KEY>` | One push per repo | Single use; never a protected branch |
| `AUTHORIZE REVIEW <KEY> +<n>` | Extra review rounds | That document |

### 6.2 Claude Code hooks

| Hook | What it does |
|---|---|
| SessionStart | Shows the active ticket, track, stage and next skill |
| UserPromptSubmit | Records typed approval and confirmation lines |
| PreToolUse | Blocks the actions below, with the reason |
| PostToolUse | Runs the project formatter on edited files |
| Stop | Blocks once if all tasks are done but verify has not run |

PreToolUse blocks:

| Area | Blocked |
|---|---|
| Secret and protected files | Reading or editing `.env`, keys, credentials and project `protectedFiles`; real-looking secrets in template files such as `.env.example` |
| Guardrails | Edits to `.claude/**` and to the plugin's own files |
| Investigation | During logs and rca: source edits (tests only) and container-changing commands |
| Stage and scope | Source edits before kickoff (except quick track and tests); files outside the approved list without a deviation approval |
| Commands | The project's `blockedCommands` (migrations, prod deploys ...) |
| GitHub | `gh pr merge`, `gh pr review --approve` |
| git | merge, rebase, reset, revert, cherry-pick, tag, stash, clean, restore, switch, checkout, pull, filter-branch, gc, prune; branch delete; worktree remove |
| git add / commit / push | `add .`, `-A`, `-u`, wildcards; `commit --no-verify`, `--amend`, `-a`; force, delete, mirror, tag pushes; any commit or push without its typed confirmation |
| Jira and MCP writes | Text failing the redaction scan; merges and approvals; human-only statuses |

### 6.3 Git hooks (installed by setup)

| Hook | Checks |
|---|---|
| pre-commit | Not on a protected branch; no protected or secret files or values staged; no debug prints; optional project `preCommit` command |
| commit-msg | Starts with the ticket key, or matches `commitMessagePattern` |
| pre-push | Not pushing to a protected branch |

## 7. Customising

| I want to... | Do this |
|---|---|
| Add a lifecycle step to some tracks | `project.json -> lifecycle.insert` + `.sdlc/steps/<name>.md` |
| Add a new track | `project.json -> lifecycle.tracks` (based on a built-in track) |
| Add a new skill | `<slug>-sdlc/custom/skills/<name>/SKILL.md`, then `--upgrade` |
| Replace a core skill | `<slug>-sdlc/custom/skills/<core-name>/SKILL.md`, then `--upgrade` |
| Extra instructions before or after a skill | `.sdlc/extensions/<skill>.before.md` / `.after.md` |
| Own document templates or checklists | `.sdlc/templates/<name>`, `.sdlc/checklists/<name>` |
| Change it for every project | Edit `template/`, run tests, bump the version, regenerate editions |

Example: a required security scan after verify.

```json
"lifecycle": {
  "insert": [{ "after": "verify", "steps": ["security-scan"], "tracks": ["standard", "full", "bug"] }],
  "tracks": { "spike": { "base": "quick", "description": "time-boxed investigation", "remove": ["pr", "handoff", "review"] } },
  "steps": { "security-scan": { "required": true, "output": "security-scan.md" } }
}
```

pickup, build, verify and commit cannot be removed from any track. Files under `custom/` cannot replace `scripts/`, `hooks/` or `config/safety.json` without `--allow-core-overrides`. Full details and a skill skeleton: [CUSTOMIZING.md](CUSTOMIZING.md). A complete example profile: [examples/acme-portal](examples/acme-portal/.sdlc/project.json).

## 8. Repository layout

```
.claude-plugin/          plugin.json (sdlc-core), marketplace.json (concertidc-sdlc)
skills/new-project/      creates or upgrades a project edition
skills/create-ticket/    /sdlc-core:create-ticket - runs template/skills/create-ticket without an edition
generator/               build-edition.mjs, custom-README.md
template/                everything an edition contains
  .claude-plugin/        edition plugin.json and marketplace.json
  .mcp.json              Atlassian, GitHub, Playwright MCP servers
  skills/                19 skills (18 lifecycle + create-ticket)
  core/                  shared rules: lifecycle, context, approvals, review-loop, models, tracker-operations
  templates/             ticket, rca, requirements, brief, design, kickoff, tasks, verify-report,
                         pr-summary, handoff, review, qa-handover, setup/*, jira/<version>/* (create-ticket)
  checklists/            review, ready, pr
  config/                safety.json, budgets.json, models.json
  stacks/                python, node, php, java, dotnet, go, ruby, mobile, infra
  scripts/               sdlc.mjs (CLI), guard.mjs (hooks), githook.mjs, lib/
  hooks/hooks.json       Claude Code hook wiring
  adapters/tracker/      jira.mjs (optional API-token fallback)
  schema/                profile.schema.json
  ci/                    sdlc-checks.yml (optional GitHub Actions check)
examples/acme-portal/    example .sdlc/ profile with a custom step and track
tests/                   node --test tests/*.test.mjs
```

## 9. CLI reference

Skills call `node <plugin>/scripts/sdlc.mjs <command>` (written `sdlc` in the skills). Run from anywhere inside the project, or set `SDLC_WORKSPACE`.

| Command | Does |
|---|---|
| `init <KEY> <seed.json>` | Create the ticket context |
| `use <KEY>` / `active` / `list` | Set, show or list tickets |
| `get <KEY> [path]` / `set <KEY> <path> <value>` | Read or set context fields (approvals, stage, track and steps cannot be set) |
| `track <KEY> <track>` | Confirm the track |
| `flow [<KEY> or <track>]` | Show tracks, or a ticket's steps and progress |
| `gate <KEY> <skill>` | Check a skill may start (exit 4 = blocked) |
| `stage <KEY> <stage>` / `next <KEY>` | Advance the stage; show the next skill |
| `step-done <KEY> <step> "<result>"` | Record a project step as done |
| `doc register|status ...` | Register a document version; show approval status |
| `budget use|show ...` | Use or show review rounds (exit 6 = exhausted) |
| `impact`, `deviation`, `tasks`, `criterion` | Approved files, deviations, task counts, acceptance criteria |
| `log`, `tracker-done`, `worklog` | Ticket log, Jira write record, proposed worklog |
| `branch-name <KEY> <type> "<summary>"` | Branch name from the profile pattern |
| `redact <file or ->` | Redaction scan (exit 5 = flagged) |
| `stack-detect [dir]` | Guess a repo's stack |
| `install-git-hooks` | Install or write chainable git hooks |
| `doctor` | Check the profile, repos, stacks, hooks and lifecycle |

## 10. Development and tests

```
node --test tests/*.test.mjs
```

20 tests cover the generator, custom overlays, context and gates, approvals, git rules, protected files, single-repo projects and custom lifecycles. Change `template/`, never a generated edition; bump `.claude-plugin/plugin.json` and add a CHANGELOG entry for each release. Changes to `scripts/`, `hooks/` and `config/safety.json` need a reviewer.

Methods borrowed from other open-source projects are credited in [THIRD_PARTY.md](THIRD_PARTY.md).
