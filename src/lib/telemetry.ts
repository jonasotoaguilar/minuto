import {
  type NormalizedError,
  normalizeError,
  redactRecord,
} from '@/lib/error';
import {
  getRouteContext,
  normalizeRouteForTelemetry,
} from '@/lib/telemetry-context';
import {
  type FetchLike,
  TelemetryDeliverer,
  type TelemetryEvent,
} from '@/lib/telemetry-delivery';

const DEFAULT_DEDUPE_WINDOW_MS = 60_000;

export interface TelemetryContext {
  /** Route template (e.g. "/control"); never query params or ids. */
  route?: string;
  /** Operation label (e.g. "attendance.clockIn"); small fixed vocabulary. */
  operation?: string;
  /** Presence only — never the session itself or any user identifier. */
  sessionPresent?: boolean;
  /** Free-form metadata; sensitive keys and credential patterns are redacted. */
  metadata?: Record<string, unknown>;
}

export interface TelemetryOptions {
  /** Explicit reporting endpoint. Absent (and no env var) -> disabled no-op. */
  endpoint?: string;
  /** Injectable fetch for deterministic tests; defaults to global fetch. */
  fetchImpl?: FetchLike;
  maxQueueSize?: number;
  fetchTimeoutMs?: number;
  maxAttempts?: number;
  attemptDelayMs?: number;
  cooldownMs?: number;
  dedupeWindowMs?: number;
  now?: () => number;
}

/**
 * Capture side of client telemetry: normalizes thrown values, redacts
 * metadata, deduplicates repeat signatures, and hands finalized events to
 * the bounded deliverer. Synchronous, never throws, never blocks.
 */
export class TelemetryReporter {
  private readonly dedupeWindowMs: number;
  private readonly now: () => number;
  private readonly deliverer: TelemetryDeliverer;
  private readonly lastSeenByFingerprint = new Map<string, number>();

  constructor(options: TelemetryOptions = {}) {
    const envEndpoint = process.env.EXPO_PUBLIC_TELEMETRY_ENDPOINT?.trim();
    this.dedupeWindowMs = Math.max(
      0,
      options.dedupeWindowMs ?? DEFAULT_DEDUPE_WINDOW_MS,
    );
    this.now = options.now ?? Date.now;
    this.deliverer = new TelemetryDeliverer({
      endpoint: options.endpoint?.trim() || envEndpoint || undefined,
      fetchImpl: options.fetchImpl,
      maxQueueSize: options.maxQueueSize,
      fetchTimeoutMs: options.fetchTimeoutMs,
      maxAttempts: options.maxAttempts,
      attemptDelayMs: options.attemptDelayMs,
      cooldownMs: options.cooldownMs,
      now: options.now,
    });
  }

  get enabled(): boolean {
    return this.deliverer.enabled;
  }

  get pendingCount(): number {
    return this.deliverer.pendingCount;
  }

  /**
   * Synchronous, never throws, never blocks. Returns true when the event was
   * enqueued; false when disabled, cooling down, or dropped as a duplicate.
   */
  captureError(error: unknown, context: TelemetryContext = {}): boolean {
    if (!this.enabled) {
      return false;
    }

    const timestamp = this.now();

    if (this.deliverer.isCoolingDown(timestamp)) {
      return false;
    }

    const event: TelemetryEvent = {
      type: 'error',
      timestamp,
      route: normalizeRouteForTelemetry(
        context.route?.trim() || getRouteContext() || '',
      ),
      operation: context.operation?.trim() || undefined,
      sessionPresent: context.sessionPresent,
      error: normalizeError(error),
      metadata: redactRecord(context.metadata ?? {}),
    };

    if (this.isDuplicate(event, timestamp)) {
      return false;
    }

    this.deliverer.enqueue(event);

    return true;
  }

  private isDuplicate(event: TelemetryEvent, now: number): boolean {
    if (this.dedupeWindowMs <= 0) {
      return false;
    }

    const fingerprint = [
      event.error.name,
      event.error.message,
      event.route ?? '',
      event.operation ?? '',
    ].join('|');

    const lastSeen = this.lastSeenByFingerprint.get(fingerprint);

    if (lastSeen !== undefined && now - lastSeen < this.dedupeWindowMs) {
      return true;
    }

    this.lastSeenByFingerprint.set(fingerprint, now);

    for (const [key, seenAt] of this.lastSeenByFingerprint) {
      if (now - seenAt >= this.dedupeWindowMs) {
        this.lastSeenByFingerprint.delete(key);
      }
    }

    return false;
  }
}

export const telemetry = new TelemetryReporter();
