// HTTP retry with 429/5xx backoff honoring Retry-After.
// Extracted pattern from reference repo (awareness-check ui_controller.js fetchWithTranslationRetry).

const DEFAULT_ATTEMPTS = 4;
const BASE_BACKOFF_MS = 400;
const MAX_BACKOFF_MS = 20_000;

function parseRetryAfter(header) {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.min(seconds * 1000, MAX_BACKOFF_MS);
  const date = Date.parse(header);
  if (!Number.isNaN(date)) return Math.min(Math.max(date - Date.now(), 0), MAX_BACKOFF_MS);
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run an async operation with retry on retryable failures.
 * op receives the attempt number and must throw RetryableError (or an error with
 * .status of 429/5xx, or .retryable = true) to trigger a retry.
 */
export async function withRetry(op, { attempts = DEFAULT_ATTEMPTS, onRetry = null } = {}) {
  let lastErr;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await op(attempt);
    } catch (err) {
      lastErr = err;
      const status = err?.status ?? err?.response?.status;
      const retryable = err?.retryable === true || status === 429 || (status >= 500 && status < 600);
      if (!retryable || attempt === attempts) throw err;
      const retryAfter = parseRetryAfter(err?.headers?.['retry-after'] ?? err?.response?.headers?.get?.('retry-after'));
      const backoff = retryAfter ?? Math.min(BASE_BACKOFF_MS * 2 ** (attempt - 1), MAX_BACKOFF_MS);
      if (onRetry) onRetry({ attempt, backoff, status });
      await sleep(backoff);
    }
  }
  throw lastErr;
}

/**
 * Bounded-concurrency runner (reference repo pattern: worker pools of 3-6).
 * FAIL-FAST: if any worker throws, the whole call rejects and remaining results
 * are discarded. Callers that need all-or-nothing semantics (e.g. panel reviews)
 * rely on this; callers that need partial results must catch inside the worker.
 */
export async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function run() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}
