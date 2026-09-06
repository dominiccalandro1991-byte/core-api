# Deploy the mesh Worker

Live ingest today: `https://core-api.dominic-calandro1991.workers.dev`
This repo is the source of truth. Org create is 403 until the GitHub App is installed on `voltcore-org` with contents write; transfer this repo after that.

## Cloudflare secrets (never git)

`SUPABASE_URL`
`SUPABASE_SERVICE_ROLE_KEY`
`OPENROUTER_API_KEY`
`MESH_HMAC`
`GITHUB_TOKEN`  (contents:write on fleet repos)
`AUTONOMOUS_TRUNK`  (`1` to commit attested heals to main)

Deploy from this tree (`src/index.js` + `config.js` + `events.js` + `heal.js` + `handlers.js`).

After deploy, `GET /api/v1/fleet` returns the roster. Until then Command Center copy-patch (`POST /api/v1/remediate`) still works; `/heal` and `/command` 404.

## Mesh HMAC

```
X-Voltcore-Timestamp: unix-ms
X-Voltcore-Nonce: >=8 chars
X-Voltcore-Signature: hex(HMAC-SHA256(MESH_HMAC, timestamp + "." + nonce))
```

Clock skew 120s. Heal cap 3/hour/source. Path allowlist in `src/config.js`. Operator key is sessionStorage only.

## nano-sandbox subscriber

See `staging/nano-sandbox/`. Two new files + a two-line `main.py` include. Do not rewrite engines.
