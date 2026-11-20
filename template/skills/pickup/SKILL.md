---
name: pickup
description: Pick up a Jira ticket for development with {{EDITION_NAME}} - duplicate-work check, read the ticket in full, find the affected repos, classify risk, propose a track (quick, standard, full, bug, hotfix), create the ticket context and move Jira to In Progress. Also resumes a ticket already picked up. Use when a developer says "pick up ACME-123" or "start this ticket".
model: sonnet
---

# pickup

Effort: medium. Read `<plugin>/core/lifecycle.md` and `<plugin>/core/tracker-operations.md` first.

## Inputs
Ticket key (must match `project.json -> tracker.keyPattern`); optional track or parent-branch override.

## Steps
1. **Resume check:** `sdlc get <KEY>`. If it exists: `sdlc use <KEY>`, report track, stage and `sdlc next <KEY>`, stop.
2. **Read the ticket** in full: summary, description, type, status, priority, assignee, labels, links, sub-tasks, every comment, attachment names.
3. **Duplicate-work check** — stop and show the evidence if any is true, continue only on explicit confirmation (log a `decision`):
   - assigned to someone else (compare with the connector's current user or `jira myself`);
   - status beyond To Do and not assigned to this developer;
   - a branch containing the lowercase key exists in any repo (`git -C <repo> branch -a --list "*<key>*"`);
   - linked as duplicate, or a JQL search on its key words finds a near-identical open ticket.
4. **Repos:** from labels, components, description and a quick `git grep` of 2–4 distinctive terms, pick the repos; one-line reason each. Use `areas` and the cross-repo map. Ask if unsure.
5. **Snapshot each repo:** current branch, `git -C <repo> rev-parse <parent>`, and `git status --porcelain`. Dirty files belong to someone else: never touch them.
6. **Risk:** high if any `risk.triggers` applies (several repos, `highRiskPaths`, API contract, database migration, auth, personal data, prompt or model change, production config, new dependency).
7. **Track:** propose one with the reason: quick (one file, obvious fix, no trigger), standard, full (feature or any trigger), bug, hotfix (production incident that cannot wait), or a project track listed by `sdlc flow` (use its description). Show the chosen track's steps. Ask the developer to confirm.
8. **Create context:** write a seed JSON (`ticket`, `developer`, `repos[]` with name, path, parent_branch, parent_head, branch from `sdlc branch-name <KEY> "<type>" "<summary>"`, worktree from `worktreeDir`, `branch_created: false`, reason; `risk`) to a temp file and run `sdlc init <KEY> <seed>`; then `sdlc track <KEY> <track>`.
9. **ticket.md:** fill `<plugin>/templates/ticket.md` with a redacted snapshot so later skills work offline.
10. **Jira** (per tracker-operations): transition to `tracker.transitionsBySkill.pickup` (usually In Progress) and comment: picked up by, track and reason, repos, risk, planned branch, next step.
11. **Finish:** `sdlc log <KEY> pickup end "track <t>"`; tell the developer the next skill (`sdlc next <KEY>`).

## Gate
Developer confirms the track (and the repo list when unsure). Never assign the ticket; if unassigned, ask the developer to assign it to themselves.

## Failure handling
Ticket not found: stop, nothing created. Jira write fails: queue under `pending-jira/`, continue. Missing parent branch: ask which to use.
