---
name: rca
description: Root cause analysis for a {{EDITION_NAME}} bug or hotfix - reproduce with a failing test, trace the code and its history, separate trigger, defect and contributing factors, size the blast radius and propose fix options, reviewed within budget and confirmed by the developer before any fix is designed. Use after logs, or after pickup when there are no logs.
model: opus
---

# rca

Effort: high. Read `<plugin>/core/lifecycle.md`, `core/review-loop.md`, `core/approvals.md`. Method adapted from Superpowers `systematic-debugging` (MIT, see THIRD_PARTY.md).

## Steps
1. `sdlc gate <KEY> rca`, `sdlc mode <KEY> readonly`, `sdlc log <KEY> rca start`, `sdlc budget use <KEY> rca author`.
2. **Reproduce:** from the ticket and `logs-report.md`, write the smallest failing test (only test files may be written now) or a script. Run it and record the failure. If it cannot be reproduced, record what was tried and ask for more information; do not guess a fix.
3. **Trace** the failing path to the first wrong behaviour with `file:line`. Check recent changes: `git log -p --since=<window> -- <files>`, `git blame` on the lines.
4. **Find the cause:** form one hypothesis at a time and test it against the reproduction; record evidence. Separate trigger, defect and contributing factors (missing validation, missing test, unclear contract).
5. **Blast radius:** other callers (`git grep`), other repos via the cross-repo map, data that may need correcting.
6. **Behaviour table:** current, expected, must stay unchanged.
7. **Fix options:** two or three with risk and effort; recommend one; how to prevent this class of bug.
8. Write `<ticket>/rca.md` from the template.
9. **Review loop** per `core/review-loop.md` (reviewer in a fresh context; budget from the track).
10. **Present:** `sdlc doc register <KEY> rca <ticket>/rca.md`, show the cause, evidence, options and budget line, and ask the developer to type `CONFIRM RCA <KEY> v<n>`. Stop.
11. After confirmation: `sdlc mode <KEY> normal`, Jira comment with the root cause summary and fix options, `sdlc stage <KEY> investigated`, `sdlc log <KEY> rca end`. Next: `analyze` (bug) or `tasks` (hotfix).

## Never
Fix the bug here; present an unconfirmed cause as VERIFIED; edit source files other than the reproduction test.
