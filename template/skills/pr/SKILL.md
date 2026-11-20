---
name: pr
description: Push the task branch and open a pull request for a committed {{EDITION_NAME}} ticket - writes pr-summary.md (Jira link, changes per repo, acceptance-criteria checklist with evidence, risks, AI-assisted label), suggests reviewers, and pushes only after the developer types CONFIRM PUSH <KEY>.
model: sonnet
---

# pr

Effort: low. Flow adapted from Superpowers `finishing-a-development-branch` (MIT), without its merge option.

## Steps
1. `sdlc gate <KEY> pr`, `sdlc log <KEY> pr start`.
2. Write `<ticket>/pr-summary.md` from the template: Jira link, problem or root cause, changes per repo, AC checklist with evidence from `verify-report.md`, risks, migrations, config keys, rollout notes, "AI-assisted" line. Append `checklists/pr.md`.
3. Suggest reviewers from `project.json -> roles.reviewers` for the ticket's area; the developer confirms or changes them.
4. Show summary and reviewers; ask the developer to type `CONFIRM PUSH <KEY>`.
5. After the line: per repo `git -C <worktree> push -u origin <branch>` (task branch only; the hook blocks anything else). Hotfix: the PR targets the release or hotfix branch named by the developer.
6. Open the PR against the parent branch with the GitHub connector (fallback: `gh pr create --title "<KEY>: <summary>" --body-file <ticket>/pr-summary.md --base <parent> --head <branch> --reviewer <list>`). Multi-repo: one PR per repo, each linking the others.
7. `sdlc set <KEY> pr '{"<repo>":"<url>"}'`, Jira comment with the PR links, `sdlc stage <KEY> pr_open`, `sdlc log <KEY> pr end`. Next: `handoff`.

## Never
Push to a protected branch, force-push, merge, or approve.
