---
name: sync
description: The single place that writes to Jira for {{EDITION_NAME}} - comments, attachments, transitions, assignee changes and worklog, with redaction, human-only status protection, fallback to the developer's token and a queue for failed writes. Other skills follow these rules; run it directly to replay pending writes or post a status update.
model: haiku
---

# sync

Effort: low. Rules in `<plugin>/core/tracker-operations.md`.

## For every write
1. Put the text in a file under `<ticket>/` and run `sdlc redact <file>`; it must print `clean`. If flagged, rewrite. Use `--allow-flagged` only when the developer confirms the flagged text is not personal data.
2. Write with the Atlassian connector. If it fails twice: with `tracker.access: token` use `jira <op> ...` (developer's `tracker.authEnv` variables); otherwise queue it under `pending-jira/` and ask the developer to reconnect the connector.
3. Transitions: only the statuses in `tracker.transitionsBySkill`; never one in `humanOnlyStatuses`.
4. Assignments and worklog: only after the developer confirmed the person or the hours in this conversation.
5. After success: `sdlc tracker-done <KEY> <op> "<summary>"`.
6. On failure: save to `<ticket>/pending-jira/<UTC time>-<op>.md`, `sdlc log <KEY> sync blocked "<reason>"`, tell the developer, continue.

## Run directly
- `replay`: post every file in `pending-jira/` in time order, then move each to `pending-jira/sent/`.
- `status`: post a short progress comment (stage, done tasks, next step).
