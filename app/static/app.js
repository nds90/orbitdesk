const TRANSITIONS = {
  new: ["open"],
  open: ["pending", "resolved"],
  pending: ["open", "resolved"],
  resolved: ["open"],
};
const STATUS_LABELS = {
  new: "New",
  open: "Open",
  pending: "Pending",
  resolved: "Resolved",
};
const PRIORITY_LABELS = {
  low: "Low",
  normal: "Normal",
  high: "High",
  urgent: "Urgent",
};

const state = {
  tickets: [],
  stats: null,
  assignees: [],
  filters: { q: "", status: "", priority: "", assignee: "" },
};

const els = {
  statOpen: document.querySelector("#stat-open"),
  statPending: document.querySelector("#stat-pending"),
  statResolved: document.querySelector("#stat-resolved"),
  statBreached: document.querySelector("#stat-breached"),
  resultCount: document.querySelector("#result-count"),
  rows: document.querySelector("#ticket-rows"),
  search: document.querySelector("#search"),
  status: document.querySelector("#filter-status"),
  priority: document.querySelector("#filter-priority"),
  assignee: document.querySelector("#filter-assignee"),
  form: document.querySelector("#create-form"),
  subject: document.querySelector("#subject"),
  requester: document.querySelector("#requester"),
  createPriority: document.querySelector("#priority"),
  createAssignee: document.querySelector("#assignee"),
  assigneeOptions: document.querySelector("#assignee-options"),
  formError: document.querySelector("#form-error"),
  reset: document.querySelector("#reset-btn"),
  exportBtn: document.querySelector("#export-btn"),
  toast: document.querySelector("#toast"),
};

function escapeHtml(value) {
  return String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error ?? `Request failed (${response.status})`);
    error.details = payload.details;
    throw error;
  }
  return payload;
}

function formatRelative(iso) {
  const timestamp = Date.parse(iso);
  if (!Number.isFinite(timestamp)) return "";
  const minutes = Math.max(0, Math.round((Date.now() - timestamp) / 60_000));

  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function buildQuery() {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(state.filters)) {
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => els.toast.classList.remove("show"), 3_200);
}

function renderStats() {
  if (!state.stats) return;
  const { byStatus, total, slaBreached } = state.stats;
  els.statOpen.textContent = String((byStatus.new ?? 0) + (byStatus.open ?? 0));
  els.statPending.textContent = String(byStatus.pending ?? 0);
  els.statResolved.textContent = String(byStatus.resolved ?? 0);
  els.statBreached.textContent = String(slaBreached ?? 0);

  const filtered = state.tickets.length;
  const hasFilters = Object.values(state.filters).some(Boolean);
  els.resultCount.textContent = hasFilters
    ? `Showing ${filtered} of ${total} tickets`
    : `${total} tickets in the queue`;
}

function transitionOptions(ticket) {
  const targets = TRANSITIONS[ticket.status] ?? [];
  return targets
    .map(
      (status) =>
        `<option value="${escapeHtml(status)}">${escapeHtml(STATUS_LABELS[status])}</option>`,
    )
    .join("");
}

function renderRows() {
  if (state.tickets.length === 0) {
    els.rows.innerHTML = `
      <tr>
        <td colspan="6" class="empty">No tickets match the current filters.</td>
      </tr>`;
    return;
  }

  els.rows.innerHTML = state.tickets
    .map(
      (ticket) => `
      <tr>
        <td>
          <div class="ticket-id">${escapeHtml(ticket.id)}</div>
          <div class="ticket-meta">updated ${escapeHtml(formatRelative(ticket.updatedAt))}</div>
        </td>
        <td>
          <div class="ticket-subject">${escapeHtml(ticket.subject)}</div>
          <div class="ticket-meta">${escapeHtml(ticket.requester)}</div>
        </td>
        <td><span class="badge priority-${escapeHtml(ticket.priority)}">${escapeHtml(PRIORITY_LABELS[ticket.priority] ?? ticket.priority)}</span></td>
        <td><span class="badge status-${escapeHtml(ticket.status)}">${escapeHtml(STATUS_LABELS[ticket.status] ?? ticket.status)}</span></td>
        <td>${ticket.assignee ? escapeHtml(ticket.assignee) : '<span class="ticket-meta">Unassigned</span>'}</td>
        <td>
          <select class="row-action" data-id="${escapeHtml(ticket.id)}" aria-label="Update status for ${escapeHtml(ticket.id)}">
            <option value="">Move to…</option>
            ${transitionOptions(ticket)}
          </select>
        </td>
      </tr>`,
    )
    .join("");
}

function render() {
  renderStats();
  renderRows();
  els.exportBtn.href = `/api/tickets.csv${buildQuery()}`;
}

function syncAssigneeOptions() {
  const current = els.assignee.value;
  els.assignee.innerHTML = [
    '<option value="">Anyone</option>',
    '<option value="unassigned">Unassigned</option>',
    ...state.assignees.map(
      (name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`,
    ),
  ].join("");
  els.assignee.value = state.assignees.includes(current) || current === "unassigned" ? current : "";
  els.assigneeOptions.innerHTML = state.assignees
    .map((name) => `<option value="${escapeHtml(name)}"></option>`)
    .join("");
}

async function refresh() {
  try {
    const [list, stats] = await Promise.all([
      api(`/api/tickets${buildQuery()}`),
      api("/api/stats"),
    ]);
    state.tickets = list.items;
    state.stats = stats.stats;
    render();
  } catch (error) {
    showToast(error.message);
  }
}

async function init() {
  try {
    const all = await api("/api/tickets");
    state.assignees = [...new Set(all.items.map((ticket) => ticket.assignee).filter(Boolean))].sort();
    syncAssigneeOptions();
    await refresh();
  } catch (error) {
    showToast(error.message);
  }
}

els.search.addEventListener("input", () => {
  clearTimeout(els.search.timer);
  els.search.timer = setTimeout(() => {
    state.filters.q = els.search.value.trim();
    refresh();
  }, 250);
});

els.status.addEventListener("change", () => {
  state.filters.status = els.status.value;
  refresh();
});

els.priority.addEventListener("change", () => {
  state.filters.priority = els.priority.value;
  refresh();
});

els.assignee.addEventListener("change", () => {
  state.filters.assignee = els.assignee.value;
  refresh();
});

els.rows.addEventListener("change", async (event) => {
  const select = event.target.closest(".row-action");
  if (!select || !select.value) return;

  const id = select.dataset.id;
  const status = select.value;
  select.disabled = true;

  try {
    await api(`/api/tickets/${encodeURIComponent(id)}`, {
      method: "PATCH",
      body: JSON.stringify({ status }),
    });
    showToast(`${id} moved to ${STATUS_LABELS[status] ?? status}`);
    await refresh();
  } catch (error) {
    select.disabled = false;
    showToast((error.details ?? [error.message]).join(" · "));
  }
});

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  els.formError.textContent = "";

  const payload = {
    subject: els.subject.value.trim(),
    requester: els.requester.value.trim(),
    priority: els.createPriority.value,
    assignee: els.createAssignee.value.trim() || null,
  };

  try {
    const { ticket } = await api("/api/tickets", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    showToast(`${ticket.id} created`);
    els.form.reset();
    els.createPriority.value = "normal";
    await init();
    els.subject.focus();
  } catch (error) {
    els.formError.textContent = (error.details ?? [error.message]).join(" · ");
  }
});

els.reset.addEventListener("click", async () => {
  if (!window.confirm("Reset the demo data back to the seeded tickets?")) return;

  try {
    await api("/api/reset", { method: "POST" });
    state.filters = { q: "", status: "", priority: "", assignee: "" };
    els.search.value = "";
    els.status.value = "";
    els.priority.value = "";
    els.assignee.value = "";
    els.formError.textContent = "";
    await init();
    showToast("Demo data reset");
  } catch (error) {
    showToast(error.message);
  }
});

init();
