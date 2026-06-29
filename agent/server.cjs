#!/usr/bin/env node
/**
 * DigiCab Local Agent
 * --------------------
 * Small HTTP bridge that runs on the secretary / director PC and exposes
 * the local printers + scanners to the DigiCab web app (which otherwise
 * cannot reach hardware from a browser sandbox).
 *
 * Endpoints (CORS-open for the DigiCab origin):
 *   GET  /health                 -> { ok: true, version, platform, hostname }
 *   GET  /printers               -> { printers: [{ name, default, status }] }
 *   POST /print                  -> body: { printer, fileBase64, filename }
 *   GET  /scanners               -> { scanners: [...] }  (requires NAPS2 CLI)
 *   POST /scan                   -> triggers a scan via NAPS2 CLI, returns base64 PDF
 *   GET  /folder/list?path=...   -> list files in a watched folder
 *   GET  /folder/file?path=...   -> stream a single file (base64)
 *
 * No external npm dependencies. Just `node server.cjs`.
 */

const http = require("http");
const { execFile, exec } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");

const PORT = parseInt(process.env.DIGICAB_AGENT_PORT || "17777", 10);
const VERSION = "1.0.0";
const TOKEN = process.env.DIGICAB_AGENT_TOKEN || "";

// Allowed web origins. The DigiCab web app calls this agent from these.
const ALLOWED_ORIGINS = [
  "https://id-preview--59db28e4-70a3-49b8-a87c-b1f37b6976a8.lovable.app",
  "https://59db28e4-70a3-49b8-a87c-b1f37b6976a8.lovable.app",
  "http://localhost:8080",
  "http://localhost:3000",
];

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allow = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader("Access-Control-Allow-Origin", allow);
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Agent-Token");
  res.setHeader("Vary", "Origin");
}

function json(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      try {
        const raw = Buffer.concat(chunks).toString("utf8");
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) { reject(e); }
    });
    req.on("error", reject);
  });
}

// ---------- Printers ----------
function listPrinters() {
  return new Promise((resolve) => {
    if (process.platform === "win32") {
      // PowerShell Get-Printer -> JSON
      const cmd =
        'powershell -NoProfile -Command "Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus | ConvertTo-Json -Compress"';
      exec(cmd, { windowsHide: true, timeout: 8000 }, (err, stdout) => {
        if (err) return resolve([]);
        try {
          const raw = JSON.parse(stdout || "[]");
          const arr = Array.isArray(raw) ? raw : [raw];
          // detect default
          exec(
            'powershell -NoProfile -Command "(Get-CimInstance -Class Win32_Printer | Where-Object Default -eq $true).Name"',
            { windowsHide: true, timeout: 4000 },
            (e2, def) => {
              const defaultName = (def || "").trim();
              resolve(arr.map((p) => ({
                name: p.Name,
                driver: p.DriverName,
                port: p.PortName,
                status: String(p.PrinterStatus ?? ""),
                default: p.Name === defaultName,
              })));
            }
          );
        } catch { resolve([]); }
      });
    } else if (process.platform === "darwin" || process.platform === "linux") {
      exec("lpstat -p -d", { timeout: 5000 }, (err, stdout) => {
        if (err) return resolve([]);
        const printers = [];
        let def = "";
        stdout.split("\n").forEach((line) => {
          const m = line.match(/^printer\s+(\S+)/);
          if (m) printers.push({ name: m[1], default: false, status: "" });
          const d = line.match(/system default destination:\s*(\S+)/);
          if (d) def = d[1];
        });
        resolve(printers.map((p) => ({ ...p, default: p.name === def })));
      });
    } else {
      resolve([]);
    }
  });
}

function printFile(printer, filePath) {
  return new Promise((resolve, reject) => {
    if (process.platform === "win32") {
      // Use PowerShell Start-Process -Verb PrintTo
      const ps = `Start-Process -FilePath '${filePath.replace(/'/g, "''")}' -Verb PrintTo -ArgumentList '"${printer.replace(/"/g, '\\"')}"' -PassThru | Out-Null`;
      exec(`powershell -NoProfile -Command "${ps}"`, { windowsHide: true, timeout: 15000 }, (err) => {
        if (err) reject(err); else resolve();
      });
    } else {
      execFile("lp", ["-d", printer, filePath], { timeout: 15000 }, (err) => {
        if (err) reject(err); else resolve();
      });
    }
  });
}

// ---------- Scanners (via NAPS2 CLI, optional) ----------
function naps2Path() {
  // Common install locations on Windows
  const candidates = [
    "C:\\Program Files\\NAPS2\\NAPS2.Console.exe",
    "C:\\Program Files (x86)\\NAPS2\\NAPS2.Console.exe",
    "NAPS2.Console", // PATH
  ];
  for (const c of candidates) {
    try { if (c.includes("\\") && fs.existsSync(c)) return c; } catch {}
  }
  return "NAPS2.Console";
}

function listScanners() {
  return new Promise((resolve) => {
    const exe = naps2Path();
    execFile(exe, ["--listdevices"], { timeout: 8000 }, (err, stdout) => {
      if (err) return resolve({ available: false, scanners: [], hint: "NAPS2 not installed" });
      const scanners = stdout.split("\n").map((s) => s.trim()).filter(Boolean);
      resolve({ available: true, scanners });
    });
  });
}

function performScan({ device, format = "pdf" } = {}) {
  return new Promise((resolve, reject) => {
    const exe = naps2Path();
    const tmp = path.join(os.tmpdir(), `digicab-scan-${Date.now()}.${format}`);
    const args = ["-o", tmp];
    if (device) args.push("--driver", "wia", "--device", device);
    execFile(exe, args, { timeout: 60000 }, (err) => {
      if (err) return reject(err);
      try {
        const buf = fs.readFileSync(tmp);
        fs.unlink(tmp, () => {});
        resolve({ filename: path.basename(tmp), base64: buf.toString("base64"), mime: format === "pdf" ? "application/pdf" : "image/jpeg" });
      } catch (e) { reject(e); }
    });
  });
}

// ---------- Folder bridge ----------
function safePath(p) {
  if (!p || typeof p !== "string") return null;
  const resolved = path.resolve(p);
  return resolved;
}

// ---------- HTTP routing ----------
const server = http.createServer(async (req, res) => {
  setCors(req, res);
  if (req.method === "OPTIONS") { res.writeHead(204); return res.end(); }

  if (TOKEN) {
    const sent = req.headers["x-agent-token"];
    if (sent !== TOKEN && req.url !== "/health") {
      return json(res, 401, { error: "Invalid token" });
    }
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    if (url.pathname === "/health") {
      return json(res, 200, {
        ok: true, version: VERSION, platform: process.platform,
        hostname: os.hostname(), requiresToken: !!TOKEN,
      });
    }

    if (url.pathname === "/printers" && req.method === "GET") {
      const printers = await listPrinters();
      return json(res, 200, { printers });
    }

    if (url.pathname === "/print" && req.method === "POST") {
      const body = await readBody(req);
      const { printer, fileBase64, filename } = body;
      if (!printer || !fileBase64) return json(res, 400, { error: "Missing printer or fileBase64" });
      const tmp = path.join(os.tmpdir(), `digicab-print-${crypto.randomBytes(4).toString("hex")}-${filename || "doc.pdf"}`);
      fs.writeFileSync(tmp, Buffer.from(fileBase64, "base64"));
      await printFile(printer, tmp);
      setTimeout(() => fs.unlink(tmp, () => {}), 60000);
      return json(res, 200, { ok: true });
    }

    if (url.pathname === "/scanners" && req.method === "GET") {
      return json(res, 200, await listScanners());
    }

    if (url.pathname === "/scan" && req.method === "POST") {
      const body = await readBody(req);
      const result = await performScan(body || {});
      return json(res, 200, result);
    }

    if (url.pathname === "/folder/list" && req.method === "GET") {
      const p = safePath(url.searchParams.get("path"));
      if (!p || !fs.existsSync(p)) return json(res, 400, { error: "Invalid path" });
      const entries = fs.readdirSync(p, { withFileTypes: true })
        .filter((e) => e.isFile())
        .map((e) => {
          const full = path.join(p, e.name);
          const st = fs.statSync(full);
          return { name: e.name, size: st.size, mtime: st.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
      return json(res, 200, { files: entries });
    }

    if (url.pathname === "/folder/file" && req.method === "GET") {
      const p = safePath(url.searchParams.get("path"));
      if (!p || !fs.existsSync(p)) return json(res, 400, { error: "Invalid path" });
      const buf = fs.readFileSync(p);
      return json(res, 200, { filename: path.basename(p), base64: buf.toString("base64") });
    }

    return json(res, 404, { error: "Not found" });
  } catch (e) {
    return json(res, 500, { error: e.message || String(e) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`╔════════════════════════════════════════════════╗`);
  console.log(`║  DigiCab Local Agent v${VERSION}                  ║`);
  console.log(`║  Listening on  http://127.0.0.1:${PORT}           ║`);
  console.log(`║  Platform: ${process.platform.padEnd(36)}║`);
  console.log(`║  Token required: ${(TOKEN ? "YES" : "NO").padEnd(30)}║`);
  console.log(`╚════════════════════════════════════════════════╝`);
  console.log(`Keep this window open. Close it to stop the agent.`);
});
