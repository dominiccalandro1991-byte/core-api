/**
 * Monday.com Webhook Handler
 * Edge-optimized route for board automation events
 * Challenge handshake verification + async event decoupling
 */

import type { MondayWebhookPayload } from '../../types/index';
import { SupabasePersistence } from '../../utils/supabase-client';

export interface WebhookContext {
  supabase: SupabasePersistence;
  env: Record<string, string>;
}

/**
 * Handle incoming Monday.com webhook
 * POST /api/webhooks/monday
 */
export async function handleMondayWebhook(
  request: Request,
  context: WebhookContext
): Promise<Response> {
  // Only allow POST
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let payload: MondayWebhookPayload;

  try {
    payload = (await request.json()) as MondayWebhookPayload;
  } catch {
    return new Response('Invalid JSON payload', { status: 400 });
  }

  // Handle challenge handshake (MUST respond immediately)
  if (payload.challenge) {
    console.log('Received Monday webhook challenge');
    return new Response(JSON.stringify({ challenge: payload.challenge }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Async event handling (return 202 Accepted immediately)
  if (payload.event) {
    // Decouple event processing to prevent timeout blocks
    processWebhookEventAsync(payload.event, context).catch((error) => {
      console.error('Async webhook processing error:', error);
    });

    return new Response(JSON.stringify({ status: 'accepted' }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ status: 'no_event' }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Process webhook event asynchronously
 * Decoupled from request/response cycle
 */
async function processWebhookEventAsync(
  event: Record<string, unknown>,
  context: WebhookContext
): Promise<void> {
  try {
    console.log('Processing Monday webhook event:', {
      type: event.type,
      timestamp: event.timestamp,
      boardId: event.boardId,
    });

    // Transform event into telemetry record
    const telemetryPayload = {
      timestamp: (event.timestamp as number) || Date.now(),
      source: `monday_${event.boardId}`,
      event_type: 'command' as const,
      payload: event,
      status: 'pending' as const,
      metadata: {
        webhook_source: 'monday.com',
        board_id: event.boardId,
        item_id: event.itemId,
        user_id: event.userId,
      },
    };

    // Log to telemetry
    const logged = await context.supabase.logTelemetryEvent(telemetryPayload);

    if (!logged) {
      console.warn('Failed to log Monday webhook event to telemetry');
      return;
    }

    console.log('Monday webhook event logged:', logged.id);

    // Optional: Trigger downstream processing
    // Example: queue for message bus, invoke automation rules, etc.
    await handleBoardAutomation(event, context);
  } catch (error) {
    console.error('Failed to process Monday webhook event:', error);
  }
}

/**
 * Handle board automation logic
 * Extensible hook for automation rules, state changes, etc.
 */
async function handleBoardAutomation(
  event: Record<string, unknown>,
  context: WebhookContext
): Promise<void> {
  // Placeholder for automation business logic
  // Examples:
  // - Sync item status to external system
  // - Trigger mesh heal if certain conditions met
  // - Update monetization counters
  // - Send notifications

  const eventType = event.type as string;

  if (eventType === 'board.item.updated') {
    console.log('Board item updated:', event.itemId);
    // TODO: Implement automation
  } else if (eventType === 'board.item.created') {
    console.log('Board item created:', event.itemId);
    // TODO: Implement automation
  }
}
