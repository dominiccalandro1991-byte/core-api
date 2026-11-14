/**
 * Additive fleet poll. One Cloudflare Cron tick → one PostgREST JSON batch.
 * O(1) round-trips in lane count. Does not call OpenRouter, heal, command, or HMAC paths.
 * Client interval polls and GitHub-minute crons are not emitters.
 */
import { DEPRECATED, INCOMPLETE, LANE_CEILING, LATTICE } from "./config.js";
import { ingestMany } from "./events.js";

export function fleetBodies(now = Date.now()) {
  const bodies = [];
  for (const source of Object.keys(LATTICE)) {
    if (DEPRECATED.has(source)) continue;
    const spec = LATTICE[source];
    const diag = INCOMPLETE[source];
    const incomplete = Boolean(diag);
    bodies.push({
      source,
      type: incomplete ? "health.diagnostic" : "health.heartbeat",
      severity: "info",
      payload: {
        status: incomplete ? "incomplete" : "live",
        surface: "cron",
        interval_s: 60,
        repo: spec?.repo ?? null,
        incomplete,
        missing_dependencies: diag?.missing_dependencies ?? [],
        required_build_specs: diag?.required_build_specs ?? [],
        ts: now,
      },
    });
  }
  return bodies;
}

export async function pollFleet(env) {
  const events = fleetBodies();
  if (events.length !== LANE_CEILING) {
    return { status: "rejected", count: events.length, error: "lane_ceiling", lanes: LANE_CEILING };
  }
  return ingestMany(env, events);
}
