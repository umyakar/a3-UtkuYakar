const http = require("http");
const fs = require("fs");
const mime = require("mime");
const url = require("url");

const dir = "public/";
const port = 3000;

let plants = [
  mkRow("Monstera", "Monstera deliciosa", "2025-09-01", 7),
  mkRow("Snake Plant", "Sansevieria trifasciata", "2025-09-07", 10),
];

function uid() {
  return "p-" + Math.random().toString(36).slice(2, 9);
}
function fromISODate(d) {
  const [y, m, day] = d.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12));
}
function toISODate(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function addDaysISO(d, days) {
  const dt = fromISODate(d);
  dt.setUTCDate(dt.getUTCDate() + days);
  return toISODate(dt);
}
function todayISO() {
  return toISODate(new Date());
}
function derive(lastWatered, intervalDays) {
  const nextWaterDate = addDaysISO(lastWatered, intervalDays);
  const today = todayISO();
  let urgency = "OK";
  if (today > nextWaterDate) {
    urgency = "Overdue";
  } else {
    const diffDays = Math.round((fromISODate(nextWaterDate) - fromISODate(today)) / 86400000);
    if (diffDays <= 2) urgency = "Due Soon";
  }
  return { nextWaterDate, urgency };
}
function mkRow(name, species, lastWatered, intervalDays) {
  const id = uid();
  const { nextWaterDate, urgency } = derive(String(lastWatered).trim(), Number(intervalDays));
  return {
    id,
    name: String(name || "").trim(),
    species: String(species || "").trim(),
    lastWatered: String(lastWatered || "").trim(),
    intervalDays: Number(intervalDays),
    nextWaterDate, 
    urgency,
  };
}
function writeJSON(res, status, obj) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(obj));
}

const server = http.createServer((req, res) => {
  const { pathname } = url.parse(req.url, true);

  if (req.method === "GET") {
    if (pathname === "/api/plants") return writeJSON(res, 200, { ok: true, data: plants });
    return handleGet(req, res);
  }
  if (req.method === "POST") {
    if (pathname === "/api/plants") return handlePostAdd(req, res);
    if (pathname === "/submit") {
      return collectBodyJSON(req, (err, body) => {
        if (err) return writeJSON(res, 400, { ok: false, error: "Bad JSON" });
        return writeJSON(res, 200, { ok: true, data: body || null });
      });
    }
    return writeJSON(res, 404, { ok: false, error: "Not Found" });
  }
  if (req.method === "DELETE") {
    if (pathname.startsWith("/api/plants/")) {
      const id = pathname.split("/").pop();
      return handleDelete(res, id);
    }
    return writeJSON(res, 404, { ok: false, error: "Not Found" });
  }
  return writeJSON(res, 405, { ok: false, error: "Method Not Allowed" });
});

function handleGet(req, res) {
  const filename = dir + req.url.slice(1);
  if (req.url === "/") return sendFile(res, "public/index.html");
  sendFile(res, filename);
}

function collectBodyJSON(req, cb) {
  let buf = "";
  req.on("data", (c) => (buf += c));
  req.on("end", () => {
    try {
      cb(null, buf ? JSON.parse(buf) : {});
    } catch (e) {
      cb(e);
    }
  });
}

function handlePostAdd(req, res) {
  collectBodyJSON(req, (err, body) => {
    if (err) return writeJSON(res, 400, { ok: false, error: "Bad JSON" });
    const { name, species = "", lastWatered, intervalDays } = body || {};
    if (typeof name !== "string" || name.trim() === "") return writeJSON(res, 400, { ok: false, error: "name is required" });
    if (typeof lastWatered !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(lastWatered))
      return writeJSON(res, 400, { ok: false, error: "lastWatered must be YYYY-MM-DD" });
    const days = Number(intervalDays);
    if (!Number.isInteger(days) || days < 1) return writeJSON(res, 400, { ok: false, error: "intervalDays must be an integer ≥ 1" });

    plants.push(mkRow(name, species, lastWatered, days));
    return writeJSON(res, 200, { ok: true, data: plants });
  });
}

function handleDelete(res, id) {
  const before = plants.length;
  plants = plants.filter((p) => p.id !== id);
  if (plants.length === before) return writeJSON(res, 404, { ok: false, error: `No plant found with id: ${id}` });
  return writeJSON(res, 200, { ok: true, data: plants });
}

function sendFile(res, filename) {
  const type = mime.getType(filename);
  fs.readFile(filename, (err, content) => {
    if (!err) {
      res.writeHead(200, { "Content-Type": type });
      return res.end(content);
    }
    res.writeHead(404);
    res.end("404 Error: File Not Found");
  });
}

server.listen(process.env.PORT || port);
