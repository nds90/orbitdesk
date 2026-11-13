import { createServer as createNodeServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { createStore } from "./store.js";
import { computeStats, filterTickets } from "./tickets.js";
import { ticketsToCsv } from "./csv.js";

const STATIC_DIR = fileURLToPath(new URL("./static/", import.meta.url));
const MAX_BODY_BYTES = 64 * 1024;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Content-Security-Policy":
    "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'",
};

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    ...BASE_HEADERS,
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  res.end(body);
}

function sendError(res, status, message, details) {
  sendJson(res, status, details ? { error: message, details } : { error: message });
}

function readJsonBody(req) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0;
    const chunks = [];

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        const error = new Error("Request body too large");
        error.status = 413;
        rejectBody(error);
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });

    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw.trim()) {
        resolveBody({});
        return;
      }
      try {
        resolveBody(JSON.parse(raw));
      } catch {
        const error = new Error("Invalid JSON body");
        error.status = 400;
        rejectBody(error);
      }
    });

    req.on("error", rejectBody);
  });
}

function parseFilters(url) {
  return {
    status: url.searchParams.get("status") || undefined,
    priority: url.searchParams.get("priority") || undefined,
    assignee: url.searchParams.get("assignee") || undefined,
    q: url.searchParams.get("q") || undefined,
  };
}

async function handleApi(req, res, url, store, clock) {
  const method = req.method ?? "GET";
  const path = url.pathname;

  if (path === "/api/health" && method === "GET") {
    sendJson(res, 200, {
      status: "ok",
      tickets: store.count(),
      uptimeSeconds: Math.round(process.uptime()),
    });
    return;
  }

  if (path === "/api/stats" && method === "GET") {
    sendJson(res, 200, { stats: computeStats(store.list(), clock()) });
    return;
  }

  if (path === "/api/tickets.csv" && method === "GET") {
    const items = filterTickets(store.list(), parseFilters(url));
    const csv = ticketsToCsv(items, clock());
    res.writeHead(200, {
      ...BASE_HEADERS,
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="orbitdesk-tickets.csv"',
      "Cache-Control": "no-store",
    });
    res.end(csv);
    return;
  }

  if (path === "/api/tickets" && method === "GET") {
    const filters = parseFilters(url);
    const items = filterTickets(store.list(), filters);
    sendJson(res, 200, { items, total: items.length, filters });
    return;
  }

  if (path === "/api/tickets" && method === "POST") {
    const body = await readJsonBody(req);
    const ticket = store.create(body);
    sendJson(res, 201, { ticket });
    return;
  }

  if (path === "/api/reset" && method === "POST") {
    store.reset();
    sendJson(res, 200, { reset: true, total: store.count() });
    return;
  }

  const ticketMatch = path.match(/^\/api\/tickets\/([^/]+)$/);
  if (ticketMatch) {
    const id = decodeURIComponent(ticketMatch[1]);

    if (method === "GET") {
      const ticket = store.get(id);
      if (!ticket) {
        sendError(res, 404, "Ticket not found");
        return;
      }
      sendJson(res, 200, { ticket });
      return;
    }

    if (method === "PATCH") {
      const body = await readJsonBody(req);
      const ticket = store.update(id, body);
      if (!ticket) {
        sendError(res, 404, "Ticket not found");
        return;
      }
      sendJson(res, 200, { ticket });
      return;
    }
  }

  sendError(res, 404, "Not found");
}

async function serveStatic(pathname, res) {
  const relative = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const filePath = resolve(STATIC_DIR, relative);
  const staticRoot = STATIC_DIR.endsWith(sep) ? STATIC_DIR : `${STATIC_DIR}${sep}`;

  if (!filePath.startsWith(staticRoot)) {
    sendError(res, 404, "Not found");
    return;
  }

  try {
    const data = await readFile(filePath);
    res.writeHead(200, {
      ...BASE_HEADERS,
      "Content-Type": MIME_TYPES[extname(filePath).toLowerCase()] ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(data);
  } catch (error) {
    if (error.code === "ENOENT" || error.code === "EISDIR") {
      sendError(res, 404, "Not found");
      return;
    }
    throw error;
  }
}

export function createServer({ store = createStore(), clock = () => new Date() } = {}) {
  return createNodeServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");

      if (url.pathname.startsWith("/api/")) {
        await handleApi(req, res, url, store, clock);
        return;
      }

      if (req.method !== "GET" && req.method !== "HEAD") {
        sendError(res, 405, "Method not allowed");
        return;
      }

      await serveStatic(url.pathname, res);
    } catch (error) {
      const status = error.status ?? 500;
      if (status >= 500) console.error(error);
      if (!res.headersSent) {
        sendError(res, status, error.message, error.details);
      } else {
        res.end();
      }
    }
  });
}

const entry = process.argv[1] ? resolve(process.argv[1]) : "";
const isMain =
  entry && fileURLToPath(import.meta.url).toLowerCase() === entry.toLowerCase();

if (isMain) {
  const port = Number.parseInt(process.env.PORT ?? "3000", 10);
  const host = process.env.HOST ?? "127.0.0.1";

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error(`Invalid PORT: ${process.env.PORT}`);
    process.exit(1);
  }

  const server = createServer();
  server.listen(port, host, () => {
    console.log(`OrbitDesk listening on http://${host}:${port}`);
  });
}
