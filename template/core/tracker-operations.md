# Tracker operations (Jira)

## Reads
1. The Atlassian connector (`getJiraIssue`, `searchJiraIssuesUsingJql`) with the site from `project.json -> tracker`.
2. Fallback (only with `tracker.access: token`): `jira get <KEY>` / `jira search <JQL>`.

## Access
`project.json -> tracker.access`: `connector` (default) — every read and write goes through the connected Atlassian MCP tool; no token is needed and the `jira` fallback is not used. `token` — the `jira` fallback below may be used with the developer's own API token (`tracker.authEnv`).

## Writes
Use the connector's write tools (`addCommentToJiraIssue`, `transitionJiraIssue`, `editJiraIssue`, `addWorklogToJiraIssue`, …). If a write fails twice: with `access: connector`, queue it (see Rules) and ask the developer to reconnect the Atlassian connector; with `access: token`, use the fallback:

| Operation | Fallback command |
|---|---|
| Comment | `jira comment <KEY> <file.md>` (redaction scan first) |
| Transition | `jira transition <KEY> "<status>"` (human-only statuses refused) |
| Attach | `jira attach <KEY> <file>` |
| Assign | `jira assign <KEY> "<email or name>"` (after the developer confirms the person) |
| Worklog | `jira worklog <KEY> <seconds> <startedISO> <file.md>` (after the developer confirms the hours) |

## Rules
- Redact personal, patient and customer data and tokens before writing; `sdlc redact <file>` must say `clean`.
- Never move a ticket to a human-only status, delete anything, or approve anything.
- After each write: `sdlc tracker-done <KEY> <op> "<summary>"`.
- On failure: save the text to `<ticket>/pending-jira/<UTC time>-<op>.md`, log `blocked`, tell the developer, continue local work. `sync` replays pending items.
