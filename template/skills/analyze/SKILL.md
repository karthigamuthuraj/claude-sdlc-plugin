---
name: analyze
description: Define what must be true when a {{EDITION_NAME}} ticket is done - clarify, then write testable requirements with Given/When/Then acceptance criteria (feature) or a bug analysis of current, expected and unchanged behaviour (bug), reviewed within budget and approved by the developer. Writes requirements.md or bugfix.md on the full track, part A of brief.md on standard and bug tracks.
model: opus
---

# analyze

Effort: high. Read `<plugin>/core/lifecycle.md`, `core/review-loop.md`, `core/approvals.md`, `checklists/ready.md`. Clarify step adapted from Superpowers `brainstorming` (MIT).

## Steps
1. `sdlc gate <KEY> analyze`, `sdlc log <KEY> analyze start`, `sdlc budget use <KEY> <doc> author` where `<doc>` is `requirements` / `bugfix` (full) or `brief` (standard, bug).
2. **Clarify first:** check the ticket against the definition of ready. List ambiguities; ask the developer. Questions only the reporter can answer go to Jira as one comment (through `sync`). Blocking questions pause the skill.
3. **Feature:** problem and users; requirements R1..Rn; acceptance criteria AC1..ACn in Given / When / Then, each testable and linked to a requirement; non-functional needs that apply; out of scope; open questions.
4. **Bug:** from the confirmed `rca.md`: current, expected and must-stay-unchanged behaviour; criteria include "the reproduction test passes" and "unchanged behaviour still holds".
5. **Quality check:** no vague words ("fast", "better"), no implementation detail in criteria, every requirement has a criterion, every criterion is testable.
6. Write the document from its template (`requirements.md`, `bugfix.md`, or part A of `brief.md`). Record each criterion: `sdlc criterion <KEY> AC<n> open "<short text>"`.
7. **Full track:** run the review loop, `sdlc doc register <KEY> requirements|bugfix <path>`, ask for `APPROVE REQUIREMENTS <KEY> v<n>`, stop.
   **Standard and bug tracks:** do not register yet; continue straight to `design` in the same session for part B; the brief is approved once.
8. After approval (full track): Jira summary comment and attachment, `sdlc stage <KEY> analyzed`, `sdlc log <KEY> analyze end`.

## Never
Design the solution here; invent requirements the ticket does not support without marking them "derived" and asking.
