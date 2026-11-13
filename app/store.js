import { buildSeedTickets } from "./seed.js";
import { applyUpdate, createTicket } from "./tickets.js";

function maxSequence(tickets) {
  return tickets.reduce((max, ticket) => {
    const sequence = Number.parseInt(ticket.id.replace(/^T-/, ""), 10);
    return Number.isFinite(sequence) ? Math.max(max, sequence) : max;
  }, 1000);
}

export function createStore({ seed, now = () => new Date() } = {}) {
  const initialSeed = seed ? seed.map((ticket) => ({ ...ticket })) : null;
  let tickets = initialSeed
    ? initialSeed.map((ticket) => ({ ...ticket }))
    : buildSeedTickets(now());
  let nextNumber = maxSequence(tickets) + 1;

  return {
    list() {
      return tickets.map((ticket) => ({ ...ticket }));
    },

    get(id) {
      const ticket = tickets.find((candidate) => candidate.id === id);
      return ticket ? { ...ticket } : null;
    },

    create(input) {
      const ticket = createTicket(input, {
        id: `T-${nextNumber}`,
        now: now(),
      });
      nextNumber += 1;
      tickets.push(ticket);
      return { ...ticket };
    },

    update(id, patch) {
      const index = tickets.findIndex((candidate) => candidate.id === id);
      if (index === -1) return null;

      const updated = applyUpdate(tickets[index], patch, now());
      tickets[index] = updated;
      return { ...updated };
    },

    reset() {
      tickets = (initialSeed ?? buildSeedTickets(now())).map((ticket) => ({ ...ticket }));
      nextNumber = maxSequence(tickets) + 1;
    },

    count() {
      return tickets.length;
    },
  };
}
