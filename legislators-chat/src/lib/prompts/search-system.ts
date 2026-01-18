/**
 * Search System Prompt for Maple AI
 *
 * Configures Maple AI to understand and use the PolSearch API for
 * congressional content searches. Defines JSON output format and
 * teaches available filters and content types.
 */

// =============================================================================
// Constants
// =============================================================================

/** Congressional data coverage period */
export const DATA_COVERAGE = {
  startYear: 2020,
  endYear: 2026,
  description: "Congressional records from 2020 to present (2026)",
} as const;

/** Available content types */
export const CONTENT_TYPES = {
  hearing: "Committee hearing transcripts with witness testimony",
  floor_speech: "Speeches delivered on the House or Senate floor",
  vote: "Roll call voting records on bills and amendments",
} as const;

/** Available chambers */
export const CHAMBERS = {
  house: "House of Representatives",
  senate: "Senate",
} as const;

// =============================================================================
// System Prompt
// =============================================================================

/**
 * Core system prompt that teaches Maple AI about PolSearch capabilities.
 * This is combined with other context (filters, conversation) before sending to Maple.
 */
export const SEARCH_SYSTEM_PROMPT = `You are a congressional research assistant helping citizens understand legislative proceedings via the PolSearch API (2020-2026 data: hearings, floor speeches, votes).

## SEARCH DECISION

| Search | Don't Search |
|--------|--------------|
| Topics, bills, policy issues | Greetings, small talk |
| Legislator statements | How-to questions about this tool |
| Hearings, speeches, votes | Info already retrieved this session |
| Congressional activity | Non-congressional topics |

## JSON OUTPUT FORMAT

Output search JSON in fenced code block:
\`\`\`json
{"action":"search","params":{"q":"query","enrich":true}}
\`\`\`

### Parameters

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| q | Yes | string | Search query |
| enrich | Yes | boolean | Always \`true\` |
| type | No | string | \`hearing\`,\`floor_speech\`,\`vote\` (comma-separated) |
| speaker | No | string | Last name, fuzzy match |
| committee | No | string | Partial name works (e.g., "Judiciary") |
| chamber | No | string | \`"house"\` or \`"senate"\` (lowercase) |
| congress | No | number | 116, 117, or 118 |
| from/to | No | string | \`YYYY-MM-DD\` or \`YYYY-MM\` |
| limit | No | number | 1-100 (default: 10) |
| offset | No | number | Pagination offset |

## EXAMPLES

| User Query | Key Params |
|------------|------------|
| "What have senators said about climate change?" | \`q:"climate change", type:"hearing,floor_speech", chamber:"senate"\` |
| "Elizabeth Warren on banking regulation" | \`q:"banking regulation", type:"hearing", speaker:"Warren"\` |
| "Infrastructure hearings in 2023" | \`q:"infrastructure", type:"hearing", from:"2023-01", to:"2023-12"\` |
| "Judiciary Committee on immigration" | \`q:"immigration", type:"hearing", committee:"Judiciary"\` |
| "Votes on the Inflation Reduction Act" | \`q:"Inflation Reduction Act", type:"vote"\` |

## FOLLOW-UP HANDLING

**Refine** (words: "only", "just", "filter", "from those"): Add constraints to previous search
**Expand** (new related topic): Search new topic, results merge
**Analyze** (summarize, compare): Don't search—use existing results

## NO RESULTS STRATEGY

Retry by removing filters in order: speaker → committee → dates → type restriction. Simplify keywords. If still empty, explain and suggest alternatives.

## RESPONSE GUIDELINES

- Synthesize results naturally; cite speaker, date, type
- Quote sparingly for impact
- Offer refinements
- Ask clarification if query is ambiguous`;

// =============================================================================
// Prompt Building Functions
// =============================================================================

/**
 * Parameters for building the search-aware system prompt
 */
export interface SearchSystemPromptParams {
  /** Active UI filters to communicate to the AI */
  activeFilters?: {
    party?: "D" | "R" | "I";
    state?: string;
    chamber?: "house" | "senate";
  };
  /** Additional context to append to the prompt */
  additionalContext?: string;
}

/**
 * Build the complete system prompt for search-aware chat
 *
 * @param params Optional parameters to customize the prompt
 * @returns Complete system prompt string
 *
 * @example
 * const systemPrompt = buildSearchSystemPrompt({
 *   activeFilters: { chamber: "senate" }
 * });
 */
export function buildSearchSystemPrompt(params?: SearchSystemPromptParams): string {
  let prompt = SEARCH_SYSTEM_PROMPT;

  // Add active filter context if provided
  if (params?.activeFilters) {
    const { party, state, chamber } = params.activeFilters;
    const filterParts: string[] = [];

    if (party) {
      const partyName = party === "D" ? "Democratic" : party === "R" ? "Republican" : "Independent";
      filterParts.push(`${partyName} party`);
    }
    if (state) {
      filterParts.push(`state of ${state}`);
    }
    if (chamber) {
      filterParts.push(`${chamber === "senate" ? "Senate" : "House"}`);
    }

    if (filterParts.length > 0) {
      prompt += `

## ACTIVE USER FILTERS

The user has the following filters active in the UI:
${filterParts.map((f) => `- ${f}`).join("\n")}

Consider these filters when constructing searches. For example, if the user has "Senate" selected, prefer \`chamber: "senate"\` in your searches unless they explicitly ask about the House.`;
    }
  }

  // Add any additional context
  if (params?.additionalContext) {
    prompt += `

## ADDITIONAL CONTEXT

${params.additionalContext}`;
  }

  return prompt;
}

/**
 * Build a prompt to feed search results back to Maple
 *
 * @param results Search results from PolSearch API
 * @param originalQuery The user's original query
 * @returns Formatted results string to append to conversation
 */
export function buildSearchResultsPrompt(
  results: SearchResultForPrompt[],
  metadata: SearchResultsMetadata
): string {
  if (results.length === 0) {
    return `[SEARCH_RESULTS]
Query: "${metadata.query}"
Total: 0 results

No results found for this search. Consider:
1. Using different keywords
2. Removing filters to broaden the search
3. Checking if the topic falls within the 2020-2026 data coverage period
[END_SEARCH_RESULTS]`;
  }

  const resultLines = results.map((r, i) => {
    const typeLabel = r.content_type.toUpperCase().replace("_", " ");
    const header = `${i + 1}. [${typeLabel}] ${r.title || "Untitled"} (${r.date || "Date unknown"})`;

    const details: string[] = [];
    if (r.speaker_name) details.push(`Speaker: ${r.speaker_name}`);
    if (r.committee) details.push(`Committee: ${r.committee}`);
    if (r.chamber) details.push(`Chamber: ${r.chamber}`);

    const text = r.text.length > 200 ? `${r.text.slice(0, 200)}...` : r.text;

    return `${header}
   ${details.join(" | ")}
   "${text}"${r.source_url ? `\n   Source: ${r.source_url}` : ""}`;
  });

  return `[SEARCH_RESULTS]
Query: "${metadata.query}"
Total: ${metadata.totalReturned} results${metadata.hasMore ? ` (showing ${results.length}, more available)` : ""}

${resultLines.join("\n\n")}
[END_SEARCH_RESULTS]`;
}

/**
 * Build a retry prompt when a search returns no results
 *
 * @param originalParams The original search parameters that returned no results
 * @returns Prompt instructing the AI to retry with broader search
 */
export function buildNoResultsRetryPrompt(originalParams: OriginalSearchParams): string {
  const paramsList = Object.entries(originalParams.params)
    .filter(([_, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  return `The previous search returned no results. Original search parameters:
${paramsList}

Please retry with a broader search by:
1. Removing the most restrictive filter (speaker, committee, or date range)
2. Using more general keywords in the query
3. Expanding the content types if limited

Output a new search JSON with relaxed parameters.`;
}

// =============================================================================
// Types
// =============================================================================

/** Simplified search result type for prompt building */
export interface SearchResultForPrompt {
  content_type: string;
  title?: string;
  date?: string;
  speaker_name?: string;
  chamber?: string;
  committee?: string;
  text: string;
  source_url?: string;
}

/** Metadata about search results for prompt building */
export interface SearchResultsMetadata {
  query: string;
  totalReturned: number;
  hasMore: boolean;
}

/** Original search params for retry prompts */
export interface OriginalSearchParams {
  params: {
    q: string;
    type?: string;
    speaker?: string;
    committee?: string;
    chamber?: string;
    congress?: number;
    from?: string;
    to?: string;
    limit?: number;
  };
}
