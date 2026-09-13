/**
 * Mesh Signature Verification
 * Validates X-Voltcore-* headers using HMAC-SHA256
 */

import { createHmac, randomBytes } from 'crypto';
import type { MeshSignature } from '../types/index';

export class MeshSignatureValidator {
  private readonly meshHmac: string;
  private readonly maxClockSkewMs: number = 120000; // 120 seconds

  constructor(meshHmac: string) {
    if (!meshHmac) {
      throw new Error('MESH_HMAC secret must be provided');
    }
    this.meshHmac = meshHmac;
  }

  /**
   * Verify incoming request signature from mesh
   * Headers:
   *   X-Voltcore-Timestamp: unix ms
   *   X-Voltcore-Nonce: >=8 chars
   *   X-Voltcore-Signature: hex(HMAC-SHA256(MESH_HMAC, timestamp + "." + nonce))
   */
  verifySignature(headers: Record<string, string | string[] | undefined>): boolean {
    try {
      const timestamp = this.extractHeader(headers, 'X-Voltcore-Timestamp');
      const nonce = this.extractHeader(headers, 'X-Voltcore-Nonce');
      const signature = this.extractHeader(headers, 'X-Voltcore-Signature');

      if (!timestamp || !nonce || !signature) {
        console.warn('Missing required mesh signature headers');
        return false;
      }

      // Validate timestamp (prevent replay attacks)
      const ts = parseInt(timestamp, 10);
      const now = Date.now();
      if (isNaN(ts) || Math.abs(now - ts) > this.maxClockSkewMs) {
        console.warn(`Clock skew exceeded or invalid timestamp: ${timestamp}`);
        return false;
      }

      // Validate nonce length
      if (nonce.length < 8) {
        console.warn('Nonce too short (must be >=8 chars)');
        return false;
      }

      // Compute expected signature
      const message = `${timestamp}.${nonce}`;
      const expectedSignature = createHmac('sha256', this.meshHmac)
        .update(message)
        .digest('hex');

      // Constant-time comparison to prevent timing attacks
      const isValid = this.timingSafeEqual(signature, expectedSignature);

      if (!isValid) {
        console.warn('Signature mismatch');
      }

      return isValid;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Generate a new mesh signature for outgoing requests
   */
  generateSignature(): MeshSignature {
    const timestamp = Date.now();
    const nonce = randomBytes(8).toString('hex');
    const message = `${timestamp}.${nonce}`;
    const sig = createHmac('sha256', this.meshHmac)
      .update(message)
      .digest('hex');

    return {
      timestamp,
      nonce,
      signature: sig,
    };
  }

  /**
   * Extract header value (case-insensitive, handle array)
   */
  private extractHeader(
    headers: Record<string, string | string[] | undefined>,
    name: string
  ): string | null {
    const keys = Object.keys(headers);
    const key = keys.find((k) => k.toLowerCase() === name.toLowerCase());

    if (!key) return null;

    const value = headers[key];
    if (Array.isArray(value)) return value[0] || null;
    return value || null;
  }

  /**
   * Timing-safe string comparison
   */
  private timingSafeEqual(a: string, b: string): boolean {
    if (a.length !== b.length) return false;

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }
}
