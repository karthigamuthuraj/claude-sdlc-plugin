# Quick install

`<tools>` is any folder you keep plugin files in (for example `C:\dev\tools` or `~/tools`). Full steps: [README.md](README.md#3-install).

## 0. Try ticket creation straight from this repo (no edition needed)

From a local clone, load the plugin for one session (no install, uses the live files):

    claude --plugin-dir <path-to>/claude-sdlc-plugin

Then, in that session:

    /sdlc-core:create-ticket <what the ticket is about>

It asks for the space, type, priority, sprint or backlog, and the assignee by selection, shows the draft and creates nothing until you approve. With a project profile (`.sdlc/project.json -> ticketCreation`) it also asks for the application(s) and backend, frontend or both. Editions get the same skill as `/<slug>-sdlc:create-ticket`.

Change the priority list (or the sprint question) at any time in `~/.claude/sdlc-core/ticket-creation.json` (Windows: `%USERPROFILE%\.claude\sdlc-core\ticket-creation.json`); with a project profile use `.sdlc/project.json -> ticketCreation`. The priority choices appear in the order of `priorities.default`, for example `["Highest","High","Medium","Low","Lowest"]`; per-space lists go in `priorities.bySpace.<KEY>`. The question shows four options at a time, so a five-name list shows the first three plus "Low or Lowest...".

## Attachments on tickets (nothing to set up)

The Atlassian connector cannot upload files, so `create-ticket` uploads screenshots, recordings and documents with your own Jira API token. You install and configure nothing: the first time you give the skill a file it reads your email and site from the connector and asks once for the token (Atlassian account > Security > API tokens > Create API token, paste it in the answer box). It tests the token and saves the login in your own folder, `~/.claude/sdlc-core/jira-upload.json` (Windows: `%USERPROFILE%\.claude\sdlc-core\jira-upload.json`), never in a repo. From then on uploads are automatic. To change the login, delete that file (the skill asks again) or set `JIRA_EMAIL`, `JIRA_API_TOKEN` and `JIRA_BASE_URL` in the environment, which override it.

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
