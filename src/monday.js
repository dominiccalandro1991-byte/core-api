import { analyzePulse, dispatchDualRail, fuseRails, mondayPrompt } from "./inference.js";

function sbHeaders(env) {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
    "Content-Type": "application/json",
  };
}

async function insert(env, table, row) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) return row;
  if (table === "events" && !row.tenant_id) row.tenant_id = env.TENANT_ID || "voltcore";
  const res = await fetch(env.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/" + table, {
    method: "POST",
    headers: { ...sbHeaders(env), Prefer: "return=representation" },
    body: JSON.stringify(row),
  });
  if (!res.ok) throw Object.assign(new Error(await res.text()), { status: 502, code: table + "_write_failed" });
  const inserted = await res.json();
  return Array.isArray(inserted) ? inserted[0] : inserted;
}

export async function listTelemetry(env, url) {
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") || 80)));
  if (!env.SUPABASE_URL) return { status: "ok", telemetry: [], runs: [], fetched_at: new Date().toISOString() };
  const res = await fetch(
    env.SUPABASE_URL.replace(/\/$/, "") +
      "/rest/v1/system_telemetry?select=id,created_at,correlation_id,channel,model,status,latency_ms,source,metric&order=created_at.desc&limit=" +
      limit,
    { headers: sbHeaders(env) },
  );
  if (!res.ok) throw Object.assign(new Error(await res.text()), { status: 502, code: "telemetry_read_failed" });
  return { status: "ok", telemetry: await res.json(), fetched_at: new Date().toISOString() };
}

export async function handleMonday(env, request, ctx) {
  const url = new URL(request.url);
  if (request.method === "GET") {
    const challenge = url.searchParams.get("challenge");
    if (challenge) return { challenge };
    return { status: "ok", ingest: "monday" };
  }
  const raw = await request.text();
  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    throw Object.assign(new Error("invalid_json"), { status: 400, code: "invalid_json" });
  }
  if (body.challenge) return { challenge: body.challenge };
  if (!body.event) throw Object.assign(new Error("missing event context"), { status: 400, code: "invalid_payload" });
  const correlationId = crypto.randomUUID();
  await insert(env, "events", {
    source: "monday",
    event_type: "monday.ingested",
    severity: "info",
    payload: {
      status: "ack",
      pulseName: body.event.pulseName || null,
      pulseId: body.event.pulseId || null,
      boardId: body.event.boardId || null,
    },
  });
  await insert(env, "system_telemetry", {
    correlation_id: correlationId,
    channel: "ingress",
    status: "acked",
    source: "monday",
    metric: { handshake: "http200", pulseName: body.event.pulseName || null },
  });
  const work = runPipeline(env, body.event, correlationId);
  if (ctx && typeof ctx.waitUntil === "function") ctx.waitUntil(work);
  else work.catch((err) => console.error("[monday pipeline]", err));
  return { status: "acknowledged", correlationId, timestamp: Date.now() };
}

async function runPipeline(env, event, correlationId) {
  const symbolic = analyzePulse(event);
  const prompt = mondayPrompt(event);
  await insert(env, "system_telemetry", {
    correlation_id: correlationId,
    channel: "pipeline",
    status: "pending",
    source: "monday",
    metric: { stage: "dispatch" },
  });
  const rails = await dispatchDualRail(env, prompt, event);
  for (const rail of rails) {
    await insert(env, "system_telemetry", {
      correlation_id: correlationId,
      channel: "inference",
      status: rail.status,
      model: rail.model,
      latency_ms: rail.latency_ms,
      source: "monday",
      metric: { rail: rail.rail, preview: String(rail.text || rail.reason || "").slice(0, 240) },
    });
  }
  const consensus = fuseRails(rails);
  await insert(env, "system_telemetry", {
    correlation_id: correlationId,
    channel: "consensus",
    status: consensus.winnerModel ? "fulfilled" : "rejected",
    model: consensus.winnerModel,
    source: "monday",
    metric: { score: consensus.score, jaccard: consensus.jaccard, dissent: consensus.dissent },
  });
  await insert(env, "events", {
    source: "monday",
    event_type: "monday.analyzed",
    severity: symbolic.severity,
    payload: {
      pulseName: event.pulseName || null,
      status: consensus.winnerModel ? "analyzed" : "degraded",
      consensus: consensus.score,
      winner: consensus.winnerModel,
      summary: String(consensus.fusedSummary || "").slice(0, 1200),
    },
  });
}
