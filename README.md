# OrbitDesk

A small support-queue application built to be **demoed end to end** with
Qoder Wonder. It has a real UI, a real HTTP API,
a real test suite, and deliberately small scope — enough for an AI agent to
reason about the whole system without drowning in setup.

- Zero runtime dependencies (Node.js 20+ only)
- In-memory store with deterministic seed data and a one-click reset
- Unit and API tests with the built-in `node:test` runner
- Repository validation (`npm run validate`) and GitHub Actions CI
- Five prepared work-item briefs for live Qoder Wonder demos

## Quickstart

```bash
npm start
# open http://127.0.0.1:3000

npm test        # unit + API tests
npm run validate
npm run check   # validate + test, exactly what CI runs
```

There is no install step: the app uses only Node.js built-in modules. Node 20 or
newer is required.

Set `PORT` or `HOST` if the defaults (`127.0.0.1:3000`) are taken:

```bash
PORT=4000 npm start
```

## Demo in Qoder Wonder

The app is the *product*; Qoder Wonder is the *delivery system*. A full demo
looks like this:

1. Push this folder to GitHub or GitLab. The executor's account needs clone
   and push rights so the handoff step can push a branch and open a pull
   request.
2. In your Qoder Wonder workspace, register the repository under
   **Knowledge → Repositories**, then bind it to the **Full-stack Developer**
   with **read/write** permission (approve the change under **Version Review**)
   and confirm the executor is online under **Executors**.
3. Create a **Requirement** work item using a brief from
   [the demo scenarios](docs/demo-scenarios.md), then click **Start Delivery**
   and dispatch it to the squad created from the **Solo Developer SDLC**
   template, with **Full-stack Developer** as the agent for the first step.
4. Watch delivery progress and execution records, then review the evidence,
   tests, diff, and handoff artifacts inside the work item.

The briefs are written as copy-paste requirement documents with scope,
acceptance criteria, guardrails, and validation commands.

> If the executor cannot push, it should stop at handoff and report the exact
> permission error instead of pretending the work shipped. That escalation is
> itself a strong governance demo.

## What the app does

OrbitDesk models a support queue with SLA tracking:

- Tickets have a subject, requester, priority, status, and optional assignee.
- Priorities have SLA windows: urgent 1h, high 4h, normal 8h, low 24h.
- Status follows a state machine: `new → open → pending → resolved`, with
  reopen and resolve transitions where appropriate.
- The dashboard shows queue counts, SLA breaches, and average resolution time.
- The queue supports search, status/priority/assignee filters, inline status
  changes, CSV export, and reset-to-seed for repeatable demos.

See [the architecture notes](docs/architecture.md) for module boundaries and
invariants, and [the API reference](docs/api.md) for request examples.

## Project layout

```text
orbitdesk/
  app/
    server.js          HTTP server, static files, API routing
    tickets.js         validation, state machine, filters, stats
    sla.js             SLA policy and breach calculation
    store.js           in-memory repository with seeded demo data
    csv.js             RFC 4180-safe CSV export
    seed.js            loads and timestamps the seed data
    static/            zero-build HTML, CSS, and browser JS
  data/
    seed-tickets.json  eight realistic demo tickets
  tests/               node:test suites for SLA, tickets, CSV, and API
  scripts/validate.js  links, secrets, package, and doc checks
  docs/                architecture, API, scenarios, review checklist
```

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Liveness and ticket count |
| GET | `/api/tickets` | List and filter tickets |
| POST | `/api/tickets` | Create a ticket |
| GET | `/api/tickets/:id` | Fetch one ticket |
| PATCH | `/api/tickets/:id` | Update status or assignee |
| GET | `/api/stats` | Queue and SLA statistics |
| GET | `/api/tickets.csv` | Export the filtered queue |
| POST | `/api/reset` | Restore seed data |

Full request and response examples live in the [API reference](docs/api.md).

## Quality gates

Every change is expected to pass:

| Command | What it checks |
| --- | --- |
| `npm test` | SLA math, validation, transitions, filters, stats, CSV, HTTP API |
| `npm run validate` | Required files, markdown links, secrets, merge markers, demo briefs |
| `npm run check` | Both of the above, matching CI |

The [review checklist](docs/review-checklist.md) captures the expectations used
during human review of an agent handoff.

## Demo data and reset

The store is intentionally in memory. Start the app and it loads eight tickets
with timestamps relative to the current time, so SLA status is always
meaningful. Use **Reset demo data** in the UI (or `POST /api/reset`) between
walkthroughs to return to the same starting state.

This app is a demo fixture: it has no authentication, no persistence, and
listens on localhost by default. Do not deploy it as a production service.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for the workflow, conventions, and
definition of done. The short version: keep the app dependency-free, add tests
for behavior changes, and keep the public API aligned with the docs.

## License

[MIT](LICENSE)
