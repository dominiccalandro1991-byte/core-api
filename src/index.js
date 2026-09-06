/**
 * VOLTCORE core-api — Cloudflare Worker BFF + Mesh control plane.
 * Secrets (Cloudflare dashboard, never commit): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
 * OPENROUTER_API_KEY, MESH_HMAC, GITHUB_TOKEN, AUTONOMOUS_TRUNK ("1" to commit to default branch).
 */
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Voltcore-Mesh, X-Voltcore-Timestamp, X-Voltcore-Nonce, X-Voltcore-Signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

const FLEET = {
  "storm-path": { repo: "voltcore-org/storm-path", paths: ["telemetry.js", "index.html", "app.js", "styles.css"] },
  "storm-path-web": { repo: "voltcore-org/storm-path", paths: ["telemetry.js"] },
  "storm-path-mobile": { repo: "voltcore-org/storm-path-mobile", paths: ["src/"] },
  "nano-sandbox": { repo: "voltcore-org/nano-sandbox", paths: ["backend/app/", "public/nnacc-v2/js/", "app/"] },
  "snca-codec": { repo: "voltcore-org/snca-codec", paths: ["src/"] },
  "nano-cloud": { repo: "voltcore-org/snca-codec", paths: ["src/"] },
  "voltcore-command-center": { repo: "voltcore-org/voltcore-command-center", paths: ["app.js", "index.html", "styles.css"] },
  "trueturn": { repo: "dominiccalandro1991-byte/TrueTurn", paths: ["src/", "public/"] },
  "grok-orchestration-engine": { repo: "voltcore-org/voltcore-command-center", paths: ["app.js"] },
};

const FORBID = /(\.env($|\.)|secrets?\/|credentials|id_rsa|ghp_|service_role|wrangler\.toml)/i;
const MAX_PATCH = 80_000;
const HEAL_WINDOW_MS = 60 * 60 * 1000;
const HEAL_CAP = 3;
const ANOMALY = new Set(["critical", "fatal", "high", "error"]);
const healLog = new Map();

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
