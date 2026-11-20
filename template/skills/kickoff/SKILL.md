---
name: kickoff
description: Execution kickoff for an approved {{EDITION_NAME}} design - checks approvals and parent branches, creates the task branch and worktree in each repo, writes a self-contained kickoff.md checklist that any session or developer can execute, and produces the start prompt for a fresh execution session.
model: opus
---

# kickoff

Effort: medium. Run in the same session as `design`. Worktree setup adapted from Superpowers `using-git-worktrees` (MIT).

## Steps
1. `sdlc gate <KEY> kickoff` (approvals valid and documents unchanged), `sdlc log <KEY> kickoff start`.
2. **Parent branches:** for each repo compare `git -C <repo> rev-parse <parent>` with `parent_head`. If new commits touch files in the impact list (`git log --oneline <old>..<new> -- <files>`), stop: the design may be stale. Otherwise update `parent_head` (`sdlc set`) and log a decision.
3. **Branches and worktrees:** for each repo `git -C <repo> worktree add -b <branch> <worktree> <parent>`; then `sdlc set <KEY> repos.<i>.branch_created true`. Subprojects of one Git repo share a single worktree. If the branch exists in this ticket's worktree, reuse it; if it exists elsewhere, stop and report. Never delete, reset or force anything.
4. **Write `kickoff.md`** from the template, from the approved document and context only: decisions already made (with reasons), an ordered checklist (repo, files from the impact list, criteria covered, the exact check with its expected result) in cross-repo landing order, done criteria, constraints (foreign files, protected files, out of scope), open questions, commands per repo. Bugs: first step "reproduction test passes after the fix".
5. **Fresh-eyes check:** re-read only `kickoff.md` as a stranger; list what an executor would still ask; fix each gap; repeat once.
6. `sdlc doc register <KEY> kickoff <ticket>/kickoff.md` (record only; no approval needed), Jira attachment and comment, `sdlc stage <KEY> kicked_off`, `sdlc log <KEY> kickoff end`.
7. **Start prompt** (show it): "Execute ticket <KEY> in this workspace. Read `<ticket>/kickoff.md` and `context.json`; do not re-plan. Run `/{{EDITION_NAME}}:tasks <KEY>`, then build one task at a time. Anything that does not fit is a deviation." The developer opens a new session with it (or continues here).

## Gate
Approvals are checked by script. Kickoff adds no scope; a needed change means `sdlc deviation add` and back to `design`.
