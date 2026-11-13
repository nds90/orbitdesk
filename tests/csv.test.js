import test from "node:test";
import assert from "node:assert/strict";
import { ticketsToCsv } from "../app/csv.js";

function makeTicket(overrides = {}) {
  return {
    id: "T-2000",
    subject: "Test ticket",
    requester: "test@example.com",
    priority: "high",
    status: "open",
    assignee: null,
    createdAt: "2026-06-01T08:00:00.000Z",
    updatedAt: "2026-06-01T08:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

test("exports a header and one row per ticket", () => {
  const csv = ticketsToCsv([makeTicket()]);
  const lines = csv.trimEnd().split("\r\n");

  assert.equal(lines.length, 2);
  assert.equal(
    lines[0],
    "id,subject,requester,priority,status,assignee,createdAt,slaDueAt,slaBreached",
  );
  assert.match(lines[1], /^"T-2000","Test ticket","test@example.com","high","open","unassigned"/);
});

test("SLA due time and breach flag are derived, not stored", () => {
  const csv = ticketsToCsv(
    [makeTicket()],
    new Date("2026-06-01T13:00:00.000Z"),
  );

  assert.match(csv, /"2026-06-01T12:00:00.000Z","true"$/m);
  assert.doesNotMatch(csv, /slaDueAt.*slaDueAt/);
});

test("resolved tickets are exported as not breached", () => {
  const csv = ticketsToCsv(
    [makeTicket({ status: "resolved", resolvedAt: "2026-06-01T09:00:00.000Z" })],
    new Date("2026-06-02T00:00:00.000Z"),
  );

  assert.match(csv, /"false"$/m);
});

test("quotes commas, quotes, and newlines (RFC 4180)", () => {
  const csv = ticketsToCsv([
    makeTicket({ subject: 'One, two "quoted"\nthird line' }),
  ]);

  assert.ok(csv.includes('"One, two ""quoted""\nthird line"'));
});

test("neutralizes spreadsheet formula prefixes", () => {
  const csv = ticketsToCsv([
    makeTicket({ id: "T-1", subject: "=1+1" }),
    makeTicket({ id: "T-2", subject: "+SUM(A1)" }),
    makeTicket({ id: "T-3", subject: "-2+3" }),
    makeTicket({ id: "T-4", subject: "@cmd" }),
    makeTicket({ id: "T-5", subject: '  =HYPERLINK("http://example.com")' }),
  ]);

  assert.ok(csv.includes(`"'=1+1"`));
  assert.ok(csv.includes(`"'+SUM(A1)"`));
  assert.ok(csv.includes(`"'-2+3"`));
  assert.ok(csv.includes(`"'@cmd"`));
  assert.ok(csv.includes(`"'  =HYPERLINK(""http://example.com"")"`));
});
