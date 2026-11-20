# Review loop and budgets (rca, analyze, design)

1. **Draft:** `sdlc budget use <KEY> <doc> author`, write version n.
2. **Reviewer pass** (fresh context): `sdlc budget use <KEY> <doc> reviewer`. Run it as a subagent or a fresh session with only the document, the ticket, steering, the review checklist and (for design) read access to the code. It grades findings **Blocker**, **Critical**, **Major**, **Minor** with `file:line` or section.
3. **Revise** on any Blocker or Critical (next author round). Fix or answer every Major.
4. **Critic pass** (full track only, once, after the last review): `sdlc budget use <KEY> <doc> critic`. Adversarial: what both missed.
5. **Present:** register the version (`sdlc doc register`), show the summary, open findings and `sdlc budget show <KEY> <doc>`, and the exact approval line. Stop.
6. **Developer asks for changes** ("revise: …"): `sdlc budget use <KEY> <doc> cycles`, new version, smaller loop.

- Budgets are maximums: when the reviewer finds no Blocker or Critical, present at once.
- Second reviewer rounds look only at what changed.
- If `sdlc budget use` refuses (exit 6) with a Blocker or Critical open: stop, report the blocker and options (narrow scope, split the ticket, or the developer types `AUTHORIZE REVIEW <KEY> +1`). Never present the document as ready.
- After build: `verify` loops back to `build` at most 3 times; `review` runs at most 2 fix rounds before asking people.
