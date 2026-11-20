---
name: design
description: Decide how an approved {{EDITION_NAME}} ticket will be built - read-only code exploration, approach, code impact, API, database, config and prompt changes, cross-repo landing order, test strategy per acceptance criterion and regression risks, reviewed within budget and approved by the developer (plus tech lead on risk triggers). Writes design.md (full) or part B of brief.md (standard, bug).
model: opus
---

# design

Effort: high. Read `<plugin>/core/lifecycle.md`, `core/review-loop.md`, `core/approvals.md`, the steering files and the cross-repo map.

## Steps
1. `sdlc gate <KEY> design`, `sdlc log <KEY> design start`, `sdlc budget use <KEY> <doc> author` (`design` or `brief`).
2. **Explore read-only** on the parent branch of each repo: entry points, every file involved, callers and consumers (`git grep`), existing tests and conventions, each repo's `CLAUDE.md` / `AGENTS.md`.
3. **Bugs:** design the fix on the confirmed root cause in `rca.md`, plus a guard against the same class of bug.
4. **Approach:** the smallest one that meets every criterion and fits the architecture; rejected options in one line each.
5. Fill the template: code impact table (every file added, modified or deleted, per repo, with why), data flow, API, database, configuration (new keys, category, environments — see the repo's stack pack), prompt or model changes and the evaluation to run, error handling, cross-repo landing order, test strategy (each AC → test file or node id, never a directory), regression risks, estimate.
6. **Risk re-check:** if a risk trigger appears that pickup did not see, `sdlc set <KEY> risk '{"level":"high","triggers":[...]}'` and tell the developer the tech lead must approve.
7. **Impact list:** for each repo, `sdlc impact <KEY> <repo> <path or glob>...` from the code impact table. The hook blocks edits outside it later.
8. **Review loop** per `core/review-loop.md`: reviewer (fresh context, Opus) and, on the full track, one critic pass.
9. **Present:** `sdlc doc register <KEY> design|brief <path>`; show approach, files per repo, API/DB/config changes, risks, estimate, open findings and the budget line; ask for `APPROVE DESIGN <KEY> v<n>` (full) or `APPROVE BRIEF <KEY> v<n>` (standard, bug), plus `TECHLEAD <name>` when risk is high. Stop.
10. After approval: Jira summary and attachment (through `sync`), `sdlc stage <KEY> designed`, `sdlc log <KEY> design end`. Next: `kickoff`.

## Never
Edit source code; edit the document after approval (that creates a new version and voids the approval).
