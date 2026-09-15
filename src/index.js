/**
 * VOLTCORE core-api — Cloudflare Worker BFF + Dual-Rail mesh.
 * Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENROUTER_API_KEY, XAI_API_KEY,
 * MESH_HMAC, GITHUB_TOKEN, AUTONOMOUS_TRUNK, MONDAY_SIGNING_SECRET, APP_URL, APP_NAME,
 * OPENROUTER_PRIMARY_MODEL, OPENROUTER_SECONDARY_MODEL.
 */
import { CORS, FLEET } from "./config.js";
import { command, ingest, listEvents, remediate, requireMesh } from "./handlers.js";
import { handleMonday, listTelemetry } from "./monday.js";

export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/v1/health" && request.method === "GET") {
        return json({
          status: "ok",
          service: "voltcore-core-api",
          time: new Date().toISOString(),
          fleet: Object.keys(FLEET),
          mesh: Boolean(env.MESH_HMAC),
          trunk: env.AUTONOMOUS_TRUNK === "1",
          neural: Boolean(env.XAI_API_KEY),
          openrouter: Boolean(env.OPENROUTER_API_KEY),
          supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
        });
      }
      if (url.pathname === "/api/v1/webhooks/monday" && (request.method === "POST" || request.method === "GET")) {
        return json(await handleMonday(env, request, ctx), 200);
      }
      if (url.pathname === "/api/v1/events" && request.method === "GET") return json(await listEvents(env, url), 200);
      if (url.pathname === "/api/v1/events" && request.method === "POST") return json(await ingest(env, request), 202);
      if (url.pathname === "/api/v1/telemetry" && request.method === "GET") return json(await listTelemetry(env, url), 200);
      if (url.pathname === "/api/v1/fleet" && request.method === "GET") {
        return json({
          status: "ok",
          fleet: Object.keys(FLEET),
          mesh: Boolean(env.MESH_HMAC),
          trunk: env.AUTONOMOUS_TRUNK === "1",
          neural: Boolean(env.XAI_API_KEY),
          openrouter: Boolean(env.OPENROUTER_API_KEY),
          supabase: Boolean(env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY),
        }, 200);
      }
      if (url.pathname === "/api/v1/remediate" && request.method === "POST") return json(await remediate(env, await request.json(), false), 200);
      if (url.pathname === "/api/v1/heal" && request.method === "POST") {
        await requireMesh(env, request);
        return json(await remediate(env, await request.json(), true), 200);
      }
      if (url.pathname === "/api/v1/command" && request.method === "POST") {
        await requireMesh(env, request);
        return json(await command(env, await request.json()), 200);
      }
      return json({ error: "not_found" }, 404);
    } catch (err) {
      const status = err.status || 500;
      return json({ error: err.code || "error", detail: err.message || String(err) }, status);
    }
  },
};

function json(body, status) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}
