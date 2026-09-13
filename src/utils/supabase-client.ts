/**
 * Supabase Database Client
 * Strict TypeScript bindings for PostgreSQL persistence layer
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type {
  TelemetryEvent,
  UserState,
  MonetizationRecord,
  SupabaseConfig,
} from '../types/index';

export class SupabasePersistence {
  private client: SupabaseClient;
  private readonly config: SupabaseConfig;

  constructor(config: SupabaseConfig) {
    this.config = config;
    this.client = createClient(config.url, config.serviceRoleKey);
  }

  /**
   * Log telemetry event with automatic timestamp
   */
  async logTelemetryEvent(event: Omit<TelemetryEvent, 'id' | 'created_at'>): Promise<TelemetryEvent | null> {
    const { data, error } = await this.client
      .from('telemetry_events')
      .insert([
        {
          ...event,
          created_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Telemetry insertion error:', error);
      return null;
    }

    return data as TelemetryEvent;
  }

  /**
   * Batch insert telemetry events for high-throughput scenarios
   */
  async logTelemetryEventsBatch(events: Omit<TelemetryEvent, 'id' | 'created_at'>[]): Promise<number> {
    const eventsWithTimestamp = events.map((e) => ({
      ...e,
      created_at: new Date().toISOString(),
    }));

    const { error, status } = await this.client
      .from('telemetry_events')
      .insert(eventsWithTimestamp);

    if (error) {
      console.error('Batch telemetry insertion error:', error);
      return 0;
    }

    return status === 201 ? events.length : 0;
  }

  /**
   * Query telemetry events for a specific source
   */
  async queryTelemetryEvents(
    source: string,
    limit: number = 100,
    offset: number = 0
  ): Promise<TelemetryEvent[]> {
    const { data, error } = await this.client
      .from('telemetry_events')
      .select('*')
      .eq('source', source)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Telemetry query error:', error);
      return [];
    }

    return data as TelemetryEvent[];
  }

  /**
   * Upsert user state (create or update)
   */
  async upsertUserState(userState: UserState): Promise<UserState | null> {
    const { data, error } = await this.client
      .from('user_state')
      .upsert(
        [
          {
            ...userState,
            updated_at: new Date().toISOString(),
          },
        ],
        { onConflict: 'user_id,mesh_id' }
      )
      .select()
      .single();

    if (error) {
      console.error('User state upsert error:', error);
      return null;
    }

    return data as UserState;
  }

  /**
   * Fetch user state by user_id and mesh_id
   */
  async getUserState(userId: string, meshId: string): Promise<UserState | null> {
    const { data, error } = await this.client
      .from('user_state')
      .select('*')
      .eq('user_id', userId)
      .eq('mesh_id', meshId)
      .single();

    if (error && error.code !== 'PGRST116') {
      // PGRST116 = not found (expected in some cases)
      console.error('User state fetch error:', error);
    }

    return data as UserState | null;
  }

  /**
   * Increment heal operation count for user in current billing cycle
   */
  async incrementHealCount(userId: string, meshId: string): Promise<void> {
    const { error } = await this.client.rpc('increment_heal_count', {
      p_user_id: userId,
      p_mesh_id: meshId,
    });

    if (error) {
      console.error('Heal count increment error:', error);
    }
  }

  /**
   * Record monetization transaction
   */
  async recordMonetization(record: Omit<MonetizationRecord, 'id' | 'created_at' | 'updated_at'>): Promise<MonetizationRecord | null> {
    const { data, error } = await this.client
      .from('monetization_records')
      .insert([
        {
          ...record,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])
      .select()
      .single();

    if (error) {
      console.error('Monetization record insertion error:', error);
      return null;
    }

    return data as MonetizationRecord;
  }

  /**
   * Fetch monetization records for current billing cycle
   */
  async getMonetizationRecords(
    userId: string,
    billingCycle: string
  ): Promise<MonetizationRecord[]> {
    const { data, error } = await this.client
      .from('monetization_records')
      .select('*')
      .eq('user_id', userId)
      .eq('billing_cycle', billingCycle);

    if (error) {
      console.error('Monetization records query error:', error);
      return [];
    }

    return data as MonetizationRecord[];
  }

  /**
   * Verify client connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.client.from('telemetry_events').select('count', { count: 'exact', head: true });
      return !error;
    } catch {
      return false;
    }
  }
}
