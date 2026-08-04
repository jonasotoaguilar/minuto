import type { NormalizedError } from '@/lib/error';

const DEFAULT_MAX_QUEUE_SIZE = 20;
const DEFAULT_FETCH_TIMEOUT_MS = 5_000;
const DEFAULT_MAX_ATTEMPTS = 3;
const DEFAULT_ATTEMPT_DELAY_MS = 500;
const DEFAULT_COOLDOWN_MS = 60_000;
const MAX_RETRY_DELAY_MS = 30_000;
const CONSECUTIVE_FAILURES_BEFORE_COOLDOWN = 3;

export type FetchLike = (
  input: string,
  init?: RequestInit,
) => Promise<Response>;

/** Wire format posted to the reporting endpoint. */
export interface TelemetryEvent {
  type: 'error';
  timestamp: number;
  route?: string;
  operation?: string;
  sessionPresent?: boolean;
  error: NormalizedError;
  metadata: Record<string, unknown>;
}

export interface TelemetryDeliveryOptions {
  /** Explicit reporting endpoint. Absent -> disabled no-op. */
  endpoint?: string;
  /** Injectable fetch for deterministic tests; defaults to global fetch. */
  fetchImpl?: FetchLike;
  maxQueueSize?: number;
  fetchTimeoutMs?: number;
  maxAttempts?: number;
  attemptDelayMs?: number;
  cooldownMs?: number;
  now?: () => number;
}

function resolveFetch(): FetchLike | undefined {
  return typeof globalThis.fetch === 'function'
    ? (globalThis.fetch.bind(globalThis) as FetchLike)
    : undefined;
}

/**
 * Owns the outbound side of telemetry: a bounded FIFO queue, a background
 * flush loop, per-event retries with exponential backoff, a cooldown after
 * consecutive failures, and per-request timeouts. Never throws; delivery
 * failures are internal and only affect delivery guarantees.
 */
export class TelemetryDeliverer {
  private readonly endpoint: string | undefined;
  private readonly fetchImpl: FetchLike | undefined;
  private readonly maxQueueSize: number;
  private readonly fetchTimeoutMs: number;
  private readonly maxAttempts: number;
  private readonly attemptDelayMs: number;
  private readonly cooldownMs: number;
  private readonly now: () => number;

  private readonly queue: TelemetryEvent[] = [];
  private isFlushing = false;
  private consecutiveFailures = 0;
  private cooldownUntil = 0;

  constructor(options: TelemetryDeliveryOptions = {}) {
    this.endpoint = options.endpoint?.trim() || undefined;
    this.fetchImpl = options.fetchImpl ?? resolveFetch();
    this.maxQueueSize = Math.max(
      0,
      options.maxQueueSize ?? DEFAULT_MAX_QUEUE_SIZE,
    );
    this.fetchTimeoutMs = Math.max(
      0,
      options.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS,
    );
    this.maxAttempts = Math.max(1, options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS);
    this.attemptDelayMs = Math.max(
      0,
      options.attemptDelayMs ?? DEFAULT_ATTEMPT_DELAY_MS,
    );
    this.cooldownMs = Math.max(0, options.cooldownMs ?? DEFAULT_COOLDOWN_MS);
    this.now = options.now ?? Date.now;
  }

  get enabled(): boolean {
    return this.endpoint !== undefined && this.fetchImpl !== undefined;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  /** True while the deliverer is cooling down after repeated failures. */
  isCoolingDown(now: number): boolean {
    return now < this.cooldownUntil;
  }

  /**
   * Enqueues a finalized event for delivery; drops it when disabled, cooling
   * down, or above the bounded queue size. Flushes in the background.
   */
  enqueue(event: TelemetryEvent): void {
    if (!this.enabled || this.isCoolingDown(event.timestamp)) {
      return;
    }

    if (this.queue.length >= this.maxQueueSize) {
      this.queue.shift();
    }

    this.queue.push(event);

    // Flush in the background; failures are handled inside and never surface.
    void this.flush();
  }

  private async flush(): Promise<void> {
    if (this.isFlushing) {
      return;
    }

    this.isFlushing = true;

    try {
      while (this.queue.length > 0) {
        const event = this.queue[0];
        const delivered = await this.deliver(event);

        // The head may have been evicted by a bounded push while this event
        // was in flight; only remove it when it is still the head.
        if (this.queue[0] === event) {
          this.queue.shift();
        }

        if (!delivered) {
          this.consecutiveFailures += 1;

          if (
            this.consecutiveFailures >= CONSECUTIVE_FAILURES_BEFORE_COOLDOWN
          ) {
            this.cooldownUntil = this.now() + this.cooldownMs;
            this.queue.length = 0;
            return;
          }

          continue;
        }

        this.consecutiveFailures = 0;
      }
    } finally {
      this.isFlushing = false;
    }
  }

  private async deliver(event: TelemetryEvent): Promise<boolean> {
    for (let attempt = 0; attempt < this.maxAttempts; attempt += 1) {
      try {
        if (await this.post(event)) {
          return true;
        }
      } catch {
        // Network failure — retry until the attempt budget is exhausted.
      }

      if (attempt < this.maxAttempts - 1) {
        await this.sleep(this.backoffDelay(attempt));
      }
    }

    return false;
  }

  private backoffDelay(attempt: number): number {
    return Math.min(this.attemptDelayMs * 2 ** attempt, MAX_RETRY_DELAY_MS);
  }

  private sleep(delayMs: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }

  private async post(event: TelemetryEvent): Promise<boolean> {
    const endpoint = this.endpoint;
    const fetchImpl = this.fetchImpl;

    if (!endpoint || !fetchImpl) {
      return false;
    }

    const controller =
      typeof AbortController === 'function' ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), this.fetchTimeoutMs)
      : null;

    try {
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
        signal: controller?.signal,
      });

      return response.ok;
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }
}
