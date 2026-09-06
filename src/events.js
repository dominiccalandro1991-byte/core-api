import { FLEET, FORBID, HEAL_CAP, HEAL_WINDOW_MS, healLog } from "./config.js";

export function fail(status, code, message) {
  const e = new Error(message);
  e.status = status;
  e.code = code;
  throw e;
}

async function sbHeaders(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) fail(500, "supabase_unconfigured", "Worker missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
  };
}

export async function listEvents(env, url) {
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 150)));
  const headers = await sbHeaders(env);
  const res = await fetch(
    env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/events?select=id,created_at,source,event_type,severity,payload&order=created_at.desc&limit=" + limit,
    { headers },
  );
  if (!res.ok) fail(502, "events_read_failed", await res.text());
  const events = await res.json();
  return { status: "ok", events, fetched_at: new Date().toISOString() };
}

export async function ingest(env, request) {
  const body = await request.json().catch(() => ({}));
  const source = String(body.source || "").trim();
  const event_type = String(body.type || body.event_type || "event").slice(0, 120);
  const severity = String(body.severity || "info").slice(0, 32).toLowerCase();
  if (!source) fail(400, "source_required", "source required");
  const row = {
    source: source.slice(0, 80),
    event_type,
    severity,
    payload: body.payload && typeof body.payload === "object" ? body.payload : {},
  };
  const headers = { ...(await sbHeaders(env)), Prefer: "return=representation" };
  const res = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/events", {
    method: "POST",
    headers,
    body: JSON.stringify(row),
  });
  if (!res.ok) fail(502, "events_write_failed", await res.text());
  const inserted = await res.json();
  return { status: "accepted", event: Array.isArray(inserted) ? inserted[0] : inserted };
}

async function hmacHex(key, msg) {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(msg));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function requireMesh(env, request) {
  if (!env.MESH_HMAC) fail(503, "mesh_unconfigured", "Set MESH_HMAC on the Worker");
  const ts = request.headers.get("X-Voltcore-Timestamp") || "";
  const nonce = request.headers.get("X-Voltcore-Nonce") || "";
  const sig = (request.headers.get("X-Voltcore-Signature") || "").toLowerCase();
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Date.now() - t) > 120000) fail(401, "mesh_clock", "Timestamp outside 120s");
  if (!nonce || nonce.length < 8) fail(401, "mesh_nonce", "Nonce required");
  const expect = await hmacHex(env.MESH_HMAC, ts + "." + nonce);
  if (expect !== sig) fail(401, "mesh_sig", "Bad mesh signature");
}

export function boundPath(source, filePath) {
  const spec = FLEET[source];
  if (!spec) return false;
  const p = String(filePath || "").replace(/^\/+/, "");
  if (!p || p.includes("..") || FORBID.test(p)) return false;
  return spec.paths.some((allow) => (allow.endsWith("/") ? p.startsWith(allow) : p === allow));
}

export function rateOk(source) {
  const now = Date.now();
  const arr = (healLog.get(source) || []).filter((t) => now - t < HEAL_WINDOW_MS);
  if (arr.length >= HEAL_CAP) return false;
  arr.push(now);
  healLog.set(source, arr);
  return true;
}
