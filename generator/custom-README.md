# {{EDITION_NAME}} — your customisations

This folder belongs to {{PROJECT_NAME}}. The generator never overwrites it, so changes here survive `--upgrade`.

| Put here | Effect |
|---|---|
| `custom/skills/<new-name>/SKILL.md` | Adds a new skill: `/{{EDITION_NAME}}:<new-name>` |
| `custom/skills/<core-name>/SKILL.md` (e.g. `verify`) | Replaces that core skill; upgrade warns when the core version changes |
| `custom/templates/<file>`, `custom/checklists/<file>`, `custom/stacks/<stack>.json` | Replaces or adds a template, checklist or stack pack |
| `custom/lifecycle.json` | Adds tracks and lifecycle steps for every project using this edition |

`scripts/`, `hooks/` and `config/safety.json` hold the safety gates and cannot be overridden unless the build is run with `--allow-core-overrides` after review.

After a change run `node <sdlc-core>/generator/build-edition.mjs --upgrade <this edition>` and then `/plugin update {{EDITION_NAME}}`. Full guide: `CUSTOMIZING.md`.
