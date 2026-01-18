/**
 * Query Intent Analyzer
 *
 * Analyzes user prompts to determine whether they represent:
 * 1. A new search (different topic, unrelated to previous results)
 * 2. A refinement (narrowing down existing results)
 * 3. A follow-up (asking about existing results without needing new search)
 *
 * This helps the orchestration layer decide whether to:
 * - Preserve existing results while loading new ones
 * - Filter/update existing results in place
 * - Keep results as-is and just respond
 */

import type { ChatMessage, SearchResultData } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

export type QueryIntent =
  | "new_search" // Completely new topic, triggers fresh search
  | "refinement" // Narrowing existing results (speaker, date, type filter)
  | "expansion" // Broadening or pivoting from current results
  | "follow_up" // Question about existing results, no new search needed
  | "clarification"; // User asking for clarification, may need search or not

export interface QueryIntentResult {
  intent: QueryIntent;
  confidence: number; // 0-1 confidence in the intent classification
  /** For refinements: what aspect is being refined */
  refinementType?: "speaker" | "topic" | "date" | "type" | "chamber" | "multiple";
  /** For refinements: extracted filter values */
  extractedFilters?: {
    speaker?: string;
    dateRange?: { from?: string; to?: string };
    contentType?: string[];
    chamber?: string;
  };
  /** Whether to preserve existing results while new search runs */
  preserveResults: boolean;
  /** Whether to merge new results with existing (vs replace) */
  mergeResults: boolean;
  /** Reasoning for the intent classification */
  reasoning: string;
}

export interface QueryContext {
  /** The current user prompt */
  prompt: string;
  /** Previous messages in the conversation */
  previousMessages: ChatMessage[];
  /** Current search results from previous searches */
  currentResults: SearchResultData[];
  /** The last search query that was executed */
  lastSearchQuery?: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Keywords that indicate a refinement/filtering intent */
const REFINEMENT_KEYWORDS = [
  "only",
  "just",
  "filter",
  "narrow",
  "limit to",
  "show me only",
  "from those",
  "of those",
  "from these",
  "of these",
  "among those",
  "among these",
  "specifically",
  "in particular",
  "focus on",
  "drill down",
  "the ones that",
  "the ones who",
  "exclude",
  "remove",
  "hide",
  "without",
];

/** Keywords that indicate asking about existing results */
const FOLLOW_UP_KEYWORDS = [
  "which of these",
  "which of those",
  "who among them",
  "tell me more about",
  "more details on",
  "elaborate on",
  "explain",
  "summarize",
  "summary of",
  "what did",
  "how many",
  "list the",
  "can you explain",
  "why did",
];

/** Keywords that indicate expansion/pivot */
const EXPANSION_KEYWORDS = [
  "what about",
  "how about",
  "also show",
  "additionally",
  "also find",
  "also search",
  "in addition",
  "besides",
  "related to",
  "similar to",
  "like this but",
  "another",
  "other",
  "more on",
];

/** Keywords that indicate a completely new topic */
const NEW_TOPIC_INDICATORS = [
  "new topic",
  "different question",
  "change of subject",
  "unrelated but",
  "separately",
  "on another note",
  "switching gears",
];

/** Speaker filtering phrases */
const SPEAKER_FILTER_PATTERNS = [
  /only (?:from |by )?(?:senator |sen\. |representative |rep\. )?(\w+)/i,
  /just (?:from |by )?(?:senator |sen\. |representative |rep\. )?(\w+)/i,
  /filter (?:to |by |for )?(?:senator |sen\. |representative |rep\. )?(\w+)/i,
  /show (?:me )?only (?:senator |sen\. |representative |rep\. )?(\w+)/i,
  /(?:senator |sen\. |representative |rep\. )(\w+)(?:'s| only)/i,
  /what did (?:senator |sen\. |representative |rep\. )?(\w+)/i,
];


// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Check if prompt contains any of the given keywords/phrases
 */
function containsKeywords(prompt: string, keywords: string[]): boolean {
  const lowerPrompt = prompt.toLowerCase();
  return keywords.some((keyword) => lowerPrompt.includes(keyword.toLowerCase()));
}

/**
 * Extract speaker name from refinement prompt
 */
function extractSpeakerFilter(prompt: string): string | undefined {
  for (const pattern of SPEAKER_FILTER_PATTERNS) {
    const match = prompt.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return undefined;
}

/**
 * Extract content type filter from prompt
 */
function extractTypeFilter(prompt: string): string[] | undefined {
  const types: string[] = [];
  const lowerPrompt = prompt.toLowerCase();

  if (/hearings?/i.test(lowerPrompt)) {
    types.push("hearing");
  }
  if (/(?:floor )?speech(?:es)?/i.test(lowerPrompt)) {
    types.push("floor_speech");
  }
  if (/votes?|voting/i.test(lowerPrompt)) {
    types.push("vote");
  }

  return types.length > 0 ? types : undefined;
}

/**
 * Extract chamber filter from prompt
 */
function extractChamberFilter(prompt: string): string | undefined {
  const lowerPrompt = prompt.toLowerCase();
  if (/senate|senators?/i.test(lowerPrompt)) {
    return "senate";
  }
  if (/house|representatives?/i.test(lowerPrompt)) {
    return "house";
  }
  return undefined;
}

/**
 * Check if the prompt references existing results
 */
function referencesExistingResults(prompt: string): boolean {
  const referencePatterns = [
    /these results/i,
    /those results/i,
    /the results/i,
    /the speakers?/i,
    /those speakers?/i,
    /these speakers?/i,
    /the legislators?/i,
    /the hearings?/i,
    /the speech(?:es)?/i,
    /the votes?/i,
    /you (?:just )?(?:found|showed|listed|mentioned)/i,
    /from (?:the )?(?:above|previous|earlier)/i,
  ];

  return referencePatterns.some((pattern) => pattern.test(prompt));
}

/**
 * Check if two topics are related based on keyword overlap
 */
function areTopicsRelated(topic1: string, topic2: string): boolean {
  if (!topic1 || !topic2) return false;

  // Normalize and tokenize
  const normalize = (s: string) =>
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 3); // Only meaningful words

  const words1 = new Set(normalize(topic1));
  const words2 = new Set(normalize(topic2));

  // Calculate overlap
  let overlap = 0;
  for (const word of words1) {
    if (words2.has(word)) overlap++;
  }

  // If significant overlap, topics are related
  const minSize = Math.min(words1.size, words2.size);
  return minSize > 0 && overlap / minSize >= 0.3;
}

/**
 * Get the last search query from previous messages
 */
function getLastSearchQuery(messages: ChatMessage[]): string | undefined {
  // Look for the most recent message with search results
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (msg.role === "assistant" && msg.searchResults && msg.searchResults.length > 0) {
      // Try to find the user message that triggered this search
      for (let j = i - 1; j >= 0; j--) {
        if (messages[j].role === "user") {
          return messages[j].content;
        }
      }
    }
  }
  return undefined;
}

// =============================================================================
// Main Analyzer
// =============================================================================

/**
 * Analyze the user's prompt to determine query intent
 *
 * @param context The query context including prompt, previous messages, and current results
 * @returns QueryIntentResult with intent classification and metadata
 */
export function analyzeQueryIntent(context: QueryContext): QueryIntentResult {
  const { prompt, previousMessages, currentResults, lastSearchQuery } = context;

  // Default result
  const result: QueryIntentResult = {
    intent: "new_search",
    confidence: 0.5,
    preserveResults: true, // Default to preserving
    mergeResults: false,
    reasoning: "",
  };

  // Get last search query if not provided
  const effectiveLastQuery = lastSearchQuery || getLastSearchQuery(previousMessages);

  // ==========================================================================
  // Rule 1: Check for explicit new topic indicators
  // ==========================================================================
  if (containsKeywords(prompt, NEW_TOPIC_INDICATORS)) {
    result.intent = "new_search";
    result.confidence = 0.9;
    result.preserveResults = false;
    result.mergeResults = false;
    result.reasoning = "User explicitly indicated a new topic";
    return result;
  }

  // ==========================================================================
  // Rule 2: Check for refinement keywords
  // ==========================================================================
  if (containsKeywords(prompt, REFINEMENT_KEYWORDS) || referencesExistingResults(prompt)) {
    // This looks like a refinement - extract what's being filtered
    const speakerFilter = extractSpeakerFilter(prompt);
    const typeFilter = extractTypeFilter(prompt);
    const chamberFilter = extractChamberFilter(prompt);

    const refinementTypes: string[] = [];
    if (speakerFilter) refinementTypes.push("speaker");
    if (typeFilter) refinementTypes.push("type");
    if (chamberFilter) refinementTypes.push("chamber");

    if (refinementTypes.length > 0 || referencesExistingResults(prompt)) {
      result.intent = "refinement";
      result.confidence = 0.85;
      result.preserveResults = true;
      result.mergeResults = false; // Refinement replaces with filtered set
      result.refinementType =
        refinementTypes.length > 1
          ? "multiple"
          : (refinementTypes[0] as "speaker" | "topic" | "date" | "type" | "chamber");
      result.extractedFilters = {
        speaker: speakerFilter,
        contentType: typeFilter,
        chamber: chamberFilter,
      };
      result.reasoning = `Refinement detected: filtering by ${refinementTypes.join(", ") || "existing results reference"}`;
      return result;
    }
  }

  // ==========================================================================
  // Rule 3: Check for follow-up questions (no new search needed)
  // ==========================================================================
  if (containsKeywords(prompt, FOLLOW_UP_KEYWORDS) && currentResults.length > 0) {
    result.intent = "follow_up";
    result.confidence = 0.8;
    result.preserveResults = true;
    result.mergeResults = false;
    result.reasoning = "Follow-up question about existing results";
    return result;
  }

  // ==========================================================================
  // Rule 4: Check for expansion keywords
  // ==========================================================================
  if (containsKeywords(prompt, EXPANSION_KEYWORDS)) {
    result.intent = "expansion";
    result.confidence = 0.75;
    result.preserveResults = true;
    result.mergeResults = true; // Expansion adds to existing results
    result.reasoning = "User wants to expand or pivot from current results";
    return result;
  }

  // ==========================================================================
  // Rule 5: Check topic similarity with previous search
  // ==========================================================================
  if (effectiveLastQuery && currentResults.length > 0) {
    const isRelated = areTopicsRelated(prompt, effectiveLastQuery);

    if (isRelated) {
      // Related topic - could be refinement or expansion
      // Check if it's adding constraints or broadening
      const hasFilterWords = containsKeywords(prompt, ["only", "just", "filter", "limit"]);

      if (hasFilterWords) {
        result.intent = "refinement";
        result.confidence = 0.7;
        result.preserveResults = true;
        result.mergeResults = false;
        result.reasoning = "Related topic with filtering language";
      } else {
        result.intent = "expansion";
        result.confidence = 0.65;
        result.preserveResults = true;
        result.mergeResults = true;
        result.reasoning = "Related topic, expanding search";
      }
      return result;
    }
  }

  // ==========================================================================
  // Rule 6: Default - New search but preserve results during loading
  // ==========================================================================
  result.intent = "new_search";
  result.confidence = 0.6;
  result.preserveResults = currentResults.length > 0; // Preserve if we have existing results
  result.mergeResults = false;
  result.reasoning = "New topic or no clear refinement indicators";

  return result;
}

/**
 * Check if a message should trigger a search based on its content
 * Used to avoid triggering searches for simple follow-ups
 */
export function shouldTriggerSearch(context: QueryContext): boolean {
  const intent = analyzeQueryIntent(context);

  // Follow-up questions don't need a new search
  if (intent.intent === "follow_up") {
    return false;
  }

  // Everything else might need a search (let AI decide)
  return true;
}
