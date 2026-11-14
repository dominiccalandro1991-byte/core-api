export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Voltcore-Mesh, X-Voltcore-Timestamp, X-Voltcore-Nonce, X-Voltcore-Signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

/**
 * Heal / path-bound subset. Autonomous commit is limited to these paths.
 * Not the lattice ceiling. Do not grow this to all 46 repos.
 */
export const FLEET = {
  "storm-path": { repo: "voltcore-org/storm-path", paths: ["telemetry.js", "index.html", "app.js", "styles.css"] },
  "storm-path-web": { repo: "voltcore-org/storm-path", paths: ["telemetry.js"] },
  "storm-path-mobile": { repo: "voltcore-org/storm-path-mobile", paths: ["src/"] },
  "nano-sandbox": { repo: "voltcore-org/nano-sandbox", paths: ["backend/app/", "public/nnacc-v2/js/", "app/"] },
  "snca-codec": { repo: "voltcore-org/snca-codec", paths: ["src/"] },
  "nano-cloud": { repo: "voltcore-org/snca-codec", paths: ["src/"] },
  "voltcore-command-center": { repo: "voltcore-org/voltcore-command-center", paths: ["app.js", "index.html", "styles.css"] },
  trueturn: { repo: "dominiccalandro1991-byte/TrueTurn", paths: ["src/", "public/"] },
  "grok-orchestration-engine": { repo: "voltcore-org/voltcore-command-center", paths: ["app.js"] },
  monday: { repo: "voltcore-org/voltcore-command-center", paths: ["src/"] },
};

/** Full Phosphor lattice. Cron emits one batch covering these keys. Deprecated lanes are absent. */
export const LATTICE = {
  "core-api": { repo: "dominiccalandro1991-byte/core-api" },
  "core-api-org": { repo: "voltcore-org/core-api" },
  "storm-path": { repo: "voltcore-org/storm-path" },
  "storm-path-web": { repo: "voltcore-org/storm-path-web" },
  "storm-path-web-byte": { repo: "dominiccalandro1991-byte/storm-path-web" },
  "storm-path-mobile": { repo: "voltcore-org/storm-path-mobile" },
  "storm-path-app": { repo: "dominiccalandro1991-byte/storm-path-app" },
  "nano-sandbox": { repo: "voltcore-org/nano-sandbox" },
  "snca-codec": { repo: "voltcore-org/snca-codec" },
  "voltcore-command-center": { repo: "voltcore-org/voltcore-command-center" },
  "voltcore-code-agent": { repo: "dominiccalandro1991-byte/voltcore-code-agent" },
  "voltcore-anvil": { repo: "dominiccalandro1991-byte/voltcore-anvil" },
  "voltcore-phosphor": { repo: "dominiccalandro1991-byte/voltcore-phosphor" },
  "raft-command-center": { repo: "dominiccalandro1991-byte/raft-command-center" },
  "raft-command-center-webgl": { repo: "dominiccalandro1991-byte/raft-command-center-webgl" },
  trueturn: { repo: "dominiccalandro1991-byte/TrueTurn" },
  "trueturn-org": { repo: "voltcore-org/TrueTurn" },
  aetherion: { repo: "voltcore-org/Aetherion" },
  "voltcore-asml": { repo: "voltcore-org/voltcore-asml" },
  "conways-game-of-life": { repo: "voltcore-org/conways-game-of-life" },
  "paleochron-arrowforge": { repo: "voltcore-org/paleochron-arrowforge" },
  "paleochron-arrowforge-byte": { repo: "dominiccalandro1991-byte/paleochron-arrowforge" },
  "enclosed-raft-sim": { repo: "voltcore-org/enclosed-raft-sim" },
  aeroframe: { repo: "voltcore-org/aeroframe" },
  "aeroframe-byte": { repo: "dominiccalandro1991-byte/aeroframe" },
  "stratospheric-a300": { repo: "voltcore-org/stratospheric-a300" },
  "stratospheric-a300-byte": { repo: "dominiccalandro1991-byte/stratospheric-a300" },
  "NEXUSFLOW-ENGINE": { repo: "dominiccalandro1991-byte/NEXUSFLOW-ENGINE" },
  "OMNIAGENT-MATRIX": { repo: "dominiccalandro1991-byte/OMNIAGENT-MATRIX" },
  causalrail: { repo: "voltcore-org/causalrail" },
  "orbit-life-operator": { repo: "dominiccalandro1991-byte/orbit-life-operator" },
  "apexline-revenue-dashboard": { repo: "dominiccalandro1991-byte/apexline-revenue-dashboard" },
  "leadmorph-engine": { repo: "dominiccalandro1991-byte/leadmorph-engine" },
  "kite-zest-acre-fjord": { repo: "dominiccalandro1991-byte/kite-zest-acre-fjord" },
  helixar: { repo: "voltcore-org/helixar" },
  "vc010-five-artists-engine": { repo: "voltcore-org/vc010-five-artists-engine" },
  "daily-ignition": { repo: "dominiccalandro1991-byte/daily-ignition" },
  "daily-ignition-sober-stack": { repo: "dominiccalandro1991-byte/daily-ignition-sober-stack" },
  lumenarchive: { repo: "dominiccalandro1991-byte/lumenarchive" },
  "lumen-archive-core": { repo: "dominiccalandro1991-byte/lumen-archive-core" },
  "lovable-engine-core": { repo: "dominiccalandro1991-byte/lovable-engine-core" },
  "dream-canvas-pro-8d31b443": { repo: "voltcore-org/dream-canvas-pro-8d31b443" },
  "Prototype-1": { repo: "voltcore-org/Prototype-1" },
  "byte-forge": { repo: "dominiccalandro1991-byte/byte-forge" },
  "backroads-agent": { repo: "dominiccalandro1991-byte/backroads-agent" },
  "codeforge-language-lab": { repo: "dominiccalandro1991-byte/codeforge-language-lab" },
};

export const DEPRECATED = new Set(["asml-nexus", "VOLTCORE-IdeaForge"]);

/** Construction targets emit health.diagnostic until verified live. */
export const INCOMPLETE = {};

export const LANE_CEILING = 46;

const latticeRepos = new Set();
for (const [id, spec] of Object.entries(LATTICE)) {
  if (DEPRECATED.has(id) || DEPRECATED.has(String(spec.repo).split("/")[1])) {
    throw new Error("purged lane reintroduced: " + id);
  }
  if (latticeRepos.has(spec.repo)) throw new Error("lattice repo not MECE: " + spec.repo);
  latticeRepos.add(spec.repo);
}
if (Object.keys(LATTICE).length !== LANE_CEILING) {
  throw new Error("lattice cardinality " + Object.keys(LATTICE).length + " != " + LANE_CEILING);
}

export const FORBID = /(\.env($|\.)|secrets?\/|credentials|id_rsa|ghp_|service_role|wrangler\.toml)/i;
export const MAX_PATCH = 80_000;
export const HEAL_WINDOW_MS = 60 * 60 * 1000;
export const HEAL_CAP = 3;
export const ANOMALY = new Set(["critical", "fatal", "high", "error"]);
export const healLog = new Map();
