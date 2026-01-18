/**
 * Parse AI Response for Search JSON Extraction
 *
 * Extracts structured JSON blocks from Maple AI responses and validates
 * them for use with the PolSearch API orchestration flow.
 */

import type { SearchParams } from "./search-service";

// =============================================================================
// Types
// =============================================================================

/** Expected structure of a search action from Maple AI */
export interface SearchAction {
  action: "search";
  params: SearchActionParams;
}

/** Search parameters extracted from AI response */
export interface SearchActionParams {
  q: string;
  type?: string;
  speaker?: string;
  committee?: string;
  chamber?: "house" | "senate";
  congress?: number;
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
  enrich?: boolean;
  exclude_witnesses?: boolean;
  context?: number;
}

/** Result of parsing an AI response */
export interface ParseResult {
  /** Whether a valid search JSON was found */
  hasSearchAction: boolean;
  /** The extracted search action if found */
  searchAction: SearchAction | null;
  /** The text portion of the response (before/after JSON) */
  textContent: string;
  /** Any parse errors encountered */
  parseError: string | null;
}

/** Result of a validation check */
export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

// =============================================================================
// Constants
// =============================================================================

/** Regex to find ```json blocks in AI responses */
const JSON_BLOCK_REGEX = /```json\s*([\s\S]*?)```/g;

/** Regex to find any code blocks (fallback) */
const CODE_BLOCK_REGEX = /```(?:\w+)?\s*([\s\S]*?)```/g;

/** Required fields for a search action */
const REQUIRED_SEARCH_FIELDS = ["action", "params"] as const;

/** Required fields in search params */
const REQUIRED_PARAM_FIELDS = ["q"] as const;

/** Valid content types for the type parameter */
const VALID_CONTENT_TYPES = ["hearing", "floor_speech", "vote"];

/** Valid chamber values */
const VALID_CHAMBERS = ["house", "senate"];

// =============================================================================
// Main Parsing Function
// =============================================================================

/**
 * Parse an AI response to extract search JSON blocks
 *
 * @param response The raw text response from Maple AI
 * @returns ParseResult with extracted search action and text content
 *
 * @example
 * const result = parseAIResponse(mapleResponse);
 * if (result.hasSearchAction && result.searchAction) {
 *   const searchResults = await searchContent(result.searchAction.params);
 * }
 */
export function parseAIResponse(response: string): ParseResult {
  if (!response || typeof response !== "string") {
    return {
      hasSearchAction: false,
      searchAction: null,
      textContent: "",
      parseError: "Empty or invalid response",
    };
  }

  // Try to find ```json blocks first
  const jsonMatches = [...response.matchAll(JSON_BLOCK_REGEX)];

  // If no ```json blocks, try any code blocks
  const matches = jsonMatches.length > 0 ? jsonMatches : [...response.matchAll(CODE_BLOCK_REGEX)];

  if (matches.length === 0) {
    // No JSON blocks found - this is a conversational response
    return {
      hasSearchAction: false,
      searchAction: null,
      textContent: response.trim(),
      parseError: null,
    };
  }

  // Try to parse each match until we find a valid search action
  for (const match of matches) {
    const jsonStr = match[1].trim();

    try {
      const parsed = JSON.parse(jsonStr);

      // Check if this is a search action
      if (parsed.action === "search" && parsed.params) {
        const validation = validateSearchAction(parsed);

        if (validation.isValid) {
          // Extract text content (everything outside the JSON block)
          const textContent = response
            .replace(match[0], "")
            .trim()
            .replace(/\n{3,}/g, "\n\n"); // Normalize multiple newlines

          return {
            hasSearchAction: true,
            searchAction: parsed as SearchAction,
            textContent,
            parseError: null,
          };
        } else {
          // Found a search action but it's invalid
          return {
            hasSearchAction: false,
            searchAction: null,
            textContent: response.replace(match[0], "").trim(),
            parseError: `Invalid search action: ${validation.errors.join(", ")}`,
          };
        }
      }
    } catch {
      // JSON parse failed, continue to next match
      continue;
    }
  }

  // Found code blocks but none were valid search actions
  return {
    hasSearchAction: false,
    searchAction: null,
    textContent: response.trim(),
    parseError: null,
  };
}

// =============================================================================
// Validation Functions
// =============================================================================

/**
 * Validate an extracted search action
 *
 * @param action The parsed object to validate
 * @returns ValidationResult with validity status and any errors
 */
export function validateSearchAction(action: unknown): ValidationResult {
  const errors: string[] = [];

  if (!action || typeof action !== "object") {
    return { isValid: false, errors: ["Action must be an object"] };
  }

  const obj = action as Record<string, unknown>;

  // Check required top-level fields
  if (obj.action !== "search") {
    errors.push('action field must be "search"');
  }

  if (!obj.params || typeof obj.params !== "object") {
    errors.push("params field is required and must be an object");
    return { isValid: false, errors };
  }

  const params = obj.params as Record<string, unknown>;

  // Check required params
  if (!params.q || typeof params.q !== "string" || params.q.trim().length === 0) {
    errors.push("params.q (query) is required and must be a non-empty string");
  }

  // Validate optional fields
  if (params.type !== undefined) {
    if (typeof params.type !== "string") {
      errors.push("params.type must be a string");
    } else {
      const types = params.type.split(",").map((t) => t.trim());
      const invalidTypes = types.filter((t) => !VALID_CONTENT_TYPES.includes(t));
      if (invalidTypes.length > 0) {
        errors.push(`Invalid content types: ${invalidTypes.join(", ")}`);
      }
    }
  }

  if (params.chamber !== undefined) {
    if (!VALID_CHAMBERS.includes(params.chamber as string)) {
      errors.push(`params.chamber must be "house" or "senate"`);
    }
  }

  if (params.limit !== undefined) {
    const limit = params.limit as number;
    if (typeof limit !== "number" || limit < 1 || limit > 100) {
      errors.push("params.limit must be a number between 1 and 100");
    }
  }

  if (params.offset !== undefined) {
    const offset = params.offset as number;
    if (typeof offset !== "number" || offset < 0) {
      errors.push("params.offset must be a non-negative number");
    }
  }

  if (params.congress !== undefined) {
    const congress = params.congress as number;
    if (typeof congress !== "number" || congress < 116 || congress > 119) {
      errors.push("params.congress must be a valid congress number (116-119)");
    }
  }

  // Validate date formats
  if (params.from !== undefined) {
    if (!isValidDateFormat(params.from as string)) {
      errors.push("params.from must be in YYYY-MM-DD or YYYY-MM format");
    }
  }

  if (params.to !== undefined) {
    if (!isValidDateFormat(params.to as string)) {
      errors.push("params.to must be in YYYY-MM-DD or YYYY-MM format");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Check if a string is a valid date format (YYYY-MM-DD or YYYY-MM)
 */
function isValidDateFormat(dateStr: string): boolean {
  if (typeof dateStr !== "string") return false;
  return /^\d{4}-\d{2}(-\d{2})?$/.test(dateStr);
}

// =============================================================================
// Conversion Functions
// =============================================================================

/**
 * Convert extracted search params to the format expected by searchContent()
 *
 * @param params The extracted search params
 * @returns SearchParams compatible with the search service
 */
export function toSearchParams(params: SearchActionParams): Omit<SearchParams, "mode" | "enrich"> & { q: string } {
  return {
    q: params.q,
    ...(params.type && { type: params.type }),
    ...(params.speaker && { speaker: params.speaker }),
    ...(params.committee && { committee: params.committee }),
    ...(params.chamber && { chamber: params.chamber }),
    ...(params.congress && { congress: params.congress }),
    ...(params.from && { from: params.from }),
    ...(params.to && { to: params.to }),
    ...(params.limit && { limit: params.limit }),
    ...(params.offset && { offset: params.offset }),
    ...(params.exclude_witnesses !== undefined && { exclude_witnesses: params.exclude_witnesses }),
    ...(params.context && { context: params.context }),
  };
}

// =============================================================================
// Retry Prompt Builder
// =============================================================================

/**
 * Build a prompt to ask Maple for corrected JSON format
 *
 * @param originalResponse The original response that failed to parse
 * @param parseError The error message from parsing
 * @returns Prompt to send back to Maple for correction
 */
export function buildCorrectionPrompt(originalResponse: string, parseError: string): string {
  return `Your previous response could not be parsed correctly. Error: ${parseError}

Please provide a corrected response with a valid JSON search block in this exact format:

\`\`\`json
{
  "action": "search",
  "params": {
    "q": "topic keywords",
    "type": "hearing,floor_speech",
    "limit": 20,
    "enrich": true
  }
}
\`\`\`

Requirements:
- The JSON must be wrapped in \`\`\`json and \`\`\` tags
- "action" must be "search"
- "params.q" is required (the search query)
- "params.enrich" should be true
- Optional: type, speaker, committee, chamber, congress, from, to, limit

If you intended a conversational response without searching, simply respond without any JSON blocks.`;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Extract just the conversational text from a response, removing any JSON blocks
 *
 * @param response The raw AI response
 * @returns Clean text content without JSON blocks
 */
export function extractTextContent(response: string): string {
  if (!response) return "";

  return response
    .replace(JSON_BLOCK_REGEX, "")
    .replace(CODE_BLOCK_REGEX, "")
    .trim()
    .replace(/\n{3,}/g, "\n\n");
}

/**
 * Check if a response appears to contain a search intent
 * (useful for determining if we should retry on parse failure)
 *
 * @param response The AI response text
 * @returns True if the response seems to intend a search
 */
export function hasSearchIntent(response: string): boolean {
  if (!response) return false;

  const searchIndicators = [
    /"action"\s*:\s*"search"/i,
    /"params"\s*:/i,
    /```json/i,
    /searching for/i,
    /let me search/i,
    /I'll search/i,
  ];

  return searchIndicators.some((pattern) => pattern.test(response));
}
