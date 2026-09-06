export const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-Voltcore-Mesh, X-Voltcore-Timestamp, X-Voltcore-Nonce, X-Voltcore-Signature",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
  "Cache-Control": "no-store",
};

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
};

export const FORBID = /(\.env($|\.)|secrets?\/|credentials|id_rsa|ghp_|service_role|wrangler\.toml)/i;
export const MAX_PATCH = 80_000;
export const HEAL_WINDOW_MS = 60 * 60 * 1000;
export const HEAL_CAP = 3;
export const ANOMALY = new Set(["critical", "fatal", "high", "error"]);
export const healLog = new Map();
