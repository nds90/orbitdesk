# API reference

Base URL: `http://127.0.0.1:3000`. All request and response bodies are JSON
unless noted. See the [architecture notes](architecture.md) for domain rules.

## Conventions

- Timestamps are UTC ISO 8601 strings.
- Successful responses use `200`, `201`, or `204` semantics; this app returns
  JSON bodies for all mutations.
- Errors use `{ "error": "...", "details": ["..."] }`. `details` is present for
  validation errors.
- Filters accept empty strings as "no filter".

## Health

```bash
curl http://127.0.0.1:3000/api/health
```

```json
{
  "status": "ok",
  "tickets": 8,
  "uptimeSeconds": 42
}
```

## List tickets

```bash
curl "http://127.0.0.1:3000/api/tickets?status=open&priority=urgent&q=safari"
```

Query parameters:

| Name | Values | Behavior |
| --- | --- | --- |
| `q` | text | Case-insensitive match on ID, subject, requester, assignee |
| `status` | `new`, `open`, `pending`, `resolved` | Exact match |
| `priority` | `low`, `normal`, `high`, `urgent` | Exact match |
| `assignee` | name or `unassigned` | Case-insensitive match; `unassigned` matches null |

Response:

```json
{
  "items": [
    {
      "id": "T-1041",
      "subject": "Checkout returns HTTP 502 for Safari users",
      "requester": "maya.chen@example.com",
      "priority": "urgent",
      "status": "open",
      "assignee": "Maya Chen",
      "createdAt": "2026-06-01T10:25:00.000Z",
      "updatedAt": "2026-06-01T10:25:00.000Z",
      "resolvedAt": null
    }
  ],
  "total": 1,
  "filters": {
    "status": "open",
    "priority": "urgent",
    "q": "safari"
  }
}
```

Tickets are sorted newest first, with descending ID as the tie-break.

## Get one ticket

```bash
curl http://127.0.0.1:3000/api/tickets/T-1041
```

```json
{
  "ticket": {
    "id": "T-1041",
    "subject": "Checkout returns HTTP 502 for Safari users",
    "requester": "maya.chen@example.com",
    "priority": "urgent",
    "status": "open",
    "assignee": "Maya Chen",
    "createdAt": "2026-06-01T10:25:00.000Z",
    "updatedAt": "2026-06-01T10:25:00.000Z",
    "resolvedAt": null
  }
}
```

Missing IDs return `404` with `{ "error": "Ticket not found" }`.

## Create a ticket

```bash
curl -X POST http://127.0.0.1:3000/api/tickets \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "Keyboard shortcut conflict on Windows",
    "requester": "ana@example.com",
    "priority": "high",
    "assignee": "Maya Chen"
  }'
```

Returns `201` with `{ "ticket": { ... } }`. New tickets start in `new` status.

Rules:

- `subject`: 5–120 characters after trimming.
- `requester`: email-shaped string.
- `priority`: one of the four priorities; defaults to `normal`.
- `assignee`: optional string up to 40 characters; blank becomes `null`.

Invalid payloads return `422`:

```json
{
  "error": "Invalid ticket",
  "details": [
    "subject must be between 5 and 120 characters",
    "requester must be a valid email address"
  ]
}
```

## Update a ticket

```bash
curl -X PATCH http://127.0.0.1:3000/api/tickets/T-1041 \
  -H "Content-Type: application/json" \
  -d '{ "status": "pending" }'
```

Only `status` and `assignee` are accepted. Sending an empty object, an unknown
field, or an illegal transition returns `422`.

Transition rules:

| From | Allowed targets |
| --- | --- |
| `new` | `open` |
| `open` | `pending`, `resolved` |
| `pending` | `open`, `resolved` |
| `resolved` | `open` |

Resolving sets `resolvedAt` to the current time; reopening clears it.

## Statistics

```bash
curl http://127.0.0.1:3000/api/stats
```

```json
{
  "stats": {
    "total": 8,
    "byStatus": { "new": 2, "open": 3, "pending": 1, "resolved": 2 },
    "slaBreached": 2,
    "averageResolutionHours": 2.1
  }
}
```

`averageResolutionHours` is `null` when no tickets are resolved.

## CSV export

```bash
curl -o tickets.csv "http://127.0.0.1:3000/api/tickets.csv?status=resolved"
```

Returns `text/csv` with an attachment filename. The same filters as the list
endpoint apply. Columns:

```text
id,subject,requester,priority,status,assignee,createdAt,slaDueAt,slaBreached
```

Cells are quoted per RFC 4180. Cells that start with `=`, `+`, `-`, or `@`
(optionally after whitespace) are prefixed with an apostrophe so spreadsheet
software treats them as text.

## Reset demo data

```bash
curl -X POST http://127.0.0.1:3000/api/reset
```

```json
{ "reset": true, "total": 8 }
```

Reseeds the in-memory store with relative timestamps based on the current time.

## Status codes

| Code | Meaning |
| --- | --- |
| `200` | Success |
| `201` | Ticket created |
| `400` | Malformed JSON body |
| `404` | Unknown route, or ticket not found |
| `405` | Unsupported method on a static route |
| `413` | Request body larger than 64 KB |
| `422` | Validation or transition error |
| `500` | Unexpected server error |
