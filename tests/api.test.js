import test, { after, before } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "../app/server.js";
import { createStore } from "../app/store.js";
import { buildSeedTickets } from "../app/seed.js";

const FIXED_NOW = new Date("2026-06-01T12:00:00.000Z");
const clock = () => FIXED_NOW;

let server;
let baseUrl;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const isJson = response.headers.get("content-type")?.includes("application/json");
  return {
    status: response.status,
    headers: response.headers,
    body: isJson ? await response.json() : await response.text(),
  };
}

async function reset() {
  const response = await request("/api/reset", { method: "POST" });
  assert.equal(response.status, 200, "reset must succeed");
}

before(async () => {
  const store = createStore({
    seed: buildSeedTickets(FIXED_NOW),
    now: clock,
  });
  server = createServer({ store, clock });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(() => new Promise((resolve) => server.close(resolve)));

test("health endpoint reports the seeded store", async () => {
  const { status, body } = await request("/api/health");
  assert.equal(status, 200);
  assert.equal(body.status, "ok");
  assert.equal(body.tickets, 8);
});

test("list endpoint returns seeded tickets newest first", async () => {
  await reset();
  const { status, body } = await request("/api/tickets");

  assert.equal(status, 200);
  assert.equal(body.total, 8);
  assert.equal(body.items[0].id, "T-1048");
  assert.equal(body.filters.q, undefined);
});

test("filters combine and search across fields", async () => {
  await reset();

  const resolved = await request("/api/tickets?status=resolved");
  assert.equal(resolved.body.total, 2);
  assert.ok(resolved.body.items.every((ticket) => ticket.status === "resolved"));

  const invoice = await request("/api/tickets?q=invoice");
  assert.equal(invoice.body.total, 1);
  assert.equal(invoice.body.items[0].id, "T-1042");

  const unassigned = await request("/api/tickets?assignee=unassigned");
  assert.equal(unassigned.body.total, 3);

  const combined = await request("/api/tickets?status=open&priority=urgent");
  assert.deepEqual(combined.body.items.map((ticket) => ticket.id), ["T-1041"]);
});

test("stats report queue health at the server clock", async () => {
  await reset();
  const { status, body } = await request("/api/stats");

  assert.equal(status, 200);
  assert.equal(body.stats.total, 8);
  assert.deepEqual(body.stats.byStatus, {
    new: 2,
    open: 3,
    pending: 1,
    resolved: 2,
  });
  assert.equal(body.stats.slaBreached, 2);
  assert.equal(body.stats.averageResolutionHours, 2.1);
});

test("creates a ticket and enforces validation errors", async () => {
  await reset();

  const invalid = await request("/api/tickets", {
    method: "POST",
    body: JSON.stringify({ subject: "no" }),
  });
  assert.equal(invalid.status, 422);
  assert.ok(Array.isArray(invalid.body.details));

  const created = await request("/api/tickets", {
    method: "POST",
    body: JSON.stringify({
      subject: "Keyboard shortcut conflict on Windows",
      requester: "ana@example.com",
      priority: "high",
      assignee: "Maya Chen",
    }),
  });

  assert.equal(created.status, 201);
  assert.equal(created.body.ticket.id, "T-1049");
  assert.equal(created.body.ticket.status, "new");
  assert.equal(created.body.ticket.assignee, "Maya Chen");
});

test("state transitions are validated and update resolvedAt", async () => {
  await reset();

  const created = await request("/api/tickets", {
    method: "POST",
    body: JSON.stringify({
      subject: "Payment webhook retries twice",
      requester: "finance@example.com",
    }),
  });
  const id = created.body.ticket.id;

  const skipped = await request(`/api/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "resolved" }),
  });
  assert.equal(skipped.status, 422);

  const opened = await request(`/api/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "open" }),
  });
  assert.equal(opened.status, 200);
  assert.equal(opened.body.ticket.status, "open");

  const resolved = await request(`/api/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "resolved" }),
  });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.ticket.resolvedAt, FIXED_NOW.toISOString());

  const reopened = await request(`/api/tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ status: "open" }),
  });
  assert.equal(reopened.status, 200);
  assert.equal(reopened.body.ticket.resolvedAt, null);
});

test("missing tickets return 404 and unsupported routes return 404", async () => {
  const missing = await request("/api/tickets/T-9999");
  assert.equal(missing.status, 404);
  assert.equal(missing.body.error, "Ticket not found");

  const unknown = await request("/api/nope");
  assert.equal(unknown.status, 404);
});

test("CSV export uses the filtered queue", async () => {
  await reset();
  const { status, headers, body } = await request("/api/tickets.csv?status=resolved");

  assert.equal(status, 200);
  assert.match(headers.get("content-type"), /text\/csv/);
  assert.match(headers.get("content-disposition"), /orbitdesk-tickets\.csv/);

  const lines = String(body).trimEnd().split("\r\n");
  assert.equal(lines.length, 3);
  assert.ok(lines[0].startsWith("id,subject,requester,priority,status"));
  assert.ok(lines[1].includes("T-1046"));
  assert.ok(lines[2].includes("T-1047"));
});
