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
