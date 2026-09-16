import { FLEET, FORBID, HEAL_CAP, HEAL_WINDOW_MS, healLog } from "./config.js";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value) {
  return UUID_RE.test(String(value || ""));
}

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

let cachedTenantId = null;

export async function resolveTenantId(env, body) {
  const hinted = body && body.tenant_id;
  if (isUuid(hinted)) return String(hinted);
  if (isUuid(env.TENANT_ID)) return String(env.TENANT_ID);
  if (isUuid(cachedTenantId)) return cachedTenantId;
  const headers = await sbHeaders(env);
  const res = await fetch(
    env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/events?select=tenant_id&limit=1",
    { headers },
  );
  if (res.ok) {
    const rows = await res.json();
    if (rows[0] && isUuid(rows[0].tenant_id)) {
      cachedTenantId = rows[0].tenant_id;
      return cachedTenantId;
    }
  }
  cachedTenantId = crypto.randomUUID();
  return cachedTenantId;
}

function normalizeSeverity(value) {
  const v = String(value || "info").slice(0, 32).toLowerCase();
  if (v === "warn" || v === "warning") return "info";
  if (v === "fatal") return "critical";
  if (v === "high") return "error";
  if (v === "debug" || v === "info" || v === "error" || v === "critical") return v;
  return "info";
}

function eventRow(tenant_id, body) {
  const source = String(body.source || "").trim();
  const event_type = String(body.type || body.event_type || "event").slice(0, 120);
  const severity = normalizeSeverity(body.severity);
  if (!source) fail(400, "source_required", "source required");
  if (!isUuid(tenant_id)) fail(500, "tenant_id_invalid", "tenant_id must be a UUID");
  return {
    tenant_id,
    source: source.slice(0, 80),
    event_type,
    severity,
    payload: body.payload && typeof body.payload === "object" ? body.payload : {},
  };
}

export async function ingestEvent(env, body) {
  const tenant_id = await resolveTenantId(env, body);
  const row = eventRow(tenant_id, body);
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

export async function ingestMany(env, bodies) {
  const tenant_id = await resolveTenantId(env, {});
  const rows = [];
  for (const body of bodies || []) {
    const source = String(body.source || "").trim();
    if (!source) continue;
    rows.push(eventRow(tenant_id, body));
  }
  if (!rows.length) return { status: "accepted", count: 0, tenant_id };
  const headers = { ...(await sbHeaders(env)), Prefer: "return=minimal" };
  const res = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/events", {
    method: "POST",
    headers,
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    const errors = [];
    let accepted = 0;
    for (const body of bodies) {
      try {
        await ingestEvent(env, body);
        accepted += 1;
      } catch (err) {
        errors.push({ source: body.source, detail: String(err.message || err) });
      }
    }
    return { status: errors.length ? "partial" : "accepted", count: accepted, errors, tenant_id };
  }
  return { status: "accepted", count: rows.length, tenant_id };
}

export async function ingest(env, request) {
  const body = await request.json().catch(() => ({}));
  return ingestEvent(env, body);
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
