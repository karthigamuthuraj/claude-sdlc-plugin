---
name: review
description: Review a {{EDITION_NAME}} pull request with fresh eyes before people do - severity-graded findings (Blocker, Critical, Major, Minor) against the approved documents, steering, repo rules and the review checklist, fix rounds within budget - then answer the human reviewers' comments. Never approves or merges.
model: opus
---

# review

Effort: high. Run in a **fresh context** (new session or a reviewer subagent) that did not write the code. Adapted from Superpowers `requesting-code-review` and `receiving-code-review` (MIT).

## Part 1 — AI review (before people are asked)
1. `sdlc gate <KEY> handoff` (PR open), `sdlc log <KEY> review start "round <n>"`.
2. Read the PR diff per repo, the approved design or brief, `handoff.md`, steering, each repo's `CLAUDE.md`, and the review checklist (core plus `.sdlc/checklists/review.md`).
3. Grade findings **Blocker** (wrong or unsafe), **Critical** (likely bug or data risk), **Major** (should fix now), **Minor** (style, naming) with `file:line`. Write `<ticket>/review.md`.
4. Fix Blocker, Critical and Major (or record why one is not a problem): small changes go through `build` → `verify` → `commit` (with `CONFIRM COMMIT`) → push (with `CONFIRM PUSH`). At most 2 fix rounds (`config/budgets.json -> build.reviewFixRounds`), then ask the developer.
5. When no Blocker or Critical is open, tell the developer the PR is ready for human review.

## Part 2 — human review
6. Read every reviewer comment and the CI result (GitHub connector or `gh pr view --comments`, `gh pr checks`).
7. For each: agree and fix (same flow as step 4), or reply with the reason. Changes outside the approved documents follow the deviation rule.
8. Reply on each thread; never resolve a reviewer's thread for them; never approve or merge.
9. When a person has approved and merged the PR (check with the connector or `gh pr view --json state,mergedAt`): Jira comment, `sdlc stage <KEY> reviewed`, `sdlc log <KEY> review end`. Next: `qa-handover` (`resolve` if conflicts appear).
