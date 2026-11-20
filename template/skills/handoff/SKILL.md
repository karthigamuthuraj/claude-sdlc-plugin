---
name: handoff
description: Feature handoff for a pushed {{EDITION_NAME}} ticket - writes handoff.md with what was built against each acceptance criterion, changes per repo, new config keys, migrations, how to run and test, deploy and rollback notes and learnings, then attaches it to Jira and links it from the PR. Runs right after pr, before review.
model: sonnet
---

# handoff

Effort: medium.

## Steps
1. `sdlc gate <KEY> handoff` (PR open), `sdlc log <KEY> handoff start`.
2. **As built:** each AC with what was built and the evidence from `verify-report.md`; approved deviations.
3. **Changes:** files or modules per repo with PR links; API, database and config changes; **new config keys** with category and the environments that need real values (people set them; never write values); migrations and their order.
4. **How to run and test:** local setup, commands, test data, feature flags.
5. **Deploy notes:** cross-repo landing order, rollback steps, known limitations.
6. **Learnings:** what the executor had to ask, what verify or review caught; propose concrete updates to `.sdlc/steering`, templates or checklists as diffs the developer can accept now.
7. **Hotfix:** create (through `sync`, after confirmation) a follow-up ticket for the full fix, a regression sweep and a short post-incident note.
8. **Quick track** (no QA step): propose the worklog with `sdlc worklog <KEY>` for the developer to confirm.
9. Show `handoff.md` for confirmation; then attach to Jira, add a link to the PR description (connector or `gh pr edit --body-file`), `sdlc stage <KEY> handed_off`, `sdlc log <KEY> handoff end`. Next: `review`.
