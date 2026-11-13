import test from "node:test";
import assert from "node:assert/strict";
import {
  SLA_POLICY_HOURS,
  isSlaBreached,
  slaDueAt,
  slaRemainingMs,
} from "../app/sla.js";

function makeTicket(overrides = {}) {
  return {
    id: "T-2000",
    subject: "Test ticket",
    requester: "test@example.com",
    priority: "high",
    status: "open",
    assignee: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

test("policy defines an SLA window for every priority", () => {
  assert.deepEqual(Object.keys(SLA_POLICY_HOURS).sort(), [
    "high",
    "low",
    "normal",
    "urgent",
  ]);
  assert.equal(SLA_POLICY_HOURS.urgent, 1);
  assert.equal(SLA_POLICY_HOURS.high, 4);
  assert.equal(SLA_POLICY_HOURS.normal, 8);
  assert.equal(SLA_POLICY_HOURS.low, 24);
});

test("slaDueAt adds the policy window to createdAt", () => {
  const due = slaDueAt(makeTicket({ priority: "high" }));
  assert.equal(due.toISOString(), "2026-01-01T04:00:00.000Z");

  const urgentDue = slaDueAt(makeTicket({ priority: "urgent" }));
  assert.equal(urgentDue.toISOString(), "2026-01-01T01:00:00.000Z");
});

test("unknown priorities and invalid timestamps are rejected", () => {
  assert.throws(() => slaDueAt(makeTicket({ priority: "critical" })), /Unknown priority/);
  assert.throws(() => slaDueAt(makeTicket({ createdAt: "not-a-date" })), /Invalid createdAt/);
});

test("a ticket is breached only after the due time", () => {
  const ticket = makeTicket({ priority: "high" });

  assert.equal(isSlaBreached(ticket, new Date("2026-01-01T03:59:59.999Z")), false);
  assert.equal(isSlaBreached(ticket, new Date("2026-01-01T04:00:00.000Z")), false);
  assert.equal(isSlaBreached(ticket, new Date("2026-01-01T04:00:00.001Z")), true);
});

test("resolved tickets are never counted as breached", () => {
  const resolved = makeTicket({
    status: "resolved",
    resolvedAt: "2026-01-01T02:00:00.000Z",
  });

  assert.equal(isSlaBreached(resolved, new Date("2026-02-01T00:00:00.000Z")), false);
});

test("remaining time becomes negative once the SLA is exceeded", () => {
  const ticket = makeTicket({ priority: "urgent" });

  assert.equal(
    slaRemainingMs(ticket, new Date("2026-01-01T00:30:00.000Z")),
    30 * 60 * 1000,
  );
  assert.equal(
    slaRemainingMs(ticket, new Date("2026-01-01T01:30:00.000Z")),
    -30 * 60 * 1000,
  );
});
