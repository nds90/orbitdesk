# Demo scenarios for Qoder Wonder

Each brief below is written to be pasted directly into a **Requirement** work
item. They are intentionally small enough for a single agent run and specific
enough that the result can be reviewed objectively.

Before you start, confirm the baseline is green:

```bash
npm run check
```

## How to use a brief

1. Create a work item of type **Requirement** in the Qoder Wonder workspace.
2. Set the title to the suggested title and paste the brief body into the
   description.
3. Click **Start Delivery** and choose the squad created from the **Solo
   Developer SDLC** template, with **Full-stack Developer** as the agent for the
   first step.
4. Confirm the repository is bound to that employee with read/write permission
   and that the executor is online; the agent clones the repository from that
   binding.
5. Review the artifacts and the handoff before accepting anything.

Each brief ends with the same quality gate. The agent is expected to run it and
report the exact output; reviewers should not accept a handoff without it.

```bash
npm run check
```

---

### Scenario 1 — SLA risk visibility

**Suggested title:** Show tickets that are close to breaching SLA

**Goal:** Make SLA risk visible before a breach happens, not after.

**Context:** The dashboard currently shows only a count of already-breached
tickets. Support leads need to see which open tickets will breach within the
next 60 minutes so they can reassign work in time.

**Scope**

- Add `slaRiskTickets(tickets, now, windowMinutes = 60)` to `app/sla.js`.
- A ticket is at risk when it is not resolved, is not already breached, and its
  `slaDueAt` falls within the next 60 minutes.
- Return the tickets sorted by due time, soonest first.
- Expose the count in `GET /api/stats` as `slaAtRisk` and include the window in
  the response so clients do not hard-code it.
- Show an **At risk** stat card on the dashboard. Clicking it applies the
  existing queue view filtered to the at-risk ticket IDs.
- Keep the existing `slaBreached` field and behavior unchanged.

**Acceptance criteria**

- [ ] At-risk detection uses the existing SLA policy instead of duplicating the
      priority-to-hours table.
- [ ] A ticket exactly at the 60-minute mark is included; a ticket already past
      due is not counted as at risk.
- [ ] Resolved tickets are never reported as at risk.
- [ ] `GET /api/stats` returns `slaAtRisk` and `slaRiskWindowMinutes: 60`.
- [ ] Unit tests cover boundary cases in `tests/sla.test.js`, and the API test
      asserts the value for the seeded data.
- [ ] `docs/api.md`, `docs/architecture.md`, and the README stats description
      are updated.
- [ ] `npm run check` passes.

**Guardrails**

- Do not change the seed data to make tests pass.
- Do not introduce dependencies or a build step.
- Keep the response shape backward compatible.

---

### Scenario 2 — Ticket tags

**Suggested title:** Add tags to tickets and filter the queue by tag

**Goal:** Let the support team classify tickets by product area without
overloading the subject line.

**Context:** Teams currently search for keywords in the subject. That breaks
when wording changes. A small, explicit tag list is enough for the demo.

**Scope**

- Accept an optional `tags` array on ticket creation. Trim values, lowercase
  them, reject duplicates case-insensitively, and allow at most 5 tags of 1–24
  characters each.
- Persist tags on the ticket. Existing seed tickets get meaningful tags such as
  `billing`, `auth`, `export`, and `dashboard`.
- Add a `tag` filter to `GET /api/tickets` and to the UI. The filter matches any
  ticket containing that tag.
- Render tags as small badges in the ticket table.
- Include a `tags` column in CSV export, sorted alphabetically and joined with
  `;`.
- Validation failures return the existing 422 shape with a clear message.

**Acceptance criteria**

- [ ] Tags are normalized consistently on create and on filter.
- [ ] A ticket with no tags exports an empty CSV cell, not the word `null`.
- [ ] Filtering by tag is case-insensitive and combines correctly with the
      status, priority, assignee, and search filters.
- [ ] Tests cover normalization, the 5-tag limit, invalid characters or length,
      combined filters, and CSV output.
- [ ] The create form, filter bar, and table render tags without layout
      regressions.
- [ ] `docs/api.md` documents the new field and filter.
- [ ] `npm run check` passes.

**Guardrails**

- Do not add a tag-management screen; a fixed free-form list is enough.
- Do not change the meaning of the existing `q` search parameter.
- Do not store tags as a comma-separated string in the API response.

---

### Scenario 3 — Bulk resolve with partial failures

**Suggested title:** Resolve multiple tickets in one action

**Goal:** Reduce repetitive work when a single fix closes several tickets.

**Context:** Agents resolve related tickets one at a time. A bulk action is
useful, but it must be safe: one invalid ticket must not silently block or
partially apply the rest without a report.

**Scope**

- Add `POST /api/tickets/bulk-resolve` with a body of
  `{ "ids": ["T-1044", "T-1048"] }`.
- Accept 1–20 unique IDs. Reject an empty list, duplicates, and unknown IDs
  before changing anything.
- Apply the existing resolve transition rules. Tickets that cannot transition
  to `resolved` are reported as failures rather than forced.
- Return `200` with `{ resolved: [...], failed: [{ id, reason }] }` when at
  least one ticket is resolved, and `422` when none can be resolved.
- Add a checkbox column and a **Resolve selected** button to the dashboard.
  Show a toast summarizing successes and failures, then refresh the queue.
- Each successful ticket receives the same `resolvedAt` timestamp for the
  operation.

**Acceptance criteria**

- [ ] Validation happens before any mutation, so a request containing an
      unknown ID changes nothing.
- [ ] Duplicate IDs are rejected with a 422 and a specific message.
- [ ] A ticket already resolved is reported in `failed`, not counted twice.
- [ ] The response distinguishes full success, partial success, and total
      failure.
- [ ] API tests cover success, partial failure, validation failure, and the
      no-mutation-on-validation-error rule.
- [ ] The UI disables the action while the request is in flight and restores it
      afterwards.
- [ ] `docs/api.md` documents the endpoint and response shapes.
- [ ] `npm run check` passes.

**Guardrails**

- Do not add authentication or roles; this is a local demo app.
- Do not add optimistic UI updates that hide failures.
- Do not change the single-ticket PATCH contract.

---

### Scenario 4 — Pagination with stable ordering

**Suggested title:** Paginate the ticket queue without breaking sort order

**Goal:** Keep the dashboard responsive as the queue grows while preserving the
existing newest-first ordering.

**Context:** The queue returns every ticket. The demo needs to show that the
agent can change a public API contract without breaking existing clients.

**Scope**

- Add `page` (default 1) and `pageSize` (default 10, maximum 50) to
  `GET /api/tickets`.
- Return `{ items, total, page, pageSize, pageCount, filters }`, where `total`
  is the filtered count before pagination.
- Keep the current ordering: `createdAt` descending, then `id` descending.
- Reject non-integer or out-of-range values with a 422 and a clear message.
- Add previous/next controls and a "Showing X–Y of Z" label to the dashboard.
- Reset to page 1 when a filter changes, and keep the current page when a
  ticket is updated.
- CSV export must continue to export the full filtered set, not the current
  page.

**Acceptance criteria**

- [ ] The default request returns at most 10 tickets and a correct `total`.
- [ ] No ticket appears on two pages and no ticket is skipped across pages.
- [ ] `pageSize=51`, `page=0`, and `page=abc` return 422.
- [ ] A page beyond the last page returns an empty `items` array with the
      correct metadata, not an error.
- [ ] CSV export is unaffected by pagination and includes all filtered rows.
- [ ] Tests cover defaults, boundaries, stable ordering, and the export rule.
- [ ] The "Showing X–Y of Z" label is correct when the last page is partial.
- [ ] `npm run check` passes.

**Guardrails**

- Do not add infinite scroll or virtualization.
- Do not move filtering or sorting to the client.
- Do not change the CSV endpoint's public behavior.

---

### Scenario 5 — On-call runbook

**Suggested title:** Add an on-call runbook for the support queue

**Goal:** Give a new on-call engineer a short, accurate procedure for triaging
the queue with this app.

**Context:** The README explains how to run the app, but not how to use it
during an incident. The runbook should be practical and grounded in the
existing UI and API.

**Scope**

- Create `docs/runbook.md`.
- Cover the first five minutes: open the dashboard, check `/api/health`, confirm
  the ticket count, and identify breached and unassigned tickets.
- Explain how to triage by priority and SLA, how to reassign a ticket, and how
  to resolve or reopen one using the allowed transitions.
- Include a short escalation section: when to page the queue owner, what to
  capture (ticket IDs, timestamps, exported CSV), and how to hand off.
- Document how to reset demo data and why that must never be done during a real
  incident.
- Add a link to the runbook from the README and from `docs/architecture.md`.

**Acceptance criteria**

- [ ] Every command and UI step in the runbook works exactly as written
      against the current app.
- [ ] The status transition table in the runbook matches `app/tickets.js`.
- [ ] The runbook links to the API reference instead of duplicating it.
- [ ] No credentials, tokens, hostnames, or environment-specific values are
      included.
- [ ] README and architecture links resolve and `npm run check` passes.

**Guardrails**

- Do not change application code for this work item.
- Do not invent tooling that the repository does not use.
- Keep it under two pages; link out for detail.

---

## 15-minute run-of-show

Use Scenario 1 for a live run. It touches every layer in a small way and
produces visible UI evidence.

| Minute | What happens | What the audience should notice |
| --- | --- | --- |
| 0–2 | Open the work item and read the brief aloud | The requirement is specific, scoped, and testable |
| 2–4 | Dispatch to the executor; open the execution graph | The agent plans before it edits |
| 4–8 | Watch artifacts appear: plan, diff, tests, self-review | Evidence is produced, not just a claim of completion |
| 8–11 | Open the diff and the test output | The change follows existing patterns and quality gates |
| 11–13 | Open the handoff; show the branch and PR status | The delivery boundary is explicit and governed |
| 13–15 | Perform human review and transition the item | A person, not the agent, accepts the result |

If the executor cannot push, stop at the handoff and show the exact permission
error. That is a stronger governance story than a silent success.

## Prep checklist

- [ ] `npm run check` passes on the exact commit the executor will clone.
- [ ] The repository is registered in the workspace and the executor is online.
- [ ] The workflow and digital employee are assigned before you present.
- [ ] The work item title, brief, and acceptance criteria are pasted in full.
- [ ] You have a fallback screenshot of a completed run in case the network is
      slow.
- [ ] The demo data is reset so the starting stats are predictable.
- [ ] You know which account is allowed to push the branch and open the PR.

## Expected baseline

After a reset, the queue contains eight tickets:

| Metric | Value |
| --- | --- |
| Total | 8 |
| New | 2 |
| Open | 3 |
| Pending | 1 |
| Resolved | 2 |
| SLA breached | 2 |
| Average resolution | 2.1 hours |

If the numbers differ, the seed data or the clock assumptions changed. Fix that
before demoing; do not explain it away live.
