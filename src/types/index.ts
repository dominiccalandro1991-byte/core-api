/**
 * VOLTCORE Core Types
 * Strict TypeScript interfaces for database-driven logic
 */

export interface TelemetryEvent {
  id?: string;
  timestamp: number; // unix ms
  source: string; // mesh node identifier
  event_type: 'heal' | 'command' | 'ping' | 'error' | 'attestation';
  payload: Record<string, unknown>;
  status: 'success' | 'failure' | 'pending';
  metadata?: Record<string, unknown>;
  created_at?: string;
}

export interface UserState {
  id: string;
  user_id: string;
  mesh_id: string; // mesh node ID
  status: 'active' | 'inactive' | 'suspended';
  last_heartbeat: number; // unix ms
  heal_count_24h: number;
  last_heal_timestamp?: number;
  trusted_paths: string[];
  created_at: string;
  updated_at: string;
}

export interface MonetizationRecord {
  id?: string;
  user_id: string;
  mesh_id: string;
  billing_cycle: string; // YYYY-MM
  heal_operations: number;
  command_operations: number;
  total_cost_cents: number;
  rate_limit_exceeded_count: number;
  status: 'pending' | 'billed' | 'paid' | 'disputed';
  created_at: string;
  updated_at: string;
}

export interface MondayWebhookPayload {
  challenge?: string;
  event?: {
    type: string;
    timestamp: number;
    userId: string;
    boardId: string;
    itemId?: string;
    data: Record<string, unknown>;
  };
}

export interface ModelEnsembleRequest {
  prompt: string;
  system_prompt?: string;
  temperature?: number;
  max_tokens?: number;
  models?: string[];
}

export interface ModelResponse {
  model: string;
  content: string;
  tokens_used: number;
  status: 'success' | 'error';
  latency_ms: number;
  error?: string;
}

export interface ModelEnsembleResponse {
  request_id: string;
  responses: ModelResponse[];
  settled_at: number;
  consensus_content?: string; // majority or best response
}

export interface SupabaseConfig {
  url: string;
  serviceRoleKey: string;
}

export interface OpenRouterConfig {
  apiKey: string;
  baseUrl: string;
}

export interface MeshSignature {
  timestamp: number;
  nonce: string;
  signature: string;
}
