"use client";

/**
 * Search Orchestration Hook
 *
 * Manages the multi-step flow of:
 * 1. Send user message to Maple AI
 * 2. Extract search JSON from response
 * 3. Call PolSearch API
 * 4. Feed results back to Maple AI
 * 5. Get final synthesized response
 */

import * as React from "react";
import { parseAIResponse, toSearchParams, buildCorrectionPrompt, hasSearchIntent } from "@/lib/parse-ai-response";
import { searchContent, type SearchResponse, type SearchResult, SearchServiceError } from "@/lib/search-service";
import { buildSearchResultsPrompt, buildSearchSystemPrompt, type SearchResultForPrompt, type SearchResultsMetadata } from "@/lib/prompts/search-system";
import { analyzeQueryForClarification, type ClarificationQuestion, type ClarificationResult } from "@/lib/prompts/clarification";
import type { MessageRole } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

/** State of the orchestration flow */
export type OrchestrationStatus =
  | "idle"
  | "checking_clarity"
  | "awaiting_clarification"
  | "sending_initial"
  | "parsing_response"
  | "executing_search"
  | "sending_with_results"
  | "complete"
  | "error";

/** Orchestration error types */
export type OrchestrationErrorCode =
  | "PARSE_ERROR"
  | "SEARCH_ERROR"
  | "API_ERROR"
  | "MAX_RETRIES_EXCEEDED"
  | "UNKNOWN_ERROR";

/** Detailed error information */
export interface OrchestrationError {
  code: OrchestrationErrorCode;
  message: string;
  details?: string;
}

/** Result of an orchestration run */
export interface OrchestrationResult {
  /** Final response content for display */
  content: string;
  /** Search results if a search was performed */
  searchResults: SearchResult[] | null;
  /** Query that was searched (if any) */
  searchQuery: string | null;
  /** Whether a search was performed */
  searchPerformed: boolean;
  /** Any error that occurred */
  error: OrchestrationError | null;
  /** Clarification question if the query was ambiguous */
  clarification: ClarificationQuestion | null;
  /** Whether we're waiting for user clarification */
  needsClarification: boolean;
}

/** Message in the orchestration conversation */
interface OrchestrationMessage {
  role: MessageRole;
  content: string;
}

/** Configuration options */
export interface OrchestrationConfig {
  /** Maximum retry attempts for malformed JSON (default: 2) */
  maxRetries?: number;
  /** Whether to use search system prompt (default: true) */
  useSearchPrompt?: boolean;
  /** Active filters to pass to the search system prompt */
  activeFilters?: {
    party?: "D" | "R" | "I";
    state?: string;
    chamber?: "house" | "senate";
  };
  /** Skip clarification check (e.g., when responding to a clarification) */
  skipClarification?: boolean;
  /** Minimum confidence to trigger clarification (default: 0.5) */
  clarificationThreshold?: number;
}

/** Hook return value */
export interface UseSearchOrchestrationReturn {
  /** Current orchestration status */
  status: OrchestrationStatus;
  /** Whether orchestration is in progress */
  isOrchestrating: boolean;
  /** Current status message for UI display */
  statusMessage: string;
  /** Execute the orchestration flow */
  orchestrate: (
    userMessage: string,
    previousMessages?: OrchestrationMessage[],
    config?: OrchestrationConfig
  ) => Promise<OrchestrationResult>;
  /** Reset the orchestration state */
  reset: () => void;
}

// =============================================================================
// Constants
// =============================================================================

const DEFAULT_MAX_RETRIES = 2;

const STATUS_MESSAGES: Record<OrchestrationStatus, string> = {
  idle: "",
  checking_clarity: "Understanding your question...",
  awaiting_clarification: "Need a bit more information...",
  sending_initial: "Analyzing your question...",
  parsing_response: "Processing response...",
  executing_search: "Searching congressional records...",
  sending_with_results: "Synthesizing information...",
  complete: "",
  error: "An error occurred",
};

/** Default clarification confidence threshold */
const DEFAULT_CLARIFICATION_THRESHOLD = 0.5;

// =============================================================================
// API Functions
// =============================================================================

/**
 * Send a message to the chat API and get the full response (non-streaming)
 */
async function sendChatMessage(
  message: string,
  previousMessages: OrchestrationMessage[] = [],
  useSearchPrompt: boolean = true,
  activeFilters?: OrchestrationConfig["activeFilters"]
): Promise<string> {
  // Build system prompt
  const systemPrompt = useSearchPrompt
    ? buildSearchSystemPrompt({ activeFilters })
    : undefined;

  // Call the orchestrated chat endpoint
  const response = await fetch("/api/chat/orchestrated", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      context: {
        previousMessages,
        systemPrompt,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content || "";
}

/**
 * Convert SearchResult to SearchResultForPrompt for building result prompts
 */
function toSearchResultForPrompt(result: SearchResult): SearchResultForPrompt {
  return {
    content_type: result.content_type,
    title: result.title,
    date: result.date,
    speaker_name: result.speaker_name,
    chamber: result.chamber,
    committee: result.committee,
    text: result.text,
    source_url: result.source_url,
  };
}

// =============================================================================
// Hook
// =============================================================================

export function useSearchOrchestration(): UseSearchOrchestrationReturn {
  const [status, setStatus] = React.useState<OrchestrationStatus>("idle");

  const isOrchestrating = React.useMemo(
    () => !["idle", "complete", "error"].includes(status),
    [status]
  );

  const statusMessage = STATUS_MESSAGES[status];

  /**
   * Execute the full orchestration flow
   */
  const orchestrate = React.useCallback(
    async (
      userMessage: string,
      previousMessages: OrchestrationMessage[] = [],
      config: OrchestrationConfig = {}
    ): Promise<OrchestrationResult> => {
      const maxRetries = config.maxRetries ?? DEFAULT_MAX_RETRIES;
      const useSearchPrompt = config.useSearchPrompt ?? true;
      const skipClarification = config.skipClarification ?? false;
      const clarificationThreshold = config.clarificationThreshold ?? DEFAULT_CLARIFICATION_THRESHOLD;

      // Track conversation for multi-turn
      const conversation: OrchestrationMessage[] = [...previousMessages];
      let retryCount = 0;
      let lastResponse = "";
      let searchResults: SearchResult[] | null = null;
      let searchQuery: string | null = null;

      try {
        // Step 0: Check if clarification is needed (for first message or when not skipped)
        if (!skipClarification && previousMessages.length === 0) {
          setStatus("checking_clarity");
          const clarificationResult = analyzeQueryForClarification(userMessage, previousMessages.length);

          if (
            clarificationResult.needsClarification &&
            clarificationResult.detection.confidence >= clarificationThreshold &&
            clarificationResult.suggestedQuestion
          ) {
            setStatus("awaiting_clarification");

            // Build a conversational clarification response
            const question = clarificationResult.suggestedQuestion;
            const optionsText = question.options.map((opt) => `• ${opt.label}`).join("\n");
            const clarificationContent = `${question.question}\n\n${optionsText}`;

            return {
              content: clarificationContent,
              searchResults: null,
              searchQuery: null,
              searchPerformed: false,
              error: null,
              clarification: clarificationResult.suggestedQuestion,
              needsClarification: true,
            };
          }
        }

        // Step 1: Send initial message to Maple
        setStatus("sending_initial");
        lastResponse = await sendChatMessage(
          userMessage,
          conversation,
          useSearchPrompt,
          config.activeFilters
        );

        // Add user message to conversation
        conversation.push({ role: "user", content: userMessage });

        // Step 2: Parse response for search JSON
        setStatus("parsing_response");
        let parseResult = parseAIResponse(lastResponse);

        // Retry loop for malformed JSON
        while (!parseResult.hasSearchAction && parseResult.parseError && retryCount < maxRetries) {
          // Only retry if it seems like a search was intended
          if (!hasSearchIntent(lastResponse)) {
            break;
          }

          retryCount++;
          console.log(`Retry ${retryCount}/${maxRetries}: Requesting corrected JSON format`);

          // Add the failed response and correction request
          conversation.push({ role: "assistant", content: lastResponse });
          const correctionPrompt = buildCorrectionPrompt(lastResponse, parseResult.parseError);

          setStatus("sending_initial");
          lastResponse = await sendChatMessage(
            correctionPrompt,
            conversation,
            useSearchPrompt,
            config.activeFilters
          );

          setStatus("parsing_response");
          parseResult = parseAIResponse(lastResponse);
        }

        // Step 3: Execute search if JSON was found
        if (parseResult.hasSearchAction && parseResult.searchAction) {
          setStatus("executing_search");
          searchQuery = parseResult.searchAction.params.q;

          try {
            const searchParams = toSearchParams(parseResult.searchAction.params);
            const searchResponse = await searchContent(searchParams);
            searchResults = searchResponse.results;

            // Step 4: Feed results back to Maple
            setStatus("sending_with_results");

            // Build the results prompt
            const resultsMetadata: SearchResultsMetadata = {
              query: searchResponse.query,
              totalReturned: searchResponse.total_returned,
              hasMore: searchResponse.has_more,
            };

            const resultsPrompt = buildSearchResultsPrompt(
              searchResults.map(toSearchResultForPrompt),
              resultsMetadata
            );

            // Add the AI's search decision to conversation
            conversation.push({ role: "assistant", content: lastResponse });

            // Send results for synthesis
            lastResponse = await sendChatMessage(
              resultsPrompt,
              conversation,
              false, // Don't use search prompt for synthesis
              config.activeFilters
            );
          } catch (searchError) {
            // Search failed - inform Maple and get a graceful response
            console.error("Search execution failed:", searchError);

            const errorMessage = searchError instanceof SearchServiceError
              ? searchError.userMessage
              : "The search service is temporarily unavailable.";

            conversation.push({ role: "assistant", content: lastResponse });

            lastResponse = await sendChatMessage(
              `[SEARCH_ERROR] The search could not be completed: ${errorMessage}. Please provide a helpful response based on your knowledge.`,
              conversation,
              false,
              config.activeFilters
            );
          }
        }

        // Step 5: Return final result
        setStatus("complete");

        return {
          content: lastResponse,
          searchResults,
          searchQuery,
          searchPerformed: searchResults !== null,
          error: null,
          clarification: null,
          needsClarification: false,
        };
      } catch (error) {
        setStatus("error");

        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        // If we have a conversational response despite the error, return it
        if (lastResponse && !parseAIResponse(lastResponse).hasSearchAction) {
          return {
            content: lastResponse,
            searchResults: null,
            searchQuery: null,
            searchPerformed: false,
            error: {
              code: "API_ERROR",
              message: errorMessage,
            },
            clarification: null,
            needsClarification: false,
          };
        }

        return {
          content: "",
          searchResults: null,
          searchQuery: null,
          searchPerformed: false,
          error: {
            code: "API_ERROR",
            message: errorMessage,
          },
          clarification: null,
          needsClarification: false,
        };
      }
    },
    []
  );

  /**
   * Reset the orchestration state
   */
  const reset = React.useCallback(() => {
    setStatus("idle");
  }, []);

  return {
    status,
    isOrchestrating,
    statusMessage,
    orchestrate,
    reset,
  };
}
