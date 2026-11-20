---
name: logs
description: Read-only log analysis for a {{EDITION_NAME}} ticket or an error seen during development - reads application, container, CI and observability logs, correlates errors across services by request id or time, traces each to file:line and writes a redacted logs-report.md. Use on bug and hotfix tickets after pickup, or on demand ("analyse the logs", "why did this fail").
model: sonnet
---

# logs

Effort: medium. Read `<plugin>/core/lifecycle.md`. This skill never changes a running system.

## Inputs
Ticket key (or an ad-hoc error description); optional time window and services.

## Steps
1. `sdlc gate <KEY> logs`, `sdlc mode <KEY> readonly`, `sdlc log <KEY> logs start "<window>"`.
2. **Where to look:** from the ticket and `project.json -> logSources` (containers, log files, CI runs, observability connectors). Default window: 30 minutes around the reported time; widen if empty.
3. **Read** with the configured read-only commands only (for example `docker logs --timestamps --since 30m --tail 500 <c>`, `kubectl logs`, CI job logs through the Git host, an observability connector's search). Never restart, stop, exec into, or deploy anything; the hook blocks it.
4. **Filter** errors, warnings and stack traces; **correlate** across services by request id, trace id or timestamp; build a timeline.
5. **Trace** each error to `file:line` in the repo; label VERIFIED (seen in logs and code) or NOT VERIFIED (inferred).
6. **Redact** patient, customer and personal data and tokens; quote only the lines needed.
7. Write `<ticket>/logs-report.md` from the template; `sdlc doc register <KEY> logs <ticket>/logs-report.md`.
8. Jira: short redacted summary comment. `sdlc stage <KEY> investigated` (bug or hotfix track), `sdlc log <KEY> logs end "<n> findings"`. Next: `rca`.

## Never
Read protected files, change containers or services, paste unredacted log lines into Jira or chat.
