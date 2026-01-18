const POLSEARCH_API_URL = process.env.POLSEARCH_API_URL || "http://localhost:8000";

const RETRY_DELAYS = [1000, 3000, 5000]; // 1s, 3s, 5s backoff
const REQUEST_TIMEOUT = 10000; // 10s timeout

interface FetchOptions {
  method?: string;
  body?: string;
  headers?: Record<string, string>;
}

class PolSearchError extends Error {
  constructor(
    message: string,
    public status?: number,
    public isRetryable: boolean = false
  ) {
    super(message);
    this.name = "PolSearchError";
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithTimeout(
  url: string,
  options: FetchOptions & { signal?: AbortSignal },
  timeout: number
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function polsearchFetch(
  path: string,
  options: FetchOptions = {}
): Promise<Response> {
  const url = `${POLSEARCH_API_URL}${path}`;
  let lastError: Error | null = null;

  // Initial attempt + retries
  for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
    try {
      const response = await fetchWithTimeout(
        url,
        {
          method: options.method || "GET",
          headers: {
            "Content-Type": "application/json",
            ...options.headers,
          },
          body: options.body,
        },
        REQUEST_TIMEOUT
      );

      // Don't retry client errors (4xx), only server/network errors
      if (response.ok || (response.status >= 400 && response.status < 500)) {
        return response;
      }

      // Server error - may be retryable
      lastError = new PolSearchError(
        `PolSearch returned ${response.status}`,
        response.status,
        true
      );
    } catch (error) {
      // Network error or timeout - retryable
      if (error instanceof Error) {
        const isTimeout = error.name === "AbortError";
        lastError = new PolSearchError(
          isTimeout ? "Request timeout" : error.message,
          undefined,
          true
        );
      } else {
        lastError = new PolSearchError("Unknown error", undefined, true);
      }
    }

    // If we have more retries, wait before next attempt
    if (attempt < RETRY_DELAYS.length) {
      console.error(
        `PolSearch request failed (attempt ${attempt + 1}/${RETRY_DELAYS.length + 1}), retrying in ${RETRY_DELAYS[attempt]}ms...`
      );
      await sleep(RETRY_DELAYS[attempt]);
    }
  }

  // All retries exhausted
  throw lastError || new PolSearchError("All retries exhausted");
}

export async function checkPolSearchHealth(): Promise<{
  available: boolean;
  latency?: number;
  error?: string;
}> {
  const start = Date.now();
  try {
    const response = await fetchWithTimeout(
      `${POLSEARCH_API_URL}/health`,
      { method: "GET" },
      5000 // 5s timeout for health check
    );
    const latency = Date.now() - start;

    if (response.ok) {
      return { available: true, latency };
    }
    return {
      available: false,
      latency,
      error: `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      available: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

export { PolSearchError };
