# Review checklist

Use this checklist when reviewing an agent handoff on OrbitDesk. It is written
for a human reviewer: the agent should already have run the automated gates,
but the automated gates cannot confirm that the change is the *right* change.

Record a decision at the end. "Looks fine" is not a review.

## 1. Scope

- [ ] The diff only implements what the work item asked for.
- [ ] No unrelated refactors, formatting-only churn, or dependency additions.
- [ ] No new files that the brief did not call for.
- [ ] Any deviation from the brief is called out in the handoff with a reason.

## 2. Acceptance criteria

- [ ] Every acceptance criterion in the work item is addressed explicitly.
- [ ] Each criterion has evidence: a test, a request/response, or a UI step.
- [ ] Criteria that are only partially met are marked as such, not silently
      skipped.
- [ ] The agent did not weaken a criterion to match what it built.

## 3. Correctness

- [ ] The status state machine still only allows the transitions defined in
      `app/tickets.js`.
- [ ] `resolvedAt` is stamped when a ticket becomes resolved and cleared when a
      resolved ticket is reopened.
- [ ] SLA due times still come from `app/sla.js`; the policy is not duplicated.
- [ ] Filters still combine correctly and search still covers id, subject,
      requester, and assignee.
- [ ] Ordering is still `createdAt` descending, then id descending, unless the
      brief explicitly changes it.
- [ ] Validation returns 422 with actionable messages and does not mutate state
      on failure.
- [ ] Unknown routes still return JSON 404s, not HTML.

## 4. Tests

- [ ] `npm run check` passes locally on the handed-off commit.
- [ ] New behavior has tests; fixed bugs have a regression test.
- [ ] Tests assert behavior, not implementation details.
- [ ] Boundary cases are covered, not just the happy path.
- [ ] No test was deleted or weakened to make the suite pass.
- [ ] No test depends on the wall clock or on a previous test's state.

## 5. API and data

- [ ] Public response shapes are backward compatible unless the brief says
      otherwise.
- [ ] New fields are documented in `docs/api.md`.
- [ ] Seed data was not edited to make assertions pass.
- [ ] CSV export remains RFC 4180-safe, including quoting and formula
      neutralization.
- [ ] The app remains dependency-free.

## 6. UI

- [ ] The golden path works in a browser, not just in tests.
- [ ] Empty, loading, and error states are handled.
- [ ] Controls are disabled while a request is in flight and recover afterwards.
- [ ] Text is escaped before it is inserted into the DOM.
- [ ] The layout holds at a narrow width and the table remains readable.
- [ ] The reset control still returns the queue to the documented baseline.

## 7. Security and privacy

- [ ] No credentials, tokens, private hostnames, or personal data were added.
- [ ] No `eval`, dynamic script injection, or unsanitized HTML.
- [ ] Request bodies are still size-limited and unknown fields are rejected
      where the API validates input.
- [ ] The app is still local-only by default and has not been made deployable
      as a production service.

## 8. Documentation

- [ ] README still matches how the app actually runs.
- [ ] Architecture notes are updated if module boundaries or invariants changed.
- [ ] New commands, flags, or endpoints are documented.
- [ ] Markdown links resolve; `npm run validate` confirms this.
- [ ] The handoff states what was done, what was verified, and what was not.

## 9. Handoff and delivery

- [ ] The branch name is descriptive and matches the work item.
- [ ] The commit history is understandable without the chat transcript.
- [ ] The handoff reports the test output and any skipped checks.
- [ ] Push or pull-request failures are reported with the exact error, not
      hidden behind a success message.
- [ ] No force-push, history rewrite, or direct push to the default branch.

## Decision

Choose one and write the reason in the work item:

- **Accept** — all criteria are met and evidence is sufficient. The delivery can
  proceed to push and pull request.
- **Accept with follow-up** — the change is safe to merge, but a named follow-up
  is required. Link the follow-up work item.
- **Request changes** — a criterion is unmet or the evidence is insufficient.
  State exactly what must change and how it will be verified.
- **Reject** — the change is out of scope or unsafe. Explain why and close the
  delivery.

A reviewer who cannot verify a claim should request evidence rather than trust
the summary. The purpose of the handoff is to make verification cheap, not to
replace it.
