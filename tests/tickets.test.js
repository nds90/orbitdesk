import test from "node:test";
import assert from "node:assert/strict";
import {
  applyUpdate,
  computeStats,
  createTicket,
  filterTickets,
  validateNewTicket,
} from "../app/tickets.js";

function makeTicket(overrides = {}) {
  return {
    id: "T-2000",
    subject: "Test ticket",
    requester: "test@example.com",
    priority: "normal",
    status: "open",
    assignee: null,
    createdAt: "2026-06-01T08:00:00.000Z",
    updatedAt: "2026-06-01T08:00:00.000Z",
    resolvedAt: null,
    ...overrides,
  };
}

function assertUpdateError(fn, pattern) {
  assert.throws(fn, (error) => {
    assert.equal(error.status, 422);
    return Array.isArray(error.details) && error.details.some((detail) => pattern.test(detail));
  });
}

test("validates required fields and defaults", () => {
  const valid = validateNewTicket({
    subject: "VPN drops every hour",
    requester: "sam@example.com",
  });
  assert.deepEqual(valid.errors, []);
  assert.equal(valid.value.priority, "normal");
  assert.equal(valid.value.assignee, null);

  const invalid = validateNewTicket({
    subject: "no",
    requester: "not-an-email",
    priority: "critical",
    assignee: "x".repeat(41),
  });
  assert.equal(invalid.errors.length, 4);
});

test("createTicket produces a new ticket in new status", () => {
  const ticket = createTicket(
    {
      subject: "Checkout fails on retry",
      requester: "ana@example.com",
      priority: "high",
      assignee: "  Maya Chen  ",
    },
    { id: "T-3000", now: new Date("2026-06-01T10:00:00.000Z") },
  );

  assert.equal(ticket.id, "T-3000");
  assert.equal(ticket.status, "new");
  assert.equal(ticket.assignee, "Maya Chen");
  assert.equal(ticket.createdAt, "2026-06-01T10:00:00.000Z");
  assert.equal(ticket.resolvedAt, null);
});

test("state transitions follow the queue state machine", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");
  const opened = applyUpdate(makeTicket({ status: "new" }), { status: "open" }, now);
  assert.equal(opened.status, "open");

  assertUpdateError(
    () => applyUpdate(makeTicket({ status: "new" }), { status: "resolved" }, now),
    /cannot move ticket from new to resolved/,
  );
  assertUpdateError(
    () => applyUpdate(makeTicket({ status: "resolved" }), { status: "pending" }, now),
    /cannot move ticket from resolved to pending/,
  );
});

test("resolving and reopening maintain resolvedAt", () => {
  const resolvedAt = new Date("2026-06-01T12:30:00.000Z");
  const resolved = applyUpdate(
    makeTicket({ status: "pending" }),
    { status: "resolved" },
    resolvedAt,
  );
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.resolvedAt, resolvedAt.toISOString());

  const reopened = applyUpdate(resolved, { status: "open" }, new Date("2026-06-01T13:00:00.000Z"));
  assert.equal(reopened.status, "open");
  assert.equal(reopened.resolvedAt, null);
});

test("updates reject unknown fields, empty patches, and bad assignees", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");

  assertUpdateError(() => applyUpdate(makeTicket(), {}, now), /at least one/);
  assertUpdateError(
    () => applyUpdate(makeTicket(), { subject: "nope" }, now),
    /unsupported field/,
  );
  assertUpdateError(
    () => applyUpdate(makeTicket(), { assignee: 42 }, now),
    /must be a string/,
  );
  assertUpdateError(
    () => applyUpdate(makeTicket(), { assignee: "x".repeat(41) }, now),
    /40 characters/,
  );
});

test("filtering combines status, priority, assignee, and search", () => {
  const tickets = [
    makeTicket({
      id: "T-1",
      status: "open",
      priority: "urgent",
      assignee: "Maya Chen",
      createdAt: "2026-06-01T10:00:00.000Z",
    }),
    makeTicket({
      id: "T-2",
      status: "open",
      priority: "low",
      assignee: null,
      createdAt: "2026-06-01T09:00:00.000Z",
    }),
    makeTicket({
      id: "T-3",
      status: "resolved",
      priority: "high",
      assignee: "Leon Park",
      createdAt: "2026-06-01T08:00:00.000Z",
    }),
  ];

  assert.deepEqual(
    filterTickets(tickets, { status: "open" }).map((ticket) => ticket.id),
    ["T-1", "T-2"],
  );
  assert.deepEqual(
    filterTickets(tickets, { priority: "high" }).map((ticket) => ticket.id),
    ["T-3"],
  );
  assert.deepEqual(
    filterTickets(tickets, { assignee: "maya chen" }).map((ticket) => ticket.id),
    ["T-1"],
  );
  assert.deepEqual(
    filterTickets(tickets, { assignee: "unassigned" }).map((ticket) => ticket.id),
    ["T-2"],
  );
  assert.deepEqual(
    filterTickets(tickets, { q: "t-3" }).map((ticket) => ticket.id),
    ["T-3"],
  );
});

test("sorting is newest first with a stable id tie-break", () => {
  const tickets = [
    makeTicket({ id: "T-1", createdAt: "2026-06-01T08:00:00.000Z" }),
    makeTicket({ id: "T-4", createdAt: "2026-06-01T09:00:00.000Z" }),
    makeTicket({ id: "T-3", createdAt: "2026-06-01T09:00:00.000Z" }),
  ];

  assert.deepEqual(
    filterTickets(tickets).map((ticket) => ticket.id),
    ["T-4", "T-3", "T-1"],
  );
});

test("stats count statuses, breaches, and average resolution time", () => {
  const now = new Date("2026-06-01T12:00:00.000Z");
  const tickets = [
    makeTicket({
      id: "T-1",
      status: "open",
      priority: "urgent",
      createdAt: "2026-06-01T10:00:00.000Z",
    }),
    makeTicket({
      id: "T-2",
      status: "resolved",
      priority: "high",
      createdAt: "2026-06-01T08:00:00.000Z",
      resolvedAt: "2026-06-01T09:00:00.000Z",
    }),
    makeTicket({
      id: "T-3",
      status: "new",
      priority: "normal",
      createdAt: "2026-06-01T11:00:00.000Z",
    }),
    makeTicket({
      id: "T-4",
      status: "resolved",
      priority: "low",
      createdAt: "2026-06-01T06:00:00.000Z",
      resolvedAt: "2026-06-01T09:00:00.000Z",
    }),
  ];

  const stats = computeStats(tickets, now);
  assert.equal(stats.total, 4);
  assert.deepEqual(stats.byStatus, { new: 1, open: 1, pending: 0, resolved: 2 });
  assert.equal(stats.slaBreached, 1);
  assert.equal(stats.averageResolutionHours, 2);
});

test("average resolution time is null when nothing is resolved", () => {
  const stats = computeStats([makeTicket({ status: "open" })]);
  assert.equal(stats.averageResolutionHours, null);
});
