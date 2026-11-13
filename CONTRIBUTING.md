# Contributing to OrbitDesk

This repository is a demo fixture for AI-native SDLC workflows, but it follows
the same rules as a small production service. Changes should be easy to review
and easy to verify.

## Local setup

Requirements: Node.js 20 or newer. There is nothing to install.

```bash
npm start       # http://127.0.0.1:3000
npm test
npm run check   # the same command CI runs
```

## Definition of done

A change is complete only when all of the following are true:

1. The requested behavior works in the API and, when user-facing, in the UI.
2. `npm run check` passes.
3. New or changed behavior has tests.
4. Acceptance criteria are traceable to code, tests, or documentation.
5. The API reference and architecture notes are updated if contracts changed.
6. No new runtime dependencies were added.
7. No secrets, tokens, personal data, or machine-specific paths are committed.
8. The handoff states what changed, how it was verified, and any remaining risk.

## Conventions

- Use ECMAScript modules and the existing file layout.
- Keep domain logic pure in `app/tickets.js` and `app/sla.js`; keep HTTP and
  file serving in `app/server.js`.
- Validate at the system boundary. Domain functions return or throw
  `422`-style errors with a `details` array.
- Keep timestamps in UTC ISO 8601 strings. Inject a clock for anything that
  needs "now"; do not call `Date.now()` inside pure functions.
- Keep the UI dependency-free: plain HTML, CSS, and browser modules.
- Use conventional commits, for example `feat: add SLA filter` or
  `fix: quote CSV cells`.
- Use branch names such as `feat/sla-visibility` or `fix/csv-quoting`.

## API changes

The UI and tests consume the same API. When a response changes:

- Prefer additive changes; do not rename or remove existing fields.
- Update every consumer in the same change.
- Update the [API reference](docs/api.md) and the relevant tests.
- Call out any unavoidable breaking change in the pull request.

## Tests

- Pure logic gets unit tests in `tests/tickets.test.js` or `tests/sla.test.js`.
- CSV output gets a serialization test in `tests/csv.test.js`.
- HTTP contract changes get an API test in `tests/api.test.js`.
- Use fixed timestamps (`FIXED_NOW`) so tests never depend on the wall clock.
- Do not delete or weaken an existing test to make a change pass. Explain any
  test that must change.

## Demo data

`data/seed-tickets.json` is demo content. Change it only when a scenario
requires it, and keep the eight-ticket starting state useful:

- at least one breached ticket,
- at least one resolved ticket with a measurable resolution time,
- unassigned and assigned tickets,
- a mix of all four priorities.

## Security and safety

- Never commit credentials or tokens.
- Do not add authentication, persistence, or external services without an
  explicit work item.
- Do not add telemetry or outbound network calls.
- Treat ticket text as untrusted when rendering (escape HTML) and exporting
  (quote CSV, neutralize formula prefixes).

## Review

Use the [review checklist](docs/review-checklist.md) before opening a pull
request. Keep changes focused; separate refactors from behavior changes.
