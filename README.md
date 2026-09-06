# VOLTCORE core-api

Cloudflare Worker BFF. This repository did not exist; ingest was a live Worker with no git source. This is the control-plane source of truth.

**Live:** `https://core-api.dominic-calandro1991.workers.dev`

Transfer to `voltcore-org/core-api` when org-create is granted.

## Routes

| Method | Path | Auth |
|---|---|---|
| GET | `/api/v1/events` | public (non-secret payloads only) |
| POST | `/api/v1/events` | public ingest |
| GET | `/api/v1/fleet` | public roster |
| POST | `/api/v1/remediate` | public copy-patch (legacy) |
| POST | `/api/v1/heal` | mesh HMAC → attest → optional trunk commit |
| POST | `/api/v1/command` | mesh HMAC (`ping`, `ping-all`, `drain`, `heartbeat`) |

## Mesh signature

```
X-Voltcore-Timestamp: <unix ms>
X-Voltcore-Nonce: <>=8 chars>
X-Voltcore-Signature: hex(HMAC-SHA256(MESH_HMAC, timestamp + "." + nonce))
```

Clock skew max 120s. Heal cap: 3 commits / source / hour. Paths must match the fleet allowlist. Secret patterns are rejected.

## Deploy

Secrets live in the Cloudflare dashboard only. `AUTONOMOUS_TRUNK=1` is required before `/heal` writes `main`. Attestation can pass and still return the patch only.

## GitHub token scopes

`contents:write` on voltcore-org (and TrueTurn if that source is healed). Fine-grained PAT or GitHub App installation token. Do not put tokens in git.
