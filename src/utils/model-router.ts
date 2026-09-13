/**
 * Unified OpenRouter Multi-Model Router
 * Sends concurrent requests across frontier models and returns settled responses
 */

import OpenAI from 'openai';
import type {
  ModelEnsembleRequest,
  ModelEnsembleResponse,
  ModelResponse,
} from '../types/index';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';
const DEFAULT_MODELS = [
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o',
  'xai/grok-2-1212',
];

interface ClientConfig {
  apiKey: string;
  timeout?: number;
}

export class OpenRouterEnsemble {
  private clients: Map<string, OpenAI> = new Map();
  private config: ClientConfig;

  constructor(config: ClientConfig) {
    this.config = {
      timeout: 30000, // 30s default
      ...config,
    };
    this.initializeClients();
  }

  private initializeClients(): void {
    // Single shared client for OpenRouter
    this.clients.set(
      'default',
      new OpenAI({
        apiKey: this.config.apiKey,
        baseURL: OPENROUTER_BASE_URL,
        timeout: this.config.timeout,
        defaultHeaders: {
          'HTTP-Referer': 'https://github.com/voltcore-org/core-api',
          'X-Title': 'VOLTCORE Core API',
        },
      })
    );
  }

  /**
   * Send concurrent requests across multiple frontier models
   * Returns all settled responses (success or error)
   */
  async queryModelEnsemble(
    request: ModelEnsembleRequest
  ): Promise<ModelEnsembleResponse> {
    const requestId = this.generateRequestId();
    const modelsToQuery = request.models || DEFAULT_MODELS;
    const systemPrompt = request.system_prompt || 'You are a helpful assistant.';

    const startTime = Date.now();
    const client = this.clients.get('default')!;

    // Execute all model queries concurrently
    const queryPromises = modelsToQuery.map((modelId) =>
      this.queryModel(client, modelId, request, systemPrompt)
    );

    // Wait for all promises to settle (don't throw if one fails)
    const settledResults = await Promise.allSettled(queryPromises);

    // Transform settled results into responses
    const responses: ModelResponse[] = settledResults.map((result, index) => {
      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        return {
          model: modelsToQuery[index],
          content: '',
          tokens_used: 0,
          status: 'error' as const,
          latency_ms: Date.now() - startTime,
          error: result.reason?.message || 'Unknown error',
        };
      }
    });

    // Compute consensus (majority vote or first successful)
    const successfulResponses = responses.filter((r) => r.status === 'success');
    const consensusContent =
      successfulResponses.length > 0 ? successfulResponses[0].content : undefined;

    return {
      request_id: requestId,
      responses,
      settled_at: Date.now(),
      consensus_content: consensusContent,
    };
  }

  /**
   * Query a single model via OpenRouter
   */
  private async queryModel(
    client: OpenAI,
    modelId: string,
    request: ModelEnsembleRequest,
    systemPrompt: string
  ): Promise<ModelResponse> {
    const startTime = Date.now();

    try {
      const response = await client.chat.completions.create({
        model: modelId,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          {
            role: 'user',
            content: request.prompt,
          },
        ],
        temperature: request.temperature ?? 0.7,
        max_tokens: request.max_tokens ?? 2048,
      });

      const content =
        response.choices[0]?.message?.content || 'No response content';
      const tokensUsed = response.usage?.total_tokens || 0;

      return {
        model: modelId,
        content,
        tokens_used: tokensUsed,
        status: 'success',
        latency_ms: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      return {
        model: modelId,
        content: '',
        tokens_used: 0,
        status: 'error',
        latency_ms: Date.now() - startTime,
        error: errorMessage,
      };
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * Health check: verify model availability by sending a test query
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await this.queryModelEnsemble({
        prompt: 'Respond with "OK".',
        models: ['openai/gpt-4o'],
      });
      return response.responses.some((r) => r.status === 'success');
    } catch {
      return false;
    }
  }
}
