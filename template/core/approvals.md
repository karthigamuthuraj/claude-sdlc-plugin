# Approvals and confirmations

Only lines the developer types, each on its own line, count. The `UserPromptSubmit` hook records them in the context and binds them to a file hash or the staged diff.

| Line | Effect |
|---|---|
| `CONFIRM RCA <KEY> v<n>` | Root cause confirmed (bug, hotfix) |
| `APPROVE REQUIREMENTS <KEY> v<n>` | Requirements or bug analysis approved (full) |
| `APPROVE DESIGN <KEY> v<n>` | Design approved (full) |
| `APPROVE BRIEF <KEY> v<n>` | Brief approved (standard, bug) |
| `… TECHLEAD <name>` appended | Tech-lead approval on risk triggers |
| `APPROVE DEVIATION <KEY> D<n>` | A recorded deviation may proceed |
| `CONFIRM COMMIT <KEY>` | Single-use; valid only for exactly what is staged now |
| `CONFIRM PUSH <KEY>` | Single-use per repo; task branch only |
| `AUTHORIZE REVIEW <KEY> +<n>` | Extra review rounds; never an approval |

- Editing a document after approval voids the approval. A changed root cause or requirements document makes later documents stale.
- "Looks good", silence, or a reviewer's verdict is never an approval. Ask for the exact line.
- Deviations: minor ones (different helper, extra test file) use `sdlc deviation add` and wait for the line; major ones (changed requirement, new scope, another repo, API or database change) need a new document version and re-approval.
