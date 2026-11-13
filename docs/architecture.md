# Architecture

OrbitDesk is intentionally small: one Node.js process serves a static UI and a
JSON API, and keeps all state in memory. The point is to give an AI agent (and a
human reviewer) a complete system that fits in one context window.

## Runtime topology

```text
Browser (plain HTML/CSS/ES modules)
        │  fetch /api/*
        ▼
app/server.js  ── routing, validation errors, static files
        │
        ├── app/tickets.js ── validation, transitions, filters, stats
        ├── app/sla.js     ── SLA policy, due time, breach calculation
        ├── app/csv.js     ── CSV serialization
        └── app/store.js   ── in-memory tickets, seeded from data/
```

There is no database, no build step, and no runtime dependency. Tests import the
same modules the server uses, and exercise the HTTP layer on an ephemeral port.

## Module responsibilities

| Module | Owns | Does not own |
| --- | --- | --- |
| `app/server.js` | HTTP parsing, routing, static files, status codes | Domain rules |
| `app/tickets.js` | Validation, state machine, filtering, statistics | Persistence, HTTP |
| `app/sla.js` | SLA windows, due time, breach calculation | Ticket storage |
| `app/csv.js` | CSV escaping and export columns | Filtering |
| `app/store.js` | In-memory collection and ID allocation | Domain validation |
| `app/seed.js` | Reading seed rows and applying relative timestamps | HTTP |
| `app/static/*` | Rendering, filters, create form, status actions | Business rules |

## Ticket model

| Field | Type | Notes |
| --- | --- | --- |
| `id` | string | `T-####`, allocated by the store |
| `subject` | string | 5–120 characters after trimming |
| `requester` | string | Email-shaped string |
| `priority` | enum | `low`, `normal`, `high`, `urgent` |
| `status` | enum | `new`, `open`, `pending`, `resolved` |
| `assignee` | string or null | At most 40 characters |
| `createdAt` | ISO string | UTC |
| `updatedAt` | ISO string | UTC |
| `resolvedAt` | ISO string or null | Cleared on reopen |

## Status state machine

```text
new ──► open ──► pending ──► resolved
         │          │            │
         └──────────┴────────────┘
            resolve / reopen
```

Allowed transitions:

| From | To |
| --- | --- |
| `new` | `open` |
| `open` | `pending`, `resolved` |
| `pending` | `open`, `resolved` |
| `resolved` | `open` |

A direct `new → resolved` transition is invalid. Resolving stamps `resolvedAt`;
reopening clears it.

## SLA policy

| Priority | Response window |
| --- | --- |
| urgent | 1 hour |
| high | 4 hours |
| normal | 8 hours |
| low | 24 hours |

`isSlaBreached` returns false for resolved tickets, and true only when the
current time is strictly later than `createdAt + window`. Statistics and CSV
export both derive breach state; it is never persisted.

## Request lifecycle

1. The browser calls `/api/tickets` with optional filters.
2. `server.js` parses query parameters and calls `filterTickets`.
3. The store returns copies of tickets; filtering sorts newest first with an ID
   tie-break.
4. The server serializes `{ items, total, filters }`.
5. Mutations call the domain layer, which validates fields and transitions
   before the store replaces the record.

Errors are JSON `{ error, details? }`. Validation failures use `422`, missing
records use `404`, oversized bodies use `413`.

## Design invariants

- **Pure domain logic.** Time-dependent functions accept a `now` argument.
- **No hidden state.** The store is the only mutable component.
- **UTC everywhere.** Timestamps are ISO strings; the UI formats them locally
  for display only.
- **Stable ordering.** Newest `createdAt` first, then descending ID.
- **Safe rendering and export.** The UI escapes all ticket text; CSV quotes
  fields and neutralizes formula prefixes.
- **No persistence.** Restarting the process reseeds from `data/`.

## Where demo features land

| Feature type | Likely touch points |
| --- | --- |
| SLA visibility | `app/sla.js`, `app/server.js`, static UI, API tests |
| Tags | `app/tickets.js`, `app/store.js`, seed data, UI, API tests |
| Bulk actions | `app/server.js`, `app/tickets.js`, UI, API tests |
| Pagination | `app/server.js`, UI, API tests, API docs |
| Documentation | `docs/`, README links, validation script |

## Non-goals

Authentication, persistence, multi-tenancy, background jobs, notifications,
and deployment automation are out of scope. The app is a demo fixture; keep it
small and observable.
