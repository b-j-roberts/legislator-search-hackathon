/**
 * Search Service Layer for PolSearch API
 *
 * Frontend service for calling the PolSearch API through Next.js API routes.
 * Provides typed search functions, debouncing, and error handling.
 */

// =============================================================================
// PolSearch API Types
// =============================================================================

/** Search mode for queries */
export type SearchMode = "hybrid" | "vector" | "fts" | "phrase";

/** Content type filter */
export type ContentType = "hearing" | "floor_speech" | "vote" | "all";

/** Chamber filter (API uses lowercase) */
export type ApiChamber = "house" | "senate";

/** Context scope for RAG mode */
export type ContextScope = "same" | "related";

/** Search request parameters */
export interface SearchParams {
  q: string;
  mode?: SearchMode;
  type?: string;
  limit?: number;
  offset?: number;
  enrich?: boolean;
  exclude_witnesses?: boolean;
  context?: number;
  context_scope?: ContextScope;
  speaker?: string;
  committee?: string;
  chamber?: ApiChamber;
  congress?: number;
  from?: string;
  to?: string;
}

/** Speaker type from PolSearch API */
export type ApiSpeakerType = "representative" | "senator" | "presiding_officer" | "witness";

/** Individual search result */
export interface SearchResult {
  content_id: string;
  content_type: string;
  segment_index: number;
  text: string;
  score: number;
  start_time_ms: number;
  end_time_ms: number;
  content_id_str?: string;
  title?: string;
  date?: string;
  speaker_name?: string;
  speaker_type?: ApiSpeakerType;
  source_url?: string;
  chamber?: string;
  committee?: string;
  congress?: number;
  context_before?: string[];
  context_after?: string[];
}

/** Search API response */
export interface SearchResponse {
  query: string;
  mode: string;
  mode_used: string;
  results: SearchResult[];
  total_returned: number;
  has_more: boolean;
  next_offset?: number;
}

/** Content detail response */
export interface ContentDetailResponse {
  id: string;
  content_type: string;
  title: string;
  total_statements: number;
  total_segments: number;
  date?: string;
  chambers?: string;
  committee?: string;
  congress?: number;
  page_type?: string;
  source_url?: string;
}

/** API error response structure */
export interface SearchApiError {
  error: {
    code: string;
    message: string;
  };
}

// =============================================================================
// Error Handling
// =============================================================================

export class SearchServiceError extends Error {
  constructor(
    message: string,
    public code: string = "SEARCH_ERROR",
    public userMessage: string = "An error occurred while searching. Please try again."
  ) {
    super(message);
    this.name = "SearchServiceError";
  }
}

/** Transform API errors into user-friendly messages */
function getUserFriendlyMessage(code: string, message: string): string {
  const errorMessages: Record<string, string> = {
    POLSEARCH_ERROR: "The search service is temporarily unavailable. Please try again.",
    VALIDATION_ERROR: "Invalid search parameters. Please check your query.",
    NOT_FOUND: "The requested content could not be found.",
    INTERNAL_ERROR: "Something went wrong on our end. Please try again later.",
    NETWORK_ERROR: "Unable to connect to the search service. Please check your connection.",
    TIMEOUT: "The search request timed out. Please try a simpler query.",
  };

  return errorMessages[code] || message || "An unexpected error occurred.";
}

// =============================================================================
// Content Type Display Names
// =============================================================================

/** Maps API content_type values to user-friendly display names */
export const CONTENT_TYPE_DISPLAY_NAMES: Record<string, string> = {
  hearing: "Hearing",
  floor_speech: "Floor Speech",
  vote: "Vote",
};

/** Get display name for a content type */
export function getContentTypeDisplayName(contentType: string): string {
  return CONTENT_TYPE_DISPLAY_NAMES[contentType] || contentType;
}

// =============================================================================
// Debouncing Utility
// =============================================================================

/** Default debounce delay in milliseconds */
export const DEFAULT_DEBOUNCE_MS = 300;

/**
 * Creates a debounced version of a function
 * @param fn The function to debounce
 * @param delayMs Delay in milliseconds (default: 300ms)
 * @returns Debounced function with cancel method
 */
export function debounce<T extends (...args: Parameters<T>) => ReturnType<T>>(
  fn: T,
  delayMs: number = DEFAULT_DEBOUNCE_MS
): ((...args: Parameters<T>) => void) & { cancel: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  const debouncedFn = (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };

  debouncedFn.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
  };

  return debouncedFn;
}

// =============================================================================
// Search Functions
// =============================================================================

/**
 * Search for congressional content
 *
 * @param params Search parameters (q is required)
 * @returns Search response with results
 * @throws SearchServiceError on failure
 *
 * @example
 * const results = await searchContent({
 *   q: "climate change",
 *   type: "hearing,floor_speech",
 *   chamber: "senate",
 *   limit: 20
 * });
 */
export async function searchContent(
  params: Omit<SearchParams, "mode" | "enrich"> & { q: string }
): Promise<SearchResponse> {
  // Validate required parameter
  if (!params.q || params.q.trim().length === 0) {
    throw new SearchServiceError(
      "Query is required",
      "VALIDATION_ERROR",
      "Please enter a search term."
    );
  }

  // Build query string with enforced defaults
  const searchParams = new URLSearchParams();
  searchParams.set("q", params.q.trim());
  searchParams.set("mode", "hybrid"); // Always use hybrid mode
  searchParams.set("enrich", "true"); // Always enrich for richer metadata

  // Add optional parameters
  if (params.type) searchParams.set("type", params.type);
  if (params.limit) searchParams.set("limit", params.limit.toString());
  if (params.offset) searchParams.set("offset", params.offset.toString());
  if (params.exclude_witnesses !== undefined) searchParams.set("exclude_witnesses", params.exclude_witnesses.toString());
  if (params.context) searchParams.set("context", params.context.toString());
  if (params.context_scope) searchParams.set("context_scope", params.context_scope);
  if (params.speaker) searchParams.set("speaker", params.speaker);
  if (params.committee) searchParams.set("committee", params.committee);
  if (params.chamber) searchParams.set("chamber", params.chamber);
  if (params.congress) searchParams.set("congress", params.congress.toString());
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);

  try {
    const response = await fetch(`/api/search?${searchParams.toString()}`);

    if (!response.ok) {
      const errorData: SearchApiError = await response.json().catch(() => ({
        error: { code: "UNKNOWN_ERROR", message: "Failed to parse error response" },
      }));

      const userMessage = getUserFriendlyMessage(
        errorData.error.code,
        errorData.error.message
      );

      throw new SearchServiceError(errorData.error.message, errorData.error.code, userMessage);
    }

    const data: SearchResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof SearchServiceError) {
      throw error;
    }

    // Network or other errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new SearchServiceError(
        "Network error",
        "NETWORK_ERROR",
        "Unable to connect to the search service. Please check your connection."
      );
    }

    throw new SearchServiceError(
      error instanceof Error ? error.message : "Unknown error",
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again."
    );
  }
}

/**
 * Get detailed information about a specific piece of content
 *
 * @param id Content ID (UUID from search results)
 * @returns Content details
 * @throws SearchServiceError on failure
 *
 * @example
 * const details = await getContentDetails("550e8400-e29b-41d4-a716-446655440000");
 */
export async function getContentDetails(id: string): Promise<ContentDetailResponse> {
  if (!id || id.trim().length === 0) {
    throw new SearchServiceError(
      "Content ID is required",
      "VALIDATION_ERROR",
      "Please provide a valid content ID."
    );
  }

  try {
    const response = await fetch(`/api/content/${encodeURIComponent(id.trim())}`);

    if (!response.ok) {
      const errorData: SearchApiError = await response.json().catch(() => ({
        error: { code: "UNKNOWN_ERROR", message: "Failed to parse error response" },
      }));

      const userMessage = getUserFriendlyMessage(
        errorData.error.code,
        errorData.error.message
      );

      throw new SearchServiceError(errorData.error.message, errorData.error.code, userMessage);
    }

    const data: ContentDetailResponse = await response.json();
    return data;
  } catch (error) {
    if (error instanceof SearchServiceError) {
      throw error;
    }

    // Network or other errors
    if (error instanceof TypeError && error.message.includes("fetch")) {
      throw new SearchServiceError(
        "Network error",
        "NETWORK_ERROR",
        "Unable to connect to the service. Please check your connection."
      );
    }

    throw new SearchServiceError(
      error instanceof Error ? error.message : "Unknown error",
      "INTERNAL_ERROR",
      "An unexpected error occurred. Please try again."
    );
  }
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Creates a debounced search function
 *
 * @param onResults Callback when results are received
 * @param onError Callback when an error occurs
 * @param delayMs Debounce delay (default: 300ms)
 * @returns Object with search function and cancel method
 *
 * @example
 * const { search, cancel } = createDebouncedSearch(
 *   (results) => setResults(results),
 *   (error) => setError(error.userMessage)
 * );
 *
 * // In input handler:
 * search({ q: inputValue });
 *
 * // On cleanup:
 * cancel();
 */
export function createDebouncedSearch(
  onResults: (response: SearchResponse) => void,
  onError: (error: SearchServiceError) => void,
  delayMs: number = DEFAULT_DEBOUNCE_MS
): {
  search: (params: Omit<SearchParams, "mode" | "enrich"> & { q: string }) => void;
  cancel: () => void;
} {
  const debouncedFn = debounce(
    async (params: Omit<SearchParams, "mode" | "enrich"> & { q: string }) => {
      try {
        const results = await searchContent(params);
        onResults(results);
      } catch (error) {
        if (error instanceof SearchServiceError) {
          onError(error);
        } else {
          onError(
            new SearchServiceError(
              error instanceof Error ? error.message : "Unknown error",
              "INTERNAL_ERROR",
              "An unexpected error occurred."
            )
          );
        }
      }
    },
    delayMs
  );

  return {
    search: debouncedFn,
    cancel: debouncedFn.cancel,
  };
}
