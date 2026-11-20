# Shared ticket context

`<ticket>/context.json` holds everything skills must agree on. Change it only with `sdlc` commands:

| Field | Changed by |
|---|---|
| `ticket`, `developer`, `repos`, `risk` | `sdlc init` (pickup), `sdlc set` |
| `track` | `sdlc track` after the developer confirms |
| `stage` | `sdlc stage` (checks gates) |
| `mode` | `sdlc mode <KEY> readonly|normal` (logs and rca run read-only) |
| `documents` | `sdlc doc register <KEY> <type> <path>` — new version, awaiting approval |
| `approvals`, `confirmations` | only the hook, from lines the developer types |
| `budgets` | `sdlc budget use <KEY> <doc> <author|reviewer|critic|cycles>` |
| `impact` | `sdlc impact <KEY> <repo> <glob…>` from the approved design |
| `tasks`, `criteria` | `sdlc tasks`, `sdlc criterion <KEY> <AC> <status> <evidence>` |
| `deviations` | `sdlc deviation add <KEY> "<what and why>" [files…]` |
| `tracker_actions` | `sdlc tracker-done <KEY> <op> <summary>` |

`repos[]` entries: `name`, `path`, `parent_branch`, `parent_head`, `branch`, `worktree`, `branch_created`, `reason`.

`log.md` gets a row for every start, end, decision, approval, budget use, tracker write and block, with a UTC time.
