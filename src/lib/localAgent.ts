// Bridge to the optional DigiCab Local Agent (Option 2).
// The agent runs at http://127.0.0.1:17777 on the user's PC and exposes
// local printers + scanners to the web app.

const AGENT_URL = "http://127.0.0.1:17777";

export interface AgentHealth {
  ok: boolean;
  version: string;
  platform: string;
  hostname: string;
  requiresToken: boolean;
}

export interface AgentPrinter {
  name: string;
  driver?: string;
  port?: string;
  status?: string;
  default?: boolean;
}

function token(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem("digicab-agent-token");
}

function headers(): HeadersInit {
  const t = token();
  return t ? { "Content-Type": "application/json", "X-Agent-Token": t } : { "Content-Type": "application/json" };
}

export async function pingAgent(): Promise<AgentHealth | null> {
  try {
    const ctrl = new AbortController();
    const id = setTimeout(() => ctrl.abort(), 1500);
    const r = await fetch(`${AGENT_URL}/health`, { signal: ctrl.signal });
    clearTimeout(id);
    if (!r.ok) return null;
    return (await r.json()) as AgentHealth;
  } catch {
    return null;
  }
}

export async function listAgentPrinters(): Promise<AgentPrinter[]> {
  const r = await fetch(`${AGENT_URL}/printers`, { headers: headers() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  return data.printers ?? [];
}

export async function listAgentScanners(): Promise<{ available: boolean; scanners: string[]; hint?: string }> {
  const r = await fetch(`${AGENT_URL}/scanners`, { headers: headers() });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

export async function agentScan(device?: string): Promise<{ filename: string; base64: string; mime: string }> {
  const r = await fetch(`${AGENT_URL}/scan`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ device, format: "pdf" }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return await r.json();
}

export async function agentPrint(printer: string, file: File): Promise<void> {
  const base64 = await new Promise<string>((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => {
      const result = fr.result as string;
      resolve(result.split(",")[1] || "");
    };
    fr.onerror = reject;
    fr.readAsDataURL(file);
  });
  const r = await fetch(`${AGENT_URL}/print`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ printer, fileBase64: base64, filename: file.name }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}

export { AGENT_URL };
