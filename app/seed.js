import { readFileSync } from "node:fs";

const SEED_ROWS = JSON.parse(
  readFileSync(new URL("../data/seed-tickets.json", import.meta.url), "utf8"),
);

export function buildSeedTickets(now = new Date()) {
  return SEED_ROWS.map((row) => {
    const { createdMinutesAgo, resolvedMinutesAgo, ...ticket } = row;
    const createdAt = new Date(now.getTime() - createdMinutesAgo * 60_000);
    const resolvedAt =
      typeof resolvedMinutesAgo === "number"
        ? new Date(now.getTime() - resolvedMinutesAgo * 60_000)
        : null;

    return {
      ...ticket,
      createdAt: createdAt.toISOString(),
      updatedAt: (resolvedAt ?? createdAt).toISOString(),
      resolvedAt: resolvedAt ? resolvedAt.toISOString() : null,
    };
  });
}
