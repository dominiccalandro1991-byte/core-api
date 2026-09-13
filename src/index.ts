/**
 * VOLTCORE Core API
 * Cloudflare Worker BFF with mesh HMAC control plane
 */

import { SupabasePersistence } from './utils/supabase-client';
import { OpenRouterEnsemble } from './utils/model-router';
import { MeshSignatureValidator } from './utils/mesh-signature';
import { handleMondayWebhook } from './routes/webhooks/monday';

// Global instances (initialized on first request)
let supabase: SupabasePersistence | null = null;
let modelRouter: OpenRouterEnsemble | null = null;
let signatureValidator: MeshSignatureValidator | null = null;

/**
 * Initialize global services from environment secrets
 */
function initializeServices(env: Record<string, string>): void {
  if (!supabase) {
    const supabaseUrl = env.SUPABASE_URL;
    const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      throw new Error(
        'Missing Supabase configuration: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY required'
      );
    }

    supabase = new SupabasePersistence({
      url: supabaseUrl,
      serviceRoleKey: supabaseKey,
    });
  }

  if (!modelRouter) {
    const openrouterKey = env.OPENROUTER_API_KEY;

    if (!openrouterKey) {
      throw new Error('Missing OpenRouter API key: OPENROUTER_API_KEY required');
    }

    modelRouter = new OpenRouterEnsemble({
      apiKey: openrouterKey,
    });
  }

  if (!signatureValidator) {
    const meshHmac = env.MESH_HMAC;

    if (!meshHmac) {
      throw new Error('Missing mesh HMAC secret: MESH_HMAC required');
    }

    signatureValidator = new MeshSignatureValidator(meshHmac);
  }
}

/**
 * Main request handler
 */
export default {
  async fetch(
    request: Request,
    env: Record<string, string>
  ): Promise<Response> {
    const url = new URL(request.url);
    const pathname = url.pathname;

    try {
      // Initialize services (idempotent)
      initializeServices(env);

      // Route: Monday.com webhook
      if (pathname === '/api/webhooks/monday' && request.method === 'POST') {
        return await handleMondayWebhook(request, {
          supabase: supabase!,
          env,
        });
      }

      // Route: GET /api/v1/events (public, non-secret payloads)
      if (pathname === '/api/v1/events' && request.method === 'GET') {
        return handleGetEvents(env);
      }

      // Route: POST /api/v1/events (public ingest)
      if (pathname === '/api/v1/events' && request.method === 'POST') {
        return await handlePostEvents(request, env);
      }

      // Route: GET /api/v1/fleet (public roster)
      if (pathname === '/api/v1/fleet' && request.method === 'GET') {
        return handleGetFleet(env);
      }

      // Route: POST /api/v1/heal (mesh HMAC protected)
      if (pathname === '/api/v1/heal' && request.method === 'POST') {
        return await handleHeal(request, env);
      }

      // Route: POST /api/v1/command (mesh HMAC protected)
      if (pathname === '/api/v1/command' && request.method === 'POST') {
        return await handleCommand(request, env);
      }

      // Route: Health check
      if (pathname === '/health' && request.method === 'GET') {
        return new Response(
          JSON.stringify({
            status: 'ok',
            timestamp: new Date().toISOString(),
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response('Not found', { status: 404 });
    } catch (error) {
      console.error('Unhandled error:', error);
      return new Response(
        JSON.stringify({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : 'Unknown error',
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }
  },
};

/**
 * Route handlers (stubs for full implementation)
 */

function handleGetEvents(env: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      message: 'GET /api/v1/events - List events (public)',
      status: 'stub',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handlePostEvents(request: Request, env: Record<string, string>): Promise<Response> {
  return new Response(
    JSON.stringify({
      message: 'POST /api/v1/events - Ingest event (public)',
      status: 'stub',
    }),
    { status: 202, headers: { 'Content-Type': 'application/json' } }
  );
}

function handleGetFleet(env: Record<string, string>): Response {
  return new Response(
    JSON.stringify({
      message: 'GET /api/v1/fleet - Mesh roster (public)',
      status: 'stub',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleHeal(request: Request, env: Record<string, string>): Promise<Response> {
  // Verify mesh signature
  const headers = Object.fromEntries(request.headers);
  if (!signatureValidator!.verifySignature(headers)) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      message:
        'POST /api/v1/heal - Mesh HMAC attest → optional trunk commit',
      status: 'stub',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}

async function handleCommand(request: Request, env: Record<string, string>): Promise<Response> {
  // Verify mesh signature
  const headers = Object.fromEntries(request.headers);
  if (!signatureValidator!.verifySignature(headers)) {
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(
    JSON.stringify({
      message: 'POST /api/v1/command - Mesh HMAC control (ping, drain, heartbeat)',
      status: 'stub',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
}
