# Quick install

`<tools>` is any folder you keep plugin files in (for example `C:\dev\tools` or `~/tools`). Full steps: [README.md](README.md#3-install).

## 1. Install sdlc-core (once per developer who creates editions)

    /plugin marketplace add karthigamuthuraj/claude-sdlc-plugin
    /plugin install sdlc-core@concertidc-sdlc

## 2. Create the project's edition (once per project)

    /sdlc-core:new-project

Answer the project name ("Acme Portal"), slug ("acme-portal") and output folder (`<tools>/acme-portal-sdlc`). Without Claude:

    node <tools>/sdlc-core/generator/build-edition.mjs --name "Acme Portal" --out <tools>/acme-portal-sdlc

Push the edition folder to its own git repo for the team.

## 3. Install the edition in the project (every developer)

Open Claude Code in the project root:

    /plugin marketplace add <tools>/acme-portal-sdlc      (or <org>/acme-portal-sdlc)
    /plugin install acme-portal-sdlc@acme-portal-plugins  (project scope)

Restart Claude Code, then:

    /acme-portal-sdlc:setup
    /acme-portal-sdlc:setup doctor

Connect the Atlassian MCP connector for Jira.

## 4. First ticket

    /acme-portal-sdlc:pickup ACME-123

Follow the "Next:" step each skill prints. Lines you type: CONFIRM RCA / APPROVE REQUIREMENTS|DESIGN|BRIEF / APPROVE DEVIATION / CONFIRM COMMIT / CONFIRM PUSH / AUTHORIZE REVIEW.

## 5. Upgrade an edition after a new sdlc-core version

    node <tools>/sdlc-core/generator/build-edition.mjs --upgrade <tools>/acme-portal-sdlc
    /plugin marketplace update acme-portal-plugins
    /plugin update acme-portal-sdlc

## Customise

Add tracks, lifecycle steps or skills without editing generated files: see [CUSTOMIZING.md](CUSTOMIZING.md).
