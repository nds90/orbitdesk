export const SLA_POLICY_HOURS = Object.freeze({
  urgent: 1,
  high: 4,
  normal: 8,
  low: 24,
});

export function slaDueAt(ticket) {
  const hours = SLA_POLICY_HOURS[ticket.priority];
  if (!hours) throw new Error(`Unknown priority: ${ticket.priority}`);

  const createdAt = Date.parse(ticket.createdAt);
  if (!Number.isFinite(createdAt)) throw new Error(`Invalid createdAt: ${ticket.createdAt}`);

  return new Date(createdAt + hours * 60 * 60 * 1000);
}

export function isSlaBreached(ticket, now = new Date()) {
  if (ticket.status === "resolved") return false;
  return now.getTime() > slaDueAt(ticket).getTime();
}

export function slaRemainingMs(ticket, now = new Date()) {
  return slaDueAt(ticket).getTime() - now.getTime();
}
