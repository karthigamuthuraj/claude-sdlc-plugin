# Quick install

`<tools>` is any folder you keep plugin files in (for example `C:\dev\tools` or `~/tools`). Full steps: [README.md](README.md#3-install).

## 0. Try ticket creation straight from this repo (no edition needed)

From a local clone, load the plugin for one session (no install, uses the live files):

    claude --plugin-dir <path-to>/claude-sdlc-plugin

Then, in that session:

    /sdlc-core:create-ticket <what the ticket is about>

It asks for the space, type, priority, sprint or backlog, and the assignee by selection, shows the draft and creates nothing until you approve. With a project profile (`.sdlc/project.json -> ticketCreation`) it also asks for the application(s) and backend, frontend or both. Editions get the same skill as `/<slug>-sdlc:create-ticket`.

Change the priority list (or the sprint question) at any time in `~/.claude/sdlc-core/ticket-creation.json` (Windows: `%USERPROFILE%\.claude\sdlc-core\ticket-creation.json`); with a project profile use `.sdlc/project.json -> ticketCreation`. The priority choices appear in the order of `priorities.default`, for example `["Highest","High","Medium","Low","Lowest"]`; per-space lists go in `priorities.bySpace.<KEY>`. The question shows four options at a time, so a five-name list shows the first three plus "Low or Lowest...".

## Attachments on tickets (set up once)

The Atlassian connector cannot upload files, so `create-ticket` uploads screenshots, recordings and documents with your own API token. Create a token in your Atlassian account (Security > API tokens), then run this in your own PowerShell (the token is typed hidden; never paste it into a chat):

    & '<path-to>\claude-sdlc-plugin\template\scripts\setup-jira-upload.ps1'

It asks for your Jira site address, your Atlassian email and the API token, and saves them as the user variables `JIRA_BASE_URL`, `JIRA_EMAIL` and `JIRA_API_TOKEN`. Every team member runs it with their own email and token; to change any of them later, run it again (or edit those three user variables). The token is only ever sent to the saved site.

On Windows the saved values are found straight away, no new session needed. The skill checks this before it creates the ticket and, if it is not ready, waits for you to set it up instead of creating the ticket without the files.

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
