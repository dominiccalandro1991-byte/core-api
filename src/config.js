export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Voltcore-Mesh, X-Voltcore-Timestamp, X-Voltcore-Nonce, X-Voltcore-Signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

/** Heal / path-bound subset. Do not use this as the lattice ceiling. */
export const FLEET = {
  "storm-path": { repo: "voltcore-org/storm-path", paths: ["telemetry.js", "index.html", "app.js", "styles.css"] },
  "storm-path-web": { repo: "voltcore-org/storm-path", paths: ["telemetry.js"] },
  "storm-path-mobile": { repo: "voltcore-org/storm-path-mobile", paths: ["src/"] },
  "nano-sandbox": { repo: "voltcore-org/nano-sandbox", paths: ["backend/app/", "public/nnacc-v2/js/", "app/"] },
  "snca-codec": { repo: "voltcore-org/snca-codec", paths: ["src/"] },
  "nano-cloud": { repo: "voltcore-org/snca-codec", paths: ["src/"] },
  "voltcore-command-center": { repo: "voltcore-org/voltcore-command-center", paths: ["app.js", "index.html", "styles.css"] },
  "trueturn": { repo: "dominiccalandro1991-byte/TrueTurn", paths: ["src/", "public/"] },
  "grok-orchestration-engine": { repo: "voltcore-org/voltcore-command-center", paths: ["app.js"] },
  monday: { repo: "voltcore-org/voltcore-command-center", paths: ["src/"] },
};

/** Full Phosphor lattice. Cron polls these keys. Deprecated lanes are omitted. */
export const LATTICE = {
  "core-api": { repo: "dominiccalandro1991-byte/core-api" },
  "storm-path": { repo: "voltcore-org/storm-path" },
  "storm-path-web": { repo: "voltcore-org/storm-path-web" },
  "storm-path-mobile": { repo: "voltcore-org/storm-path-mobile" },
  "storm-path-app": { repo: "dominiccalandro1991-byte/storm-path-app" },
  "nano-sandbox": { repo: "voltcore-org/nano-sandbox" },
  "snca-codec": { repo: "voltcore-org/snca-codec" },
  "nano-cloud": { repo: "voltcore-org/snca-codec" },
  "voltcore-command-center": { repo: "voltcore-org/voltcore-command-center" },
  "command_center.remediate": { repo: "voltcore-org/voltcore-command-center" },
  "grok-orchestration-engine": { repo: "voltcore-org/voltcore-command-center" },
  monday: { repo: "voltcore-org/voltcore-command-center" },
  "voltcore-code-agent": { repo: "dominiccalandro1991-byte/voltcore-code-agent" },
  "voltcore-anvil": { repo: "dominiccalandro1991-byte/voltcore-anvil" },
  "voltcore-phosphor": { repo: "dominiccalandro1991-byte/voltcore-phosphor" },
  trueturn: { repo: "dominiccalandro1991-byte/TrueTurn" },
  aetherion: { repo: "voltcore-org/Aetherion" },
  "voltcore-asml": { repo: "voltcore-org/voltcore-asml" },
  "conways-game-of-life": { repo: "voltcore-org/conways-game-of-life" },
  "paleochron-arrowforge": { repo: "voltcore-org/paleochron-arrowforge" },
  "vc010-five-artists-engine": { repo: "voltcore-org/vc010-five-artists-engine" },
  causalrail: { repo: "voltcore-org/causalrail" },
  "orbit-life-operator": { repo: "dominiccalandro1991-byte/orbit-life-operator" },
  "apexline-revenue-dashboard": { repo: "dominiccalandro1991-byte/apexline-revenue-dashboard" },
  "leadmorph-engine": { repo: "dominiccalandro1991-byte/leadmorph-engine" },
  "daily-ignition": { repo: "dominiccalandro1991-byte/daily-ignition" },
  "daily-ignition-sober-stack": { repo: "dominiccalandro1991-byte/daily-ignition-sober-stack" },
  lumenarchive: { repo: "dominiccalandro1991-byte/lumenarchive" },
  "lumen-archive-core": { repo: "dominiccalandro1991-byte/lumen-archive-core" },
  "lovable-engine-core": { repo: "dominiccalandro1991-byte/lovable-engine-core" },
  "kite-zest-acre-fjord": { repo: "dominiccalandro1991-byte/kite-zest-acre-fjord" },
};

export const DEPRECATED = new Set(["asml-nexus", "VOLTCORE-IdeaForge"]);

/** Construction targets emit health.diagnostic until verified live. */
export const INCOMPLETE = {};

export const LANE_CEILING = Object.keys(LATTICE).length;

export const FORBID = /(\.env($|\.)|secrets?\/|credentials|id_rsa|ghp_|service_role|wrangler\.toml)/i;
export const MAX_PATCH = 80_000;
export const HEAL_WINDOW_MS = 60 * 60 * 1000;
export const HEAL_CAP = 3;
export const ANOMALY = new Set(["critical", "fatal", "high", "error"]);
export const healLog = new Map();
