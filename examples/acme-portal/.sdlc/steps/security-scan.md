# security-scan

1. Run `pip-audit` in `api` and `npm audit --omit=dev` in `web`, only for repos this ticket changed.
2. List High and Critical findings with package, installed version and fixed version.
3. The step fails if this ticket's changes introduce a High or Critical finding; say what to upgrade and stop.
