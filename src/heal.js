import { ANOMALY, FLEET, FORBID, MAX_PATCH } from "./config.js";
import { boundPath, fail, ingest, rateOk } from "./events.js";

async function openRouterPatch(env, event) {
  if (!env.OPENROUTER_API_KEY) fail(503, "openrouter_unconfigured", "Set OPENROUTER_API_KEY on the Worker");
  const model = "openai/gpt-oss-20b:free";
  const prompt =
    "You are VOLTCORE ProofPatch. Given a production telemetry event, emit a structural patch.\n" +
    "Reply JSON only: {\"summary\":\"...\",\"files\":[{\"path\":\"relative/path\",\"content\":\"full new file contents\"}]}\n" +
    "Rules: one or two files max; no secrets; no .env; keep existing public API; smallest change that stops the failure.\n" +
    "Event: " + JSON.stringify({
      id: event.id, source: event.source, event_type: event.event_type, severity: event.severity, payload: event.payload,
    }).slice(0, 8000);
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.OPENROUTER_API_KEY,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://voltcore-org.github.io/voltcore-command-center/",
      "X-Title": "VOLTCORE Mesh",
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 4096,
      messages: [
        { role: "system", content: "Return only JSON. No markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (!res.ok) fail(502, "openrouter_error", await res.text());
  const data = await res.json();
  const raw = (((data.choices || [])[0] || {}).message || {}).content || "";
  const jsonStart = raw.indexOf("{");
  const jsonEnd = raw.lastIndexOf("}");
  let parsed = { summary: raw.slice(0, 800), files: [] };
  if (jsonStart >= 0 && jsonEnd > jsonStart) {
    try { parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1)); } catch { /* keep fallback */ }
  }
  return { model, summary: String(parsed.summary || "").slice(0, 2000), files: Array.isArray(parsed.files) ? parsed.files : [], raw };
}

async function githubPut(env, repo, path, content, message) {
  if (!env.GITHUB_TOKEN) fail(503, "github_unconfigured", "Set GITHUB_TOKEN on the Worker");
  const get = await fetch("https://api.github.com/repos/" + repo + "/contents/" + path, {
    headers: { Authorization: "Bearer " + env.GITHUB_TOKEN, Accept: "application/vnd.github+json", "User-Agent": "voltcore-core-api" },
  });
  let sha;
  if (get.ok) {
    const cur = await get.json();
    sha = cur.sha;
  }
  const res = await fetch("https://api.github.com/repos/" + repo + "/contents/" + path, {
    method: "PUT",
    headers: { Authorization: "Bearer " + env.GITHUB_TOKEN, Accept: "application/vnd.github+json", "User-Agent": "voltcore-core-api", "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: "main",
      sha,
    }),
  });
  if (!res.ok) fail(502, "github_commit_failed", await res.text());
  return res.json();
}

function attest(event, files) {
  const reasons = [];
  if (!ANOMALY.has(String(event.severity || "").toLowerCase())) reasons.push("severity_not_anomaly");
  if (!FLEET[event.source]) reasons.push("source_not_in_fleet");
  if (!files.length) reasons.push("no_files");
  for (const f of files) {
    const path = String(f.path || "");
    const content = String(f.content || "");
    if (!boundPath(event.source, path)) reasons.push("path_out_of_bounds:" + path);
    if (content.length > MAX_PATCH) reasons.push("patch_too_large:" + path);
    if (FORBID.test(path) || /sk-|ghp_|BEGIN PRIVATE|service_role/i.test(content)) reasons.push("secret_pattern:" + path);
  }
  return { bound: reasons.length === 0, reasons };
}

export async function remediate(env, body, autonomous) {
  const event = (body && body.event) || body || {};
  const source = String(event.source || "");
  const gen = await openRouterPatch(env, event);
  const files = (gen.files || []).filter((f) => f && f.path && typeof f.content === "string");
  const att = attest(event, files);
  const patchText = files.length
    ? files.map((f) => "### FILE: " + f.path + "\n" + f.content).join("\n\n")
    : gen.raw;
  const result = {
    model: gen.model,
    summary: gen.summary || "Patch generated",
    patch: patchText,
    attestation: att,
    committed: false,
    sha: null,
  };
  if (!autonomous) return result;
  if (!att.bound) {
    result.summary = "Attestation rejected: " + att.reasons.join(", ");
    return result;
  }
  if (!rateOk(source)) fail(429, "heal_rate", "Heal cap 3/hour per source");
  if (env.AUTONOMOUS_TRUNK !== "1") {
    result.summary = "Attestation passed. AUTONOMOUS_TRUNK is off — returning patch only.";
    return result;
  }
  const repo = FLEET[source].repo;
  const shas = [];
  for (const f of files) {
    const committed = await githubPut(
      env,
      repo,
      f.path,
      f.content,
      "mesh: autonomous heal for " + source + " " + (event.event_type || "event") + " (" + (event.id || "") + ")",
    );
    shas.push((committed.commit || {}).sha || (committed.content || {}).sha);
  }
  result.committed = true;
  result.sha = shas.filter(Boolean)[0] || null;
  try {
    await ingest(env, {
      json: async () => ({
        source: "command_center.remediate",
        type: "system.recovery",
        severity: "info",
        payload: { status: "patched", incident: event.id, source, sha: result.sha, files: files.map((f) => f.path) },
      }),
    });
  } catch { /* ingest failure must not undo commit */ }
  return result;
}

export async function command(env, body) {
  const action = String(body.action || "");
  const source = String(body.source || "");
  if (!FLEET[source] && action !== "ping-all") fail(400, "unknown_source", "Source not in fleet");
  if (action === "ping" || action === "ping-all") {
    const targets = action === "ping-all" ? Object.keys(FLEET) : [source];
    for (const src of targets) {
      try {
        await ingest(env, {
          json: async () => ({
            source: src,
            type: "mesh.ping",
            severity: "info",
            payload: { action: "ping", from: "core-api", ts: Date.now() },
          }),
        });
      } catch { /* continue */ }
    }
    return { ok: true, action, targets };
  }
  if (action === "drain") {
    await ingest(env, {
      json: async () => ({
        source,
        type: "mesh.drain",
        severity: "info",
        payload: { action: "drain", requested: true },
      }),
    });
    return { ok: true, action, source, note: "Drain flag emitted. Runtime must honor mesh.drain." };
  }
  if (action === "heartbeat") {
    await ingest(env, {
      json: async () => ({
        source,
        type: "health.heartbeat",
        severity: "info",
        payload: { status: "mesh-solicited", surface: "core-api" },
      }),
    });
    return { ok: true, action, source };
  }
  fail(400, "unknown_action", "action must be ping | ping-all | drain | heartbeat");
}
