# {{EDITION_NAME}}

{{PROJECT_NAME}}'s SDLC plugin for Claude Code. One Jira ticket = one controlled, traceable delivery. Generated from sdlc-core {{CORE_VERSION}} — do not edit by hand; customize through the project's `.sdlc/` profile.

## Install
1. `/plugin marketplace add <this folder or its Git repo>` then `/plugin install {{EDITION_NAME}}@{{SLUG}}-plugins`.
2. Node 18+ on PATH. For Jira writes when the Atlassian connector is read-only: set `JIRA_EMAIL` and `JIRA_API_TOKEN` (names come from `project.json`).
3. In the workspace: `/{{EDITION_NAME}}:setup`, review the generated files, then `/{{EDITION_NAME}}:setup --doctor`.

## Daily use
| Step | Command |
|---|---|
| Analyse a ticket and plan | `/{{EDITION_NAME}}:analyse-and-plan-ticket PROJ-123` |
| Create a Jira ticket | `/{{EDITION_NAME}}:create-ticket <what it is about>` |
| Pick up a ticket | `/{{EDITION_NAME}}:pickup ACME-123` |
| Bugs: logs, root cause | `/{{EDITION_NAME}}:logs`, `/{{EDITION_NAME}}:rca` |
| Requirements, design | `/{{EDITION_NAME}}:analyze`, `/{{EDITION_NAME}}:design` |
| Kickoff, tasks, build, verify | `/{{EDITION_NAME}}:kickoff`, `:tasks`, `:build`, `:verify` |
| Commit, PR, feature handoff | `:commit`, `:pr`, `:handoff` |
| Review, conflicts | `:review`, `:resolve` |
| QA handover | `:qa-handover` |
| Jira replay / status | `:sync` |

Where am I? `node <plugin>/scripts/sdlc.mjs list` or `sdlc next <KEY>`.

## Lines you type
`CONFIRM RCA <KEY> v<n>` · `APPROVE REQUIREMENTS|DESIGN|BRIEF <KEY> v<n>` (+ `TECHLEAD <name>`) · `APPROVE DEVIATION <KEY> D<n>` · `CONFIRM COMMIT <KEY>` · `CONFIRM PUSH <KEY>` · `AUTHORIZE REVIEW <KEY> +<n>`

## Safety
Claude never stages with wildcards, commits or pushes without your line, merges, rebases, resets, force-pushes, approves PRs, reads or edits secrets (`.env`, keys, credentials and the stack-pack lists), or edits `.claude/**` and this plugin. See `config/safety.json`.
