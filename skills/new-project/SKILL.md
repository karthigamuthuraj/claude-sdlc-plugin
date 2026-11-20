---
name: new-project
description: Create or upgrade a project's own SDLC plugin edition from sdlc-core. Asks the project name, generates <slug>-sdlc (for example acme-portal-sdlc) with its commands named after the project, and explains how to publish and install it. Use for "set up the SDLC plugin for a new project" or "upgrade our edition".
model: sonnet
---

# new-project

Effort: low. `<core>` is the folder two levels above this file.

## Create
1. Ask for the project name (for example "Acme Portal") and confirm the slug the generator will use (lowercase, dashes: `acme-portal`). The edition will be `<slug>-sdlc` and its commands `/<slug>-sdlc:<skill>`.
2. Ask where to write it (default: next to `sdlc-core`, folder `<slug>-sdlc`).
3. Run `node <core>/generator/build-edition.mjs --name "<Project name>" --slug <slug> --out <folder>`.
4. Report the edition name, version (`<core version>+<slug>.1`) and the next steps:
   - put the edition in its own Git repo (or a team plugin marketplace repo) and push it — people do this;
   - add the marketplace and install: `/plugin marketplace add <repo or path>` then `/plugin install <slug>-sdlc@<marketplace>`;
   - open the project workspace and run `/<slug>-sdlc:setup`.

## Upgrade
1. Ask for the edition folder.
2. Run `node <core>/generator/build-edition.mjs --upgrade <folder>`. If it refuses because files were edited by hand, show the list and help move each change into the project's `.sdlc/` profile or into `sdlc-core`. Use `--force` only if the developer explicitly accepts losing those edits.
3. Report the new version; people publish it and developers run `/plugin update <slug>-sdlc`. If the changelog lists a profile change, run `/<slug>-sdlc:setup --migrate` in each workspace.

## Never
Edit a generated edition by hand; publish or push on the developer's behalf.
