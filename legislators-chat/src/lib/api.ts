/**
 * API Client for Legislators Chat
 *
 * Handles communication with the backend API, which connects to Maple AI
 * for privacy-first, end-to-end encrypted LLM inference.
 */

import type {
  ChatRequest,
  ChatResponse,
  ApiError,
  ApiResponse,
  Legislator,
  SearchParams,
  PaginatedResponse,
} from "./types";

// =============================================================================
// Configuration
// =============================================================================

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
const DEFAULT_TIMEOUT = 30000; // 30 seconds
const STREAMING_ENABLED = process.env.NEXT_PUBLIC_ENABLE_STREAMING === "true";

// =============================================================================
// Error Handling
// =============================================================================

/** Custom error class for API errors */
export class ApiClientError extends Error {
  code: string;
  status?: number;
  details?: Record<string, unknown>;

  constructor(error: ApiError, status?: number) {
    super(error.message);
    this.name = "ApiClientError";
    this.code = error.code;
    this.status = status;
    this.details = error.details;
  }
}

/** Parse error response from the API */
async function parseErrorResponse(response: Response): Promise<ApiError> {
  try {
    const body = await response.json();
    if (body.error && typeof body.error === "object") {
      return body.error as ApiError;
    }
    if (body.message) {
      return {
        code: `HTTP_${response.status}`,
        message: body.message,
        details: body.details,
      };
    }
    return {
      code: `HTTP_${response.status}`,
      message: response.statusText || "An error occurred",
    };
  } catch {
    return {
      code: `HTTP_${response.status}`,
      message: response.statusText || "An error occurred",
    };
  }
}

// =============================================================================
// Request Utilities
// =============================================================================

/** Create an AbortController with timeout */
function createTimeoutController(timeout: number): {
  controller: AbortController;
  timeoutId: ReturnType<typeof setTimeout>;
} {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  return { controller, timeoutId };
}

/** Base fetch wrapper with timeout and error handling */
async function fetchWithTimeout<T>(
  url: string,
  options: RequestInit & { timeout?: number } = {}
): Promise<T> {
  const { timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  const { controller, timeoutId } = createTimeoutController(timeout);

  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        ...fetchOptions.headers,
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      throw new ApiClientError(error, response.status);
    }

    return await response.json();
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof Error) {
      if (error.name === "AbortError") {
        throw new ApiClientError({
          code: "TIMEOUT",
          message: `Request timed out after ${timeout}ms`,
        });
      }

      throw new ApiClientError({
        code: "NETWORK_ERROR",
        message: error.message || "Network error occurred",
      });
    }

    throw new ApiClientError({
      code: "UNKNOWN_ERROR",
      message: "An unknown error occurred",
    });
  }
}

// =============================================================================
// Streaming Utilities
// =============================================================================

/** Callback for streaming chat responses */
export type StreamCallback = (chunk: string, done: boolean) => void;

/** Parse Server-Sent Events (SSE) data */
function parseSSEData(data: string): { content?: string; done?: boolean } | null {
  if (data === "[DONE]") {
    return { done: true };
  }

  try {
    const parsed = JSON.parse(data);
    // Handle OpenAI-compatible streaming format
    if (parsed.choices?.[0]?.delta?.content) {
      return { content: parsed.choices[0].delta.content };
    }
    // Handle direct content format
    if (parsed.content) {
      return { content: parsed.content };
    }
    // Handle finish reason
    if (parsed.choices?.[0]?.finish_reason) {
      return { done: true };
    }
    return null;
  } catch {
    return null;
  }
}

/** Stream a fetch response with SSE handling */
async function streamResponse(response: Response, onChunk: StreamCallback): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new ApiClientError({
      code: "STREAM_ERROR",
      message: "Response body is not readable",
    });
  }

  const decoder = new TextDecoder();
  let fullContent = "";
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        onChunk("", true);
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === ":") continue;

        if (trimmed.startsWith("data: ")) {
          const data = trimmed.slice(6);
          const parsed = parseSSEData(data);

          if (parsed?.done) {
            onChunk("", true);
            return fullContent;
          }

          if (parsed?.content) {
            fullContent += parsed.content;
            onChunk(parsed.content, false);
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  return fullContent;
}

// =============================================================================
// Type Validation
// =============================================================================

/** Validate ChatRequest structure */
function validateChatRequest(request: ChatRequest): void {
  if (!request.message || typeof request.message !== "string") {
    throw new ApiClientError({
      code: "VALIDATION_ERROR",
      message: "Message is required and must be a string",
    });
  }

  if (request.message.trim().length === 0) {
    throw new ApiClientError({
      code: "VALIDATION_ERROR",
      message: "Message cannot be empty",
    });
  }
}

/** Validate ChatResponse structure */
function validateChatResponse(data: unknown): ChatResponse {
  if (!data || typeof data !== "object") {
    throw new ApiClientError({
      code: "INVALID_RESPONSE",
      message: "Invalid response format",
    });
  }

  const response = data as Record<string, unknown>;

  if (typeof response.message !== "string") {
    throw new ApiClientError({
      code: "INVALID_RESPONSE",
      message: "Response missing required message field",
    });
  }

  // Return with defaults for optional fields
  return {
    message: response.message,
    legislators: Array.isArray(response.legislators) ? response.legislators : undefined,
    documents: Array.isArray(response.documents) ? response.documents : undefined,
    votes: Array.isArray(response.votes) ? response.votes : undefined,
    hearings: Array.isArray(response.hearings) ? response.hearings : undefined,
    report: response.report as ChatResponse["report"],
    sources: Array.isArray(response.sources) ? response.sources : [],
    confidence: typeof response.confidence === "number" ? response.confidence : 0,
  };
}

// =============================================================================
// Chat API
// =============================================================================

/**
 * Send a chat message and receive a response
 * @param request - The chat request containing the user message
 * @param options - Optional configuration for the request
 * @returns The chat response with AI message and structured data
 */
export async function sendChatMessage(
  request: ChatRequest,
  options: { timeout?: number } = {}
): Promise<ChatResponse> {
  validateChatRequest(request);

  const data = await fetchWithTimeout<ApiResponse<ChatResponse>>(`${API_BASE_URL}/chat`, {
    method: "POST",
    body: JSON.stringify(request),
    timeout: options.timeout,
  });

  if (!data.success || !data.data) {
    throw new ApiClientError(data.error || { code: "UNKNOWN_ERROR", message: "Request failed" });
  }

  return validateChatResponse(data.data);
}

/**
 * Send a chat message with streaming response
 * @param request - The chat request containing the user message
 * @param onChunk - Callback for each streamed chunk
 * @param options - Optional configuration for the request
 * @returns Promise that resolves when streaming is complete
 */
export async function sendChatMessageStream(
  request: ChatRequest,
  onChunk: StreamCallback,
  options: { timeout?: number } = {}
): Promise<ChatResponse> {
  validateChatRequest(request);

  const { timeout = 60000 } = options; // Longer timeout for streaming
  const { controller, timeoutId } = createTimeoutController(timeout);

  try {
    const response = await fetch(`${API_BASE_URL}/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "text/event-stream",
      },
      body: JSON.stringify(request),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const error = await parseErrorResponse(response);
      throw new ApiClientError(error, response.status);
    }

    const fullContent = await streamResponse(response, onChunk);

    // Return minimal ChatResponse for streaming
    return {
      message: fullContent,
      sources: [],
      confidence: 0,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    if (error instanceof ApiClientError) {
      throw error;
    }

    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiClientError({
        code: "TIMEOUT",
        message: `Stream timed out after ${timeout}ms`,
      });
    }

    throw new ApiClientError({
      code: "STREAM_ERROR",
      message: error instanceof Error ? error.message : "Streaming failed",
    });
  }
}

/**
 * Smart chat function that uses streaming or regular based on config
 */
export async function chat(
  request: ChatRequest,
  options: {
    timeout?: number;
    onChunk?: StreamCallback;
    forceStream?: boolean;
  } = {}
): Promise<ChatResponse> {
  const useStreaming = options.forceStream ?? (STREAMING_ENABLED && options.onChunk);

  if (useStreaming && options.onChunk) {
    return sendChatMessageStream(request, options.onChunk, options);
  }

  return sendChatMessage(request, options);
}

// =============================================================================
// Legislator API
// =============================================================================

/**
 * Get legislator details by ID
 * @param id - The legislator's unique identifier
 * @returns The legislator's full information
 */
export async function getLegislator(
  id: string,
  options: { timeout?: number } = {}
): Promise<Legislator> {
  if (!id || typeof id !== "string") {
    throw new ApiClientError({
      code: "VALIDATION_ERROR",
      message: "Legislator ID is required",
    });
  }

  const data = await fetchWithTimeout<ApiResponse<Legislator>>(
    `${API_BASE_URL}/legislators/${encodeURIComponent(id)}`,
    { timeout: options.timeout }
  );

  if (!data.success || !data.data) {
    throw new ApiClientError(data.error || { code: "NOT_FOUND", message: "Legislator not found" });
  }

  return data.data;
}

// =============================================================================
// Search API
// =============================================================================

/**
 * Search documents, hearings, and vote records
 * @param params - Search parameters including query and filters
 * @returns Paginated search results
 */
export async function search<T>(
  params: SearchParams,
  options: { timeout?: number } = {}
): Promise<PaginatedResponse<T>> {
  if (!params.query || typeof params.query !== "string") {
    throw new ApiClientError({
      code: "VALIDATION_ERROR",
      message: "Search query is required",
    });
  }

  const queryParams = new URLSearchParams({
    q: params.query,
    ...(params.page && { page: String(params.page) }),
    ...(params.pageSize && { pageSize: String(params.pageSize) }),
    ...(params.sortBy && { sortBy: params.sortBy }),
  });

  if (params.filters?.length) {
    queryParams.set("filters", JSON.stringify(params.filters));
  }

  return fetchWithTimeout<PaginatedResponse<T>>(
    `${API_BASE_URL}/search?${queryParams.toString()}`,
    { timeout: options.timeout }
  );
}

// =============================================================================
// Report API
// =============================================================================

export interface ReportRequest {
  topic: string;
  legislators?: string[]; // Legislator IDs to include
  includeVotes?: boolean;
  includeStatements?: boolean;
}

/**
 * Generate an advocacy report
 * @param request - Report generation parameters
 * @returns The generated report
 */
export async function generateReport(
  request: ReportRequest,
  options: { timeout?: number } = {}
): Promise<ApiResponse<{ reportId: string; status: string }>> {
  if (!request.topic || typeof request.topic !== "string") {
    throw new ApiClientError({
      code: "VALIDATION_ERROR",
      message: "Report topic is required",
    });
  }

  return fetchWithTimeout(`${API_BASE_URL}/report`, {
    method: "POST",
    body: JSON.stringify(request),
    timeout: options.timeout || 60000, // Reports may take longer
  });
}

// =============================================================================
// Health Check
// =============================================================================

/**
 * Check if the API is available
 * @returns True if API is healthy
 */
export async function healthCheck(): Promise<boolean> {
  try {
    await fetchWithTimeout<{ status: string }>(`${API_BASE_URL}/health`, { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

// =============================================================================
// Exports
// =============================================================================

export const api = {
  chat,
  sendChatMessage,
  sendChatMessageStream,
  getLegislator,
  search,
  generateReport,
  healthCheck,
};

export default api;
