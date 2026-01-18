/**
 * Prompts Module
 *
 * Central exports for all AI prompt templates and builders.
 */

// Search-aware system prompt for Maple AI
export {
  SEARCH_SYSTEM_PROMPT,
  DATA_COVERAGE,
  CONTENT_TYPES,
  CHAMBERS,
  SENSITIVE_TOPICS,
  buildSearchSystemPrompt,
  buildSearchResultsPrompt,
  buildNoResultsRetryPrompt,
  containsSensitiveTopic,
  detectSensitiveTopics,
  type SearchSystemPromptParams,
  type SearchResultForPrompt,
  type SearchResultsMetadata,
  type OriginalSearchParams,
} from "./search-system";

// Query clarification prompt for handling ambiguous queries
export {
  CLARIFICATION_SYSTEM_ADDITION,
  TOPIC_CLARIFICATIONS,
  detectAmbiguity,
  generateClarificationQuestion,
  analyzeQueryForClarification,
  buildClarificationPrompt,
  isClarificationResponse,
  refineQueryFromClarification,
  type AmbiguityType,
  type AmbiguityDetection,
  type ClarificationOption,
  type ClarificationQuestion,
  type ClarificationResult,
} from "./clarification";
