---
name: verify
description: Prove every acceptance criterion of a {{EDITION_NAME}} ticket with evidence - select the changed-file test set, run tests, lint and type checks, map criteria to passing evidence, classify failures, and loop gaps back to build (max 3 loops) until everything passes. Writes verify-report.md.
model: sonnet
---

# verify

Effort: medium (Opus on risk). Adapted from Superpowers `verification-before-completion` (MIT): no "done" without evidence.

## Steps
1. `sdlc gate <KEY> build` (same preconditions), `sdlc log <KEY> verify start "loop <n>"`.
2. **Test set** per repo: test files the ticket added or changed, plus the direct test file of each changed source file (`git -C <worktree> diff --name-only <parent>...`). Never a whole suite unless the developer asks; if asked, record "full suite: run (requested)".
3. Run the repo's test command with those files, plus lint, format check and type check limited to changed files (commands from `project.json` or the stack pack).
4. **Criteria map:** for each AC, the passing test or a stated manual check. `sdlc criterion <KEY> AC<n> verified "<test id>"` or `open "<gap>"`. Bugs: the reproduction test passes and unchanged behaviour still holds.
5. **Failures:** classify as caused by the change, pre-existing (compare on the parent branch), or environmental. Fix nothing here.
6. Run extensions (`.sdlc/extensions/verify.after.md`, for example an evaluation set for prompt changes) and record results.
7. Write `<ticket>/verify-report.md`.
8. **Converge:** if any AC is open or a change-caused failure remains, list the specific gaps and go back to `build`. After 3 loops (`config/budgets.json -> build.verifyLoops`), stop and ask the developer.
9. All green: `sdlc stage <KEY> verified` (refuses if a criterion is not verified), Jira comment with the summary, transition to `tracker.transitionsBySkill.verify` if set (for example Dev Complete), `sdlc log <KEY> verify end "all criteria verified"`. Next: `commit`.

## Never
Claim tests passed that were not run; hide or skip a failing test; change unrelated code to make a test pass.
