import { isSlaBreached } from "./sla.js";

export const PRIORITIES = ["low", "normal", "high", "urgent"];
export const STATUSES = ["new", "open", "pending", "resolved"];

export const TRANSITIONS = Object.freeze({
  new: Object.freeze(["open"]),
  open: Object.freeze(["pending", "resolved"]),
  pending: Object.freeze(["open", "resolved"]),
  resolved: Object.freeze(["open"]),
});

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function httpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

export function validateNewTicket(input) {
  const errors = [];
  const safe = input && typeof input === "object" ? input : {};

  const subject = typeof safe.subject === "string" ? safe.subject.trim() : "";
  if (subject.length < 5 || subject.length > 120) {
    errors.push("subject must be between 5 and 120 characters");
  }

  const requester = typeof safe.requester === "string" ? safe.requester.trim() : "";
  if (!EMAIL_PATTERN.test(requester)) {
    errors.push("requester must be a valid email address");
  }

  const priority = safe.priority ?? "normal";
  if (!PRIORITIES.includes(priority)) {
    errors.push(`priority must be one of: ${PRIORITIES.join(", ")}`);
  }

  let assignee = null;
  if (safe.assignee !== undefined && safe.assignee !== null) {
    if (typeof safe.assignee !== "string") {
      errors.push("assignee must be a string or null");
    } else {
      assignee = safe.assignee.trim() || null;
      if (assignee && assignee.length > 40) {
        errors.push("assignee must be 40 characters or fewer");
      }
    }
  }

  return { errors, value: { subject, requester, priority, assignee } };
}

export function createTicket(input, { id, now = new Date() } = {}) {
  const { errors, value } = validateNewTicket(input);
  if (errors.length) throw httpError(422, "Invalid ticket", errors);

  const timestamp = now.toISOString();
  return {
    id: id ?? "T-1000",
    subject: value.subject,
    requester: value.requester,
    priority: value.priority,
    status: "new",
    assignee: value.assignee,
    createdAt: timestamp,
    updatedAt: timestamp,
    resolvedAt: null,
  };
}

export function applyUpdate(ticket, patch, now = new Date()) {
  const errors = [];
  const safe = patch && typeof patch === "object" ? patch : {};
  const keys = Object.keys(safe);

  if (keys.length === 0) {
    errors.push("patch must include at least one of: status, assignee");
  }
  for (const key of keys) {
    if (!["status", "assignee"].includes(key)) {
      errors.push(`unsupported field: ${key}`);
    }
  }

  let status = ticket.status;
  let resolvedAt = ticket.resolvedAt;
  if (Object.hasOwn(safe, "status")) {
    if (!STATUSES.includes(safe.status)) {
      errors.push(`status must be one of: ${STATUSES.join(", ")}`);
    } else if (!TRANSITIONS[ticket.status].includes(safe.status)) {
      errors.push(`cannot move ticket from ${ticket.status} to ${safe.status}`);
    } else {
      status = safe.status;
      resolvedAt = status === "resolved" ? now.toISOString() : null;
    }
  }

  let assignee = ticket.assignee;
  if (Object.hasOwn(safe, "assignee")) {
    if (safe.assignee === null) {
      assignee = null;
    } else if (typeof safe.assignee !== "string") {
      errors.push("assignee must be a string or null");
    } else {
      assignee = safe.assignee.trim() || null;
      if (assignee && assignee.length > 40) {
        errors.push("assignee must be 40 characters or fewer");
      }
    }
  }

  if (errors.length) throw httpError(422, "Invalid update", errors);

  return {
    ...ticket,
    status,
    assignee,
    resolvedAt,
    updatedAt: now.toISOString(),
  };
}

export function filterTickets(tickets, { status, priority, assignee, q } = {}) {
  const search = q?.trim().toLowerCase();

  return tickets
    .filter((ticket) => {
      if (status && ticket.status !== status) return false;
      if (priority && ticket.priority !== priority) return false;

      if (assignee) {
        if (assignee === "unassigned") {
          if (ticket.assignee) return false;
        } else if ((ticket.assignee ?? "").toLowerCase() !== assignee.toLowerCase()) {
          return false;
        }
      }

      if (search) {
        const haystack = [
          ticket.id,
          ticket.subject,
          ticket.requester,
          ticket.assignee ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(search)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      const createdDiff = Date.parse(b.createdAt) - Date.parse(a.createdAt);
      return createdDiff !== 0 ? createdDiff : b.id.localeCompare(a.id);
    });
}

export function computeStats(tickets, now = new Date()) {
  const byStatus = Object.fromEntries(STATUSES.map((status) => [status, 0]));
  let slaBreached = 0;
  const resolutionDurations = [];

  for (const ticket of tickets) {
    if (byStatus[ticket.status] !== undefined) byStatus[ticket.status] += 1;
    if (isSlaBreached(ticket, now)) slaBreached += 1;

    if (ticket.status === "resolved" && ticket.resolvedAt) {
      const duration = Date.parse(ticket.resolvedAt) - Date.parse(ticket.createdAt);
      if (Number.isFinite(duration) && duration >= 0) resolutionDurations.push(duration);
    }
  }

  const averageResolutionHours = resolutionDurations.length
    ? Number(
        (
          resolutionDurations.reduce((sum, duration) => sum + duration, 0) /
          resolutionDurations.length /
          3_600_000
        ).toFixed(1),
      )
    : null;

  return {
    total: tickets.length,
    byStatus,
    slaBreached,
    averageResolutionHours,
  };
}
