# Model selection

Defaults are in `<plugin>/config/models.json`; `project.json -> models` overrides per skill or per track. Each skill's frontmatter names its default model; effort is stated in the skill.

1. **Project override** wins.
2. **Risk escalation:** a risk trigger moves `build` and `verify` to Opus.
3. **Failure escalation:** after two failed attempts at the same task or check, clear the context (`/clear` with a short summary) and continue one level up (Haiku → Sonnet → Opus), higher effort.
4. **Reviewer and critic passes** always run in a fresh context on Opus, high effort.
5. **Cost guard:** `project.json -> costBudget` per track; warn at 80%, stop and ask at 100%. Record notable usage with `sdlc log <KEY> <skill> model "<note>"`.
6. **Fallback:** if a model is unavailable, go one level up, never down, and log it.
