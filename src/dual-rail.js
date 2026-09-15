const STOP = new Set("the a an and or to of in for on is it this that with as be by".split(" "));

export function tokenize(text) {
  const out = new Set();
  for (const raw of String(text || "").toLowerCase().split(/[^a-z0-9]+/g)) {
    if (raw.length < 2 || STOP.has(raw)) continue;
    out.add(raw);
  }
  return out;
}

export function jaccard(a, b) {
  if (a.size === 0 && b.size === 0) return 1;
  let inter = 0;
  for (const t of a) if (b.has(t)) inter += 1;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

const RISK = [
  [/\b(outage|down|offline|fatal|sev-?1|p0)\b/i, 0.92, "availability"],
  [/\b(error|fail|broken|exception|timeout)\b/i, 0.74, "failure"],
  [/\b(latency|slow|degrad)/i, 0.58, "performance"],
  [/\b(warn|stale|drift)\b/i, 0.4, "warning"],
  [/\b(patch|heal|recover)\b/i, 0.22, "recovery"],
];

export function analyzePulse(event, extra) {
  const pulseName = String((event && event.pulseName) || extra || "unlabeled pulse");
  const hay = pulseName + " " + (extra || "") + " " + JSON.stringify((event && event.value) || "");
  let risk = 0.18;
  let axis = "nominal";
  for (const [re, score, name] of RISK) {
    if (re.test(hay) && score > risk) {
      risk = score;
      axis = name;
    }
  }
  const severity = risk >= 0.85 ? "critical" : risk >= 0.65 ? "high" : risk >= 0.45 ? "warn" : "info";
  const pulseId = typeof (event && event.pulseId) === "number" ? event.pulseId : null;
  const boardId = typeof (event && event.boardId) === "number" ? event.boardId : null;
  const brief = [
    'Pulse "' + pulseName + '"',
    pulseId != null ? "item " + pulseId : null,
    boardId != null ? "board " + boardId : null,
    "risk " + Math.round(risk * 100) + " on " + axis + " axis",
  ]
    .filter(Boolean)
    .join(" · ");
  return { pulseName, pulseId, boardId, risk, axis, severity, brief };
}

function quality(result) {
  if (result.status !== "fulfilled" || !result.text) return 0;
  const lengthScore = Math.min(1, result.text.trim().length / 420);
  const latencyPenalty = Math.min(0.45, result.latency_ms / 20000);
  return Math.max(0, lengthScore * (1 - latencyPenalty));
}

export function fuseRails(results) {
  const live = results.filter((r) => r.status === "fulfilled" && r.text);
  const dissent = [];
  for (const r of results) if (r.status === "rejected") dissent.push(r.model + ": " + (r.reason || "rejected"));
  if (!live.length) {
    return { score: 0, winnerModel: null, fusedSummary: "Both rails failed.", dissent, jaccard: 0, rails: results };
  }
  if (live.length === 1) {
    return { score: 0.62, winnerModel: live[0].model, fusedSummary: live[0].text, dissent, jaccard: 1, rails: results };
  }
  const tokens = live.map((r) => tokenize(r.text));
  let pairSum = 0;
  let pairN = 0;
  for (let i = 0; i < tokens.length; i++) {
    for (let j = i + 1; j < tokens.length; j++) {
      pairSum += jaccard(tokens[i], tokens[j]);
      pairN++;
    }
  }
  const jac = pairN ? pairSum / pairN : 1;
  let best = live[0];
  let bestQ = -1;
  for (const r of live) {
    const q = quality(r) * (0.55 + 0.45 * jac);
    if (q > bestQ) {
      bestQ = q;
      best = r;
    }
  }
  const others = live.filter((r) => r.model !== best.model);
  if (jac < 0.22 && others[0] && others[0].text) dissent.push("Rails diverged.");
  const fused =
    jac >= 0.35
      ? best.text
      : best.text + "\n\nDissent (" + (others[0] && others[0].model) + "): " + String((others[0] && others[0].text) || "").slice(0, 480);
  return {
    score: Math.round((0.35 * bestQ + 0.65 * jac) * 1000) / 1000,
    winnerModel: best.model,
    fusedSummary: fused,
    dissent,
    jaccard: Math.round(jac * 1000) / 1000,
    rails: results,
  };
}

export function mondayPrompt(event) {
  const symbolic = analyzePulse(event);
  return [
    "You are VOLTCORE Dual-Rail, a production SRE analyst.",
    "Given a Monday.com item change, return a tight operational brief:",
    "1) what changed  2) likely blast radius  3) next action (one line).",
    "No markdown fences. Max 120 words.",
    "Pulse: " + (event.pulseName || symbolic.pulseName),
    "IDs: board=" + (event.boardId ?? "?") + " item=" + (event.pulseId ?? "?"),
    "Column: " + (event.columnId || "n/a"),
    "Value: " + JSON.stringify(event.value ?? {}).slice(0, 800),
    "Symbolic prior: " + symbolic.brief,
  ].join("\n");
}
