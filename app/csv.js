import { isSlaBreached, slaDueAt } from "./sla.js";

const COLUMNS = [
  "id",
  "subject",
  "requester",
  "priority",
  "status",
  "assignee",
  "createdAt",
  "slaDueAt",
  "slaBreached",
];

// Spreadsheet apps interpret leading =, +, -, and @ as formulas. Prefix the
// cell with an apostrophe so exported user content is always treated as text.
function neutralizeFormula(value) {
  const text = value == null ? "" : String(value);
  return /^[\t\r ]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  const text = neutralizeFormula(value).replace(/"/g, '""');
  return `"${text}"`;
}

export function ticketsToCsv(tickets, now = new Date()) {
  const lines = [COLUMNS.join(",")];

  for (const ticket of tickets) {
    const row = [
      ticket.id,
      ticket.subject,
      ticket.requester,
      ticket.priority,
      ticket.status,
      ticket.assignee ?? "unassigned",
      ticket.createdAt,
      slaDueAt(ticket).toISOString(),
      isSlaBreached(ticket, now),
    ];
    lines.push(row.map(csvCell).join(","));
  }

  return `${lines.join("\r\n")}\r\n`;
}
