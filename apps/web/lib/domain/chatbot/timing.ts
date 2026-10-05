import "server-only";

type TimingValue = number;

const timingEnabled = process.env.NODE_ENV !== "production" && (process.env.NODE_ENV === "development" ? process.env.CHATBOT_TIMING_DEBUG !== "0" : process.env.CHATBOT_TIMING_DEBUG === "1");

export class ChatbotTiming {
  readonly requestId: string;
  private readonly startedAt = performance.now();
  private readonly values = new Map<string, TimingValue>();
  private readonly occurrences = new Map<string, number>();

  constructor(requestId = crypto.randomUUID()) {
    this.requestId = requestId;
  }

  async measure<T>(label: string, operation: () => PromiseLike<T>): Promise<T> {
    if (!timingEnabled) return operation();
    const startedAt = performance.now();
    try {
      return await operation();
    } finally {
      this.record(label, performance.now() - startedAt);
    }
  }

  measureSync<T>(label: string, operation: () => T): T {
    if (!timingEnabled) return operation();
    const startedAt = performance.now();
    try {
      return operation();
    } finally {
      this.record(label, performance.now() - startedAt);
    }
  }

  async measureIndexed<T>(label: string, operation: () => PromiseLike<T>): Promise<T> {
    const occurrence = (this.occurrences.get(label) ?? 0) + 1;
    this.occurrences.set(label, occurrence);
    return this.measure(`${label}#${occurrence}`, operation);
  }

  record(label: string, durationMs: number) {
    if (timingEnabled) this.values.set(label, Math.round(durationMs * 100) / 100);
  }

  finish(fields: Record<string, string | boolean | number | undefined> = {}) {
    if (!timingEnabled) return;
    const durations = Object.fromEntries(this.values);
    console.info("[ChatbotTiming]", JSON.stringify({
      requestId: this.requestId,
      totalMs: Math.round((performance.now() - this.startedAt) * 100) / 100,
      ...fields,
      durations,
    }));
  }
}

export function chatbotTimingEnabled() {
  return timingEnabled;
}
