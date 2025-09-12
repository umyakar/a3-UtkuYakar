// frontend JS for Plant Watering Scheduler, A2

async function parseResponse(res) {
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return res.json();
  const text = await res.text();
  return { ok: res.ok, data: null, error: text || `HTTP ${res.status}` };
}

async function fetchAll() {
  const res = await fetch("/api/plants", { headers: { Accept: "application/json" } });
  const data = await parseResponse(res);
  if (!data.ok) throw new Error(data.error || "load failed");
  return data.data;
}

async function addPlant(payload) {
  const res = await fetch("/api/plants", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res);
  if (!data.ok) throw new Error(data.error || "add failed");
  return data.data;
}

async function deletePlant(id) {
  const res = await fetch(`/api/plants/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
  });
  const data = await parseResponse(res);
  if (!data.ok) throw new Error(data.error || "delete failed");
  return data.data;
}

function formatUS(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso;
  const [y, m, d] = iso.split("-");
  return `${m}/${d}/${y}`;
}

function renderTable(rows) {
  const tbody = document.getElementById("results-body");
  const empty = document.getElementById("empty-state");
  tbody.innerHTML = "";

  if (!rows || rows.length === 0) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  for (const r of rows) {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHTML(r.name)}</td>
      <td>${escapeHTML(r.species || "")}</td>
      <td>${escapeHTML(formatUS(r.lastWatered))}</td>
      <td>${escapeHTML(String(r.intervalDays))}</td>
      <td>${escapeHTML(formatUS(r.nextWaterDate))}</td>
      <td>${badge(r.urgency)}</td>

      <td>
        <button class="btn danger" data-id="${r.id}" aria-label="Delete ${escapeHTML(r.name)}">
          <svg class="icon" width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
            <line x1="6" y1="6" x2="18" y2="18" stroke="black" stroke-width="2" stroke-linecap="round"></line>
            <line x1="18" y1="6" x2="6" y2="18" stroke="black" stroke-width="2" stroke-linecap="round"></line>
          </svg>
        </button>
      </td>
    `;
    tbody.appendChild(tr);
  }
}

function badge(status) {
  const cls = status === "Overdue" ? "badge danger" : status === "Due Soon" ? "badge warn" : "badge ok";
  return `<span class="${cls}">${escapeHTML(status)}</span>`;
}

function escapeHTML(s) {

  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function hookDelete() {
  document.getElementById("results-body").addEventListener("click", async (e) => {
    const btn = e.target.closest("button[data-id]");
    if (!btn) return;
    try {

      const data = await deletePlant(btn.getAttribute("data-id"));
      renderTable(data);
    } catch (err) {
      alert(err.message || "Delete failed sorry");
    }
  });
}

function hookForm() {
  const form = document.getElementById("plant-form");
  const errorEl = document.getElementById("form-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    errorEl.textContent = "";

    const name = document.getElementById("name").value.trim();
    const species = document.getElementById("species").value.trim();

    const lastWatered = document.getElementById("lastWatered").value;
    const intervalDays = parseInt(document.getElementById("intervalDays").value, 10);

    if (!name) return (errorEl.textContent = "Please enter a name");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(lastWatered)) return (errorEl.textContent = "Pick a valid date");
    if (!(Number.isInteger(intervalDays) && intervalDays >= 1)) return (errorEl.textContent = "Interval must be ≥ 1");

    try {
      const data = await addPlant({ name, species, lastWatered, intervalDays });
      renderTable(data);
      form.reset();
    } catch (err) {
      errorEl.textContent = err.message || "Something went wrong, sorry";
    }
  });
}

async function init() {
  hookForm();
  hookDelete();
  try {
    renderTable(await fetchAll());
  } catch {
    const errP = document.getElementById("form-error");
    if (errP) errP.textContent = "Failed to load data";
  }
}

window.addEventListener("DOMContentLoaded", init);
