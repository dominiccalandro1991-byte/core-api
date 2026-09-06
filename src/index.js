/**
 * VOLTCORE core-api — Cloudflare Worker BFF + Mesh control plane.
 * Secrets (Cloudflare dashboard, never commit): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * OPENROUTER_API_KEY, MESH_HMAC, GITHUB_TOKEN, AUTONOMOUS_TRUNK ("1" to commit to default branch).
 */
import { CORS, FLEET } from "./config.js";
import { command, ingest, listEvents, remediate, requireMesh } from "./handlers.js";

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/v1/events" && request.method === "GET") return json(await listEvents(env, url), 200);
      if (url.pathname === "/api/v1/events" && request.method === "POST") return json(await ingest(env, request), 202);
      if (url.pathname === "/api/v1/fleet" && request.method === "GET") return json({ status: "ok", fleet: Object.keys(FLEET), mesh: Boolean(env.MESH_HMAC), trunk: env.AUTONOMOUS_TRUNK === "1" }, 200);
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
