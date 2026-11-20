# Review checklist (core)

- [ ] Meets every acceptance criterion; nothing outside the approved scope
- [ ] Correctness: edge cases, empty and null inputs, error paths, concurrency
- [ ] Error handling at boundaries; no silent excepts
- [ ] Security: input validation, authz checks, injection, secrets not logged
- [ ] Personal and patient data: not logged, not sent to new places, minimised
- [ ] API and payload compatibility with every consumer in the cross-repo map
- [ ] Database: migrations reversible, data backfill handled
- [ ] Tests: each AC and each regression risk covered; tests fail without the change
- [ ] No dead code, debug prints, commented-out code, unused imports
- [ ] Comments only for the non-obvious why; names clear
- [ ] Config: new keys in templates with placeholders, wired in settings code
