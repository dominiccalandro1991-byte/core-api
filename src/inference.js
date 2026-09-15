import { analyzePulse, fuseRails, mondayPrompt } from "./dual-rail.js";

const TIMEOUT_MS = 12000;
const MAX_TOKENS = 280;

async function chatComplete(url, key, model, prompt, extraHeaders) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + key, ...extraHeaders },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: MAX_TOKENS,
        messages: [
          { role: "system", content: "Be precise. No markdown fences. Operational tone." },
          { role: "user", content: prompt },
        ],
      }),
      signal: ac.signal,
    });
    if (!res.ok) throw new Error(model + " HTTP " + res.status);
    const body = await res.json();
    const text = ((((body.choices || [])[0] || {}).message || {}).content || "").trim();
    if (!text) throw new Error(model + " empty completion");
    return { text, tokens: (body.usage && body.usage.completion_tokens) || 0 };
  } finally {
    clearTimeout(timer);
  }
}

async function timedRail(model, rail, work) {
  const t0 = Date.now();
  try {
    const out = await work();
    return { model, rail, status: "fulfilled", latency_ms: Date.now() - t0, text: out.text, tokens: out.tokens };
  } catch (err) {
    return { model, rail, status: "rejected", latency_ms: Date.now() - t0, reason: err.message || String(err) };
  }
}

export async function dispatchDualRail(env, prompt, event) {
  const jobs = [];
  const orKey = env.OPENROUTER_API_KEY;
  const xaiKey = env.XAI_API_KEY;
  const primary = env.OPENROUTER_PRIMARY_MODEL || "anthropic/claude-3.5-sonnet";
  const secondary = env.OPENROUTER_SECONDARY_MODEL || "openai/gpt-4o";
  const appUrl = env.APP_URL || "https://voltcore-org.github.io/voltcore-command-center/";
  if (xaiKey) {
    jobs.push(timedRail("xai/grok-4.5", "neural", () => chatComplete("https://api.x.ai/v1/chat/completions", xaiKey, "grok-4.5", prompt, {})));
  } else if (orKey) {
    jobs.push(
      timedRail(primary, "neural", () =>
        chatComplete("https://openrouter.ai/api/v1/chat/completions", orKey, primary, prompt, { "HTTP-Referer": appUrl, "X-Title": "VoltCore" }),
      ),
    );
  }
  if (orKey && xaiKey) {
    jobs.push(
      timedRail(secondary, "secondary", () =>
        chatComplete("https://openrouter.ai/api/v1/chat/completions", orKey, secondary, prompt, { "HTTP-Referer": appUrl, "X-Title": "VoltCore" }),
      ),
    );
  }
  jobs.push(
    timedRail("voltcore/pulse-analyzer", "symbolic", async () => {
      const brief = analyzePulse(event, prompt);
      return { text: brief.brief + ". Recommended: treat as " + brief.severity + ".", tokens: 0 };
    }),
  );
  const settled = await Promise.allSettled(jobs);
  return settled.map((s, i) =>
    s.status === "fulfilled"
      ? s.value
      : { model: "rail-" + i, rail: "neural", status: "rejected", latency_ms: 0, reason: String(s.reason) },
  );
}

export { fuseRails, mondayPrompt, analyzePulse };
