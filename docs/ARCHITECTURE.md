# VOLTCORE Core-API Architecture

## Overview

This is a **database-driven Cloudflare Worker BFF** implementing:

1. **Unified OpenRouter Multi-Model Router** — Concurrent ensemble LLM queries
2. **Webhook Ingress Handler** — Monday.com board automation (challenge handshake + async processing)
3. **Database Persistence Layer** — Supabase PostgreSQL for telemetry, user state, monetization

## Component Structure

```
src/
├── index.ts                          # Cloudflare Worker entry point
├── types/index.ts                    # Core TypeScript interfaces
├── utils/
│   ├── model-router.ts              # OpenRouter multi-model ensemble
│   ├── supabase-client.ts           # Database client + bindings
│   └── mesh-signature.ts            # HMAC signature verification
└── routes/
    └── webhooks/
        └── monday.ts                # Monday.com webhook handler
```

## Database Schema (Supabase PostgreSQL)

### telemetry_events
```sql
CREATE TABLE telemetry_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp BIGINT NOT NULL,         -- unix ms
  source TEXT NOT NULL,              -- mesh node identifier
  event_type TEXT NOT NULL,          -- 'heal' | 'command' | 'ping' | 'error' | 'attestation'
  payload JSONB NOT NULL,            -- event data
  status TEXT NOT NULL,              -- 'success' | 'failure' | 'pending'
  metadata JSONB,                    -- additional context
  created_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_telemetry_source_created 
  ON telemetry_events(source, created_at DESC);
```

### user_state
```sql
CREATE TABLE user_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  mesh_id TEXT NOT NULL,
  status TEXT NOT NULL,              -- 'active' | 'inactive' | 'suspended'
  last_heartbeat BIGINT,             -- unix ms
  heal_count_24h INT DEFAULT 0,      -- rate limit counter
  last_heal_timestamp BIGINT,
  trusted_paths TEXT[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now(),
  UNIQUE(user_id, mesh_id)
);

CREATE INDEX idx_user_state_user 
  ON user_state(user_id);
```

### monetization_records
```sql
CREATE TABLE monetization_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  mesh_id TEXT NOT NULL,
  billing_cycle TEXT NOT NULL,       -- 'YYYY-MM'
  heal_operations INT DEFAULT 0,
  command_operations INT DEFAULT 0,
  total_cost_cents INT DEFAULT 0,
  rate_limit_exceeded_count INT DEFAULT 0,
  status TEXT NOT NULL,              -- 'pending' | 'billed' | 'paid' | 'disputed'
  created_at TIMESTAMP DEFAULT now(),
  updated_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_monetization_user_cycle 
  ON monetization_records(user_id, billing_cycle);
```

## API Routes

| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/api/v1/events` | public | List recent events (non-secret payloads) |
| POST | `/api/v1/events` | public | Ingest event |
| GET | `/api/v1/fleet` | public | Mesh roster |
| POST | `/api/v1/heal` | mesh HMAC | Attest & optional trunk commit |
| POST | `/api/v1/command` | mesh HMAC | Control commands (ping, drain, heartbeat) |
| POST | `/api/webhooks/monday` | none | Monday.com board automation |
| GET | `/health` | none | Health check |

## Mesh Signature Protocol

All mesh-protected routes require **X-Voltcore-\* headers**:

```
X-Voltcore-Timestamp: <unix ms>
X-Voltcore-Nonce: <>=8 chars>
X-Voltcore-Signature: hex(HMAC-SHA256(MESH_HMAC, timestamp + "." + nonce))
```

**Validation Rules:**
- Clock skew max: **120s**
- Nonce min length: **8 chars**
- HMAC algorithm: **SHA256**

## OpenRouter Multi-Model Ensemble

**Models (default):**
- `anthropic/claude-3.5-sonnet` — Best reasoning
- `openai/gpt-4o` — Fast + accurate
- `xai/grok-2-1212` — Novel perspectives

**Execution:**
- All models queried **concurrently**
- Responses collected via `Promise.allSettled()`
- Consensus: first successful response (extensible)
- Timeout: 30s per query

**Usage:**
```typescript
const ensemble = new OpenRouterEnsemble({ apiKey: env.OPENROUTER_API_KEY });
const result = await ensemble.queryModelEnsemble({
  prompt: 'Your query here',
  temperature: 0.7,
  max_tokens: 2048,
});
```

## Monday.com Webhook Handler

**Flow:**

1. **Challenge Handshake** (if `body.challenge` exists)
   - Immediately return `{ challenge: body.challenge }` with 200 OK
   - No asynchronous processing

2. **Event Ingestion** (if `body.event` exists)
   - Return `{ status: "accepted" }` with **202 Accepted** (non-blocking)
   - Decouple event processing to background task
   - Log to telemetry table

3. **Automation Hooks**
   - Trigger business logic (state changes, mesh heals, notifications)
   - Non-blocking; failures logged only

## Environment Secrets

Set in Cloudflare dashboard (never commit):

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
OPENROUTER_API_KEY=sk-or-...
MESH_HMAC=<your-mesh-secret-key>
GITHUB_TOKEN=ghp_...
AUTONOMOUS_TRUNK=1  # Optional: enable auto-commit to main
```

## Deployment

```bash
# Install dependencies
npm install

# Type check
npm run type-check

# Deploy to Cloudflare
npm run deploy
```

Live endpoint: `https://core-api.dominic-calandro1991.workers.dev`

## Next Steps

1. **Implement mesh heal logic** — `/api/v1/heal` endpoint with GitHub integration
2. **Add rate limiting & quotas** — Monetization enforcement
3. **Build fleet roster** — `/api/v1/fleet` mesh state aggregation
4. **Extend automation rules** — Monday.com board state sync
5. **Add observability** — Structured logging, tracing, alerts
