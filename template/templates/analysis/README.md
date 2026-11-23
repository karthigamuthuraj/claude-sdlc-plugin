# Analysis and plan templates

Used by `analyse-and-plan-ticket`. `ticketAnalysis.templateSet` (config) picks the folder; the skill never asks. Each set has the same two files, named for what they are:

| File | What it holds |
|---|---|
| `requirements-analysis.md` | What the ticket asks, scope, who is affected, acceptance criteria, what is missing, open questions, assumptions, sources |
| `implementation-plan.md` | Approach, plan items (P1, P2...), impact on existing flows, test plan, risks and rollback, effort, security notes |

| Set | Shape |
|---|---|
| `standard` (default) | 8 sections in each file: short and quick to review |
| `detailed` | Adds business goal and stakeholders, functional and non-functional requirements and a traceability table to the analysis; adds a task breakdown by team, data and API changes, dependencies, rollout and monitoring and a definition of done to the plan |

Every file ends with a line naming its template, for example `Template: analysis/standard/requirements-analysis.md`, so you can see which template set and template produced it.

The files written for a ticket are named by `ticketAnalysis.files` (default `<KEY>-requirements-analysis.md` and `<KEY>-implementation-plan.md`).

The requirements analysis has an "Answers from the developer" section: the skill asks the open questions that decide the plan, records your answers there, and builds the plan from them. Only what you could not answer stays under "Open questions".

Placeholders: `{{name}}` required (the skill's material, else "To be confirmed"); `{{?name}}` optional (the section, or just that list or table row, is left out when empty); a table left with no data rows loses its section.

To add a set, copy a folder, give it a name that says what it is (for example `security-review` or `api-change`), edit the two files and set `"templateSet"` in your own `~/.claude/sdlc-core/ticket-analysis.json`. In an edition, `.sdlc/templates/analysis/<set>/` overrides these files.
