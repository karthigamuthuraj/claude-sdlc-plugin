---
name: qa-handover
description: Hand a merged {{EDITION_NAME}} change to QA - test cases from every acceptance criterion and regression risk, environment, build and flags, before and after screenshots, assignment of the QA tester and the worklog, all confirmed by the developer. Runs after the PR is approved and merged.
model: sonnet
---

# qa-handover

Effort: medium. UI checks adapted from Anthropic's `webapp-testing` skill.

## Steps
1. `sdlc gate <KEY> qa-handover` (stage `reviewed`), `sdlc log <KEY> qa-handover start`. Confirm the PR is merged and CI green; if the profile says `qaEnvironmentRule: deployed`, ask the developer to confirm the QA environment has the build.
2. **Test cases** from each AC: main flow, edge and negative cases; plus regression cases from the design's risks. Each: id, AC, preconditions and test data, steps, expected result. AI or prompt changes: sample inputs with the expected answer quality. Use the team's format (`project.json -> qaFormat`: plain Jira, Xray, Zephyr or spreadsheet).
3. **Environment:** where to test, build or version, flags, test data, link to `handoff.md`, known limitations.
4. **Screenshots** for UI changes (Playwright connector or the repo's e2e setup): before (parent) and after (merged build); remove personal data.
5. Write `<ticket>/qa-handover.md`; show it.
6. **Tester:** suggest from `project.json -> roles.qa` for the area; the developer confirms or names someone.
7. **Worklog:** `sdlc worklog <KEY>` proposes hours from `log.md`; the developer confirms or edits.
8. After confirmation (through `sync`): attach cases and screenshots, assign the tester, post the worklog, transition only to a status the profile allows Claude to set. `sdlc stage <KEY> qa_handed_over`, `sdlc log <KEY> qa-handover end`.
9. If QA later reports a bug: the ticket comes back to the developer and returns to `analyze` or `design` as a new version.
