# {KEY} root cause analysis — v{n}

## Reproduction
- Smallest failing test or script: `path::test_name`
- Result before the fix:

## Behaviour
| Current | Expected | Must stay unchanged |
|---|---|---|

## Trace
Path from entry point to the first wrong behaviour, with `file:line`. Relevant commits (`git log` / `git blame`).

## Root cause
- **Trigger:**
- **Defect:**
- **Contributing factors:** (missing validation, missing test, unclear contract)
- **Label:** VERIFIED / NOT VERIFIED, with the evidence

## Blast radius
Other callers, repos, data affected; whether data needs correcting.

## Fix options
| Option | Change | Risk | Effort |
|---|---|---|---|
Recommended option and why. How to prevent this class of bug (test, check, guard).

## Open questions
