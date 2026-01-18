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

/**
 * Sensitive/controversial topic keywords for detection.
 * Used to trigger nonpartisan response handling.
 */
export const SENSITIVE_TOPICS = [
  // Reproductive rights
  "abortion",
  "reproductive rights",
  "roe v wade",
  "planned parenthood",
  "pro-life",
  "pro-choice",
  // Firearms
  "gun control",
  "gun rights",
  "firearms",
  "second amendment",
  "2nd amendment",
  "assault weapons",
  "ar-15",
  "mass shooting",
  // Immigration
  "immigration",
  "border security",
  "border wall",
  "illegal immigrants",
  "undocumented",
  "deportation",
  "daca",
  "dreamers",
  "asylum",
  // LGBTQ+
  "lgbtq",
  "gay rights",
  "same-sex marriage",
  "transgender",
  "gender identity",
  "drag",
  // Policing
  "police reform",
  "defund the police",
  "police brutality",
  "qualified immunity",
  "black lives matter",
  "blm",
  // Climate
  "climate change",
  "global warming",
  "green new deal",
  "fossil fuels",
  "climate denial",
  // Elections
  "election integrity",
  "voter fraud",
  "voter id",
  "mail-in voting",
  "stolen election",
  "january 6",
  "jan 6",
  // Education
  "critical race theory",
  "crt",
  "school choice",
  "book bans",
  // Healthcare
  "vaccine mandate",
  "mask mandate",
  "obamacare",
  "medicare for all",
  // Religion
  "religious freedom",
  "separation of church and state",
] as const;

/**
 * Synonym mappings for common political search terms.
 * Used to expand searches when no results are found.
 * Key is the original term, values are related terms to try.
 */
export const SEARCH_SYNONYMS: Record<string, string[]> = {
  // Firearms
  "gun control": [
    "firearms regulation",
    "second amendment",
    "gun violence prevention",
    "firearm legislation",
  ],
  "gun rights": ["second amendment", "firearms", "gun ownership", "firearm rights"],
  "gun violence": ["mass shooting", "firearm deaths", "gun safety"],
  "assault weapons": ["AR-15", "semiautomatic weapons", "firearms ban"],

  // Climate & Environment
  "climate change": ["climate", "global warming", "environmental policy", "carbon emissions"],
  "global warming": ["climate change", "climate", "greenhouse gases", "carbon"],
  environment: ["climate", "environmental protection", "EPA", "pollution"],
  "green new deal": ["climate policy", "environmental legislation", "clean energy"],

  // Immigration
  immigration: ["border", "migrants", "asylum", "border security", "visa"],
  "border security": ["immigration", "border wall", "CBP", "border patrol"],
  migrants: ["immigrants", "asylum seekers", "refugees", "immigration"],
  asylum: ["refugees", "immigration", "migrants", "border"],
  deportation: ["removal", "immigration enforcement", "ICE"],
  daca: ["dreamers", "deferred action", "immigration"],

  // Healthcare
  healthcare: ["health care", "health insurance", "medical", "ACA"],
  obamacare: ["affordable care act", "ACA", "health insurance", "healthcare"],
  "medicare for all": ["single payer", "universal healthcare", "health insurance"],
  "vaccine mandate": ["vaccination requirement", "immunization", "vaccine policy"],

  // Economy
  inflation: ["prices", "cost of living", "economy", "economic"],
  taxes: ["tax policy", "taxation", "tax reform", "revenue"],
  jobs: ["employment", "unemployment", "workforce", "labor"],
  economy: ["economic policy", "GDP", "fiscal", "financial"],

  // Education
  education: ["schools", "students", "teachers", "learning"],
  "student loans": ["student debt", "college costs", "higher education", "tuition"],
  "critical race theory": ["CRT", "diversity curriculum", "education policy"],

  // Criminal Justice
  "police reform": ["law enforcement", "policing", "criminal justice reform"],
  "criminal justice": ["sentencing", "incarceration", "justice reform", "prisons"],
  "qualified immunity": ["police accountability", "law enforcement", "civil rights"],

  // Foreign Policy
  china: ["Chinese", "Beijing", "US-China", "trade"],
  russia: ["Russian", "Moscow", "Putin", "Ukraine"],
  ukraine: ["Russia", "military aid", "foreign assistance"],
  "foreign aid": ["foreign assistance", "international aid", "USAID"],

  // Social Issues
  abortion: ["reproductive rights", "reproductive health", "Roe", "pregnancy"],
  "reproductive rights": ["abortion", "reproductive health", "family planning"],
  lgbtq: ["LGBT", "gay rights", "same-sex", "transgender"],
  "voting rights": ["elections", "voter access", "ballot", "election security"],

  // Technology
  "big tech": ["technology companies", "social media", "tech regulation", "antitrust"],
  "artificial intelligence": ["AI", "machine learning", "technology", "automation"],
  cybersecurity: ["cyber attacks", "hacking", "data security", "cyber"],
  privacy: ["data privacy", "surveillance", "data protection"],
} as const;

/**
 * Priority order for filter removal when retrying failed searches.
 * Filters are listed from most restrictive (remove first) to least restrictive.
 * Date ranges are most commonly over-restrictive, type is usually helpful to keep.
 */
export const FILTER_REMOVAL_PRIORITY = [
  "from", // Date filters are often too restrictive
  "to",
  "speaker", // Specific speakers may not have spoken on topic
  "committee", // Committee assignments change
  "congress", // Congress number may be wrong
  "chamber", // Chamber filter is moderately restrictive
  "type", // Type filters are usually helpful, remove last
] as const;

/**
 * Check if a query contains sensitive topic keywords.
 * Case-insensitive matching.
 */
export function containsSensitiveTopic(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  return SENSITIVE_TOPICS.some((topic) => lowerQuery.includes(topic));
}

/**
 * Get all sensitive topics found in a query.
 * Useful for logging or adjusting response behavior.
 */
export function detectSensitiveTopics(query: string): string[] {
  const lowerQuery = query.toLowerCase();
  return SENSITIVE_TOPICS.filter((topic) => lowerQuery.includes(topic));
}

/**
 * Get synonym suggestions for terms in a search query.
 * Returns alternative terms that could be used to broaden the search.
 *
 * @param query The search query to find synonyms for
 * @returns Array of synonym suggestions with the original term and alternatives
 */
export function getSynonymsForQuery(query: string): Array<{ term: string; synonyms: string[] }> {
  const lowerQuery = query.toLowerCase();
  const results: Array<{ term: string; synonyms: string[] }> = [];

  for (const [term, synonyms] of Object.entries(SEARCH_SYNONYMS)) {
    if (lowerQuery.includes(term.toLowerCase())) {
      results.push({ term, synonyms: [...synonyms] });
    }
  }

  return results;
}

/**
 * Get the first suggested synonym replacement for a query.
 * Useful for automated retry attempts.
 *
 * @param query The original query
 * @returns A modified query with the first synonym substitution, or null if no synonyms found
 */
export function getFirstSynonymQuery(query: string): string | null {
  const synonymMatches = getSynonymsForQuery(query);

  if (synonymMatches.length === 0 || synonymMatches[0].synonyms.length === 0) {
    return null;
  }

  const firstMatch = synonymMatches[0];
  // Replace the term with the first synonym (case-insensitive)
  const regex = new RegExp(firstMatch.term, "gi");
  return query.replace(regex, firstMatch.synonyms[0]);
}

/**
 * Determine which filter to remove next based on priority order.
 * Returns the filter key that should be removed to broaden the search.
 *
 * @param currentFilters Object containing the current filter values
 * @returns The filter key to remove, or null if no filters remain
 */
export function getNextFilterToRemove(
  currentFilters: Record<string, unknown>
): (typeof FILTER_REMOVAL_PRIORITY)[number] | null {
  for (const filterKey of FILTER_REMOVAL_PRIORITY) {
    if (currentFilters[filterKey] !== undefined && currentFilters[filterKey] !== null) {
      return filterKey;
    }
  }
  return null;
}

/**
 * Get a human-readable description of what a filter removal will do.
 * Used for transparency messages to users.
 */
export function getFilterRemovalDescription(filterKey: string): string {
  const descriptions: Record<string, string> = {
    from: "date range start",
    to: "date range end",
    speaker: "specific speaker",
    committee: "committee",
    congress: "Congress number",
    chamber: "chamber (House/Senate)",
    type: "content type",
  };
  return descriptions[filterKey] || filterKey;
}

/**
 * Analyze search parameters and generate a retry strategy.
 * Returns structured information about how to broaden a failed search.
 */
export function analyzeRetryStrategy(params: OriginalSearchParams["params"]): RetryStrategy {
  const strategy: RetryStrategy = {
    synonymSuggestions: getSynonymsForQuery(params.q),
    filterToRemove: null,
    filterRemovalDescription: null,
    simplifiedQuery: null,
    hasFiltersToRemove: false,
    suggestWebSearch: false,
    retryAttempt: 0,
  };

  // Check for filters that can be removed
  const filterOnlyParams: Record<string, unknown> = { ...params };
  delete filterOnlyParams.q;
  delete filterOnlyParams.enrich;
  delete filterOnlyParams.limit;
  delete filterOnlyParams.offset;

  const nextFilter = getNextFilterToRemove(filterOnlyParams);
  if (nextFilter) {
    strategy.filterToRemove = nextFilter;
    strategy.filterRemovalDescription = getFilterRemovalDescription(nextFilter);
    strategy.hasFiltersToRemove = true;
  }

  // Generate simplified query (remove quotes, special chars)
  const simplified = params.q.replace(/["']/g, "").replace(/\s+/g, " ").trim();
  if (simplified !== params.q) {
    strategy.simplifiedQuery = simplified;
  }

  return strategy;
}

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
{"action":"search","params":{"q":"topic keywords","enrich":true,"exclude_witnesses":true,"from":"2025-01-01","to":"2025-12-31","limit":30}}
\`\`\`

**DEFAULT PARAMS** (always include): \`enrich:true\`, \`exclude_witnesses:true\`, \`from:"2025-01-01"\`, \`to:"2025-12-31"\`, \`limit:30\`

If we don't get atleast 10 results increase the limit to 100 and try again.

### Parameters

| Param | Required | Type | Description |
|-------|----------|------|-------------|
| q | Yes | string | **Concise topic keywords only** (NOT the full user question) |
| enrich | Yes | boolean | Always \`true\` - provides speaker_name, speaker_type, source_url |
| exclude_witnesses | Yes | boolean | Always \`true\` - filters out witness testimony to focus on legislator statements |
| type | No | string | \`hearing\`,\`floor_speech\`,\`vote\` (comma-separated) |
| speaker | No | string | **Legislator name** - fuzzy match, works with "Warren", "Sen. Warren", or "Elizabeth Warren" |
| committee | No | string | Partial name works (e.g., "Judiciary", "Armed Services") |
| chamber | No | string | \`"house"\` or \`"senate"\` (lowercase) |
| congress | No | number | 116, 117, 118, or 119 |
| from/to | No | string | \`YYYY-MM-DD\` or \`YYYY-MM\` (default: from \`2025-01-01\` to \`2025-12-31\`) |
| limit | No | number | 1-100 (default: 30, use higher for people-focused searches) |
| offset | No | number | Pagination offset |
| context | No | number | 1-10: get N segments before/after each match for expanded context (use for follow-up questions) |

### Query Extraction Rules (CRITICAL)

The \`q\` parameter must contain **only the core topic/keywords**, not the full conversational query:

| User Says | q Parameter Should Be | NOT |
|-----------|----------------------|-----|
| "What do senators think about climate change?" | \`"climate change"\` | \`"what do senators think about climate change"\` |
| "I want to reach out about transnational repression" | \`"transnational repression"\` | \`"reaching out about transnational repression"\` |
| "Tell me what Republicans have said about immigration reform" | \`"immigration reform"\` | \`"what republicans said about immigration reform"\` |
| "Can you find hearings on AI regulation?" | \`"AI regulation"\` | \`"hearings on AI regulation"\` |

**Key principle**: Extract the subject matter—not the user's intent, question structure, or conversational framing.

## EXAMPLES

**Note**: All examples below assume the required defaults: \`enrich:true, exclude_witnesses:true, from:"2025-01-01", to:"2025-12-31", limit:30\`

### Topic Searches
| User Query | Key Params (+ defaults) |
|------------|------------|
| "What have senators said about climate change?" | \`q:"climate change", chamber:"senate"\` |
| "Infrastructure hearings in 2023" | \`q:"infrastructure", type:"hearing", from:"2023-01-01", to:"2023-12-31"\` (override date) |
| "Tell me about transnational repression" | \`q:"transnational repression"\` |
| "Votes on the Inflation Reduction Act" | \`q:"Inflation Reduction Act", type:"vote"\` |

### People/Legislator Searches (PRIMARY FOCUS)
| User Query | Key Params (+ defaults) |
|------------|------------|
| "What has Elizabeth Warren said about banking?" | \`q:"banking", speaker:"Warren", limit:40\` |
| "Find legislators who support AI regulation" | \`q:"AI regulation support", type:"floor_speech,hearing", limit:50\` |
| "Who testified about TikTok?" | \`q:"TikTok", type:"hearing", limit:40, exclude_witnesses:false\` (include witnesses) |
| "Representatives speaking on border security" | \`q:"border security", chamber:"house", type:"floor_speech", limit:40\` |
| "What are Ted Cruz's positions?" | \`q:"*", speaker:"Cruz", limit:50\` (broad search for all their statements) |
| "Which senators discussed Ukraine aid?" | \`q:"Ukraine aid", chamber:"senate", limit:40\` |

### Legislator Contact Research
| User Query | Key Params (+ defaults) |
|------------|------------|
| "I want to contact my senator about housing" | \`q:"housing", chamber:"senate", limit:40\` |
| "Legislators I can reach out to about veterans" | \`q:"veterans", type:"floor_speech,hearing", limit:50\` |

## FOLLOW-UP HANDLING

**More context** (words: "more context", "surrounding", "what else", "full statement"): Re-search with \`context:3\` or higher to get surrounding segments
**Refine** (words: "only", "just", "filter", "from those"): Add constraints to previous search
**Expand** (new related topic): Search new topic, results merge
**Analyze** (summarize, compare): Don't search—use existing results

## NO RESULTS STRATEGY

Retry by removing filters in order: speaker → committee → dates → type restriction. Simplify keywords. If still empty, explain and suggest alternatives.

## PEOPLE-FOCUSED SEARCH STRATEGY

When users want to find or contact legislators on an issue:

1. **Use higher limits** (\`limit:40-50\`) to capture more unique speakers
2. **Search floor_speech AND hearing** types for comprehensive coverage
3. **Extract diverse voices** - results include \`speaker_name\` and \`speaker_type\`
4. **Note speaker positions** - summarize what each legislator said/how they voted
5. **Provide contact context** - mention committee assignments and recent activity

### Aggregating People from Results

Search results return individual segments. To find all legislators on a topic:
- Use broad topic query without \`speaker\` filter
- Set high \`limit\` (40-50 results)
- The frontend will aggregate unique speakers from \`speaker_name\` fields
- Results include \`speaker_type\` to distinguish representatives, senators, and witnesses

### Finding Specific Legislators

When user asks about a specific person:
- Use \`speaker\` filter with last name (e.g., \`speaker:"Pelosi"\`)
- Use \`q:"*"\` or broad topic to get range of their statements
- Include multiple \`type\` values for comprehensive view

## RESPONSE GUIDELINES

- Synthesize results naturally; cite speaker, date, type
- **For people queries**: List legislators with their positions and key quotes
- Quote sparingly for impact
- Offer refinements ("Want to see more from a specific legislator?")
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
 * Build a retry prompt when a search returns no results.
 * Uses synonym expansion and priority-based filter removal for smarter retries.
 *
 * @param originalParams The original search parameters that returned no results
 * @param options Optional settings for retry behavior
 * @returns Prompt instructing the AI to retry with broader search
 */
export function buildNoResultsRetryPrompt(
  originalParams: OriginalSearchParams,
  options: RetryPromptOptions = {}
): string {
  const { retryAttempt = 1, removedFilters = [], synonymsTried = false } = options;

  const strategy = analyzeRetryStrategy(originalParams.params);

  // Build the original parameters display
  const paramsList = Object.entries(originalParams.params)
    .filter((entry) => entry[1] !== undefined && entry[1] !== null)
    .map(([k, v]) => `- ${k}: ${v}`)
    .join("\n");

  // Build synonym suggestions section
  let synonymSection = "";
  if (strategy.synonymSuggestions.length > 0 && !synonymsTried) {
    const synonymLines = strategy.synonymSuggestions
      .map(
        (s) =>
          `  - "${s.term}" → try: ${s.synonyms
            .slice(0, 3)
            .map((syn) => `"${syn}"`)
            .join(", ")}`
      )
      .join("\n");
    synonymSection = `
### Synonym Suggestions
Consider rephrasing with these alternative terms:
${synonymLines}
`;
  }

  // Build filter removal guidance section
  let filterSection = "";
  if (strategy.hasFiltersToRemove) {
    const alreadyRemoved =
      removedFilters.length > 0 ? `\nAlready tried removing: ${removedFilters.join(", ")}` : "";

    filterSection = `
### Filter Removal Priority
Remove filters in this order (most to least restrictive):
1. Date range (from/to) - often too narrow for specific topics
2. Speaker - the person may not have spoken on this topic
3. Committee - committee jurisdiction varies
4. Congress number - may span multiple sessions
5. Chamber - try both House and Senate
6. Content type - search all types as last resort
${alreadyRemoved}
**Recommended next removal**: ${strategy.filterRemovalDescription || "No filters to remove"}
`;
  }

  // Build transparency message for user
  const userMessage = buildUserTransparencyMessage(strategy, retryAttempt, removedFilters);

  // Determine if web search should be suggested
  const webSearchFallback =
    retryAttempt >= 3 || (!strategy.hasFiltersToRemove && synonymsTried)
      ? `
### Final Fallback
If the retry still returns no results, inform the user:
"${userMessage}"

Consider suggesting they try a web search for more recent or broader information on this topic.`
      : "";

  return `[NO_RESULTS_RETRY - Attempt ${retryAttempt}]

The previous search returned no results. Original search parameters:
${paramsList}
${synonymSection}${filterSection}
### Retry Instructions
1. ${!synonymsTried && strategy.synonymSuggestions.length > 0 ? "Try synonym substitution first" : "Simplify the query keywords"}
2. ${strategy.filterToRemove ? `Remove the "${strategy.filterRemovalDescription}" filter` : "Broaden to search all content types"}
3. Keep the core intent of the user's question

**IMPORTANT**: In your response, briefly explain to the user what you're broadening:
"${userMessage}"

Output a new search JSON with relaxed parameters.
${webSearchFallback}
[END_NO_RESULTS_RETRY]`;
}

/**
 * Generate a user-facing transparency message explaining what was broadened.
 * Helps users understand why results may differ from their original request.
 */
export function buildUserTransparencyMessage(
  strategy: RetryStrategy,
  retryAttempt: number,
  removedFilters: string[]
): string {
  const parts: string[] = [];

  if (retryAttempt === 1) {
    if (strategy.synonymSuggestions.length > 0) {
      const firstTerm = strategy.synonymSuggestions[0].term;
      const firstSyn = strategy.synonymSuggestions[0].synonyms[0];
      parts.push(`searching for "${firstSyn}" instead of "${firstTerm}"`);
    }
    if (strategy.filterToRemove) {
      parts.push(`removing the ${strategy.filterRemovalDescription} filter`);
    }
  } else if (retryAttempt === 2) {
    if (removedFilters.length > 0) {
      parts.push(`broadening the search by removing ${removedFilters.join(" and ")} filters`);
    } else {
      parts.push("using more general search terms");
    }
  } else {
    parts.push("searching with minimal filters");
    if (strategy.synonymSuggestions.length > 0) {
      parts.push("trying alternative terminology");
    }
  }

  if (parts.length === 0) {
    return "I'm broadening my search to find relevant results.";
  }

  return `I'm ${parts.join(" and ")} to find relevant results.`;
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

/** Retry strategy analysis result */
export interface RetryStrategy {
  /** Synonym suggestions found for query terms */
  synonymSuggestions: Array<{ term: string; synonyms: string[] }>;
  /** Next filter to remove based on priority */
  filterToRemove: (typeof FILTER_REMOVAL_PRIORITY)[number] | null;
  /** Human-readable description of the filter to remove */
  filterRemovalDescription: string | null;
  /** Simplified version of the query (if applicable) */
  simplifiedQuery: string | null;
  /** Whether there are any filters that can be removed */
  hasFiltersToRemove: boolean;
  /** Whether to suggest a web search as fallback */
  suggestWebSearch: boolean;
  /** Current retry attempt number (for tracking) */
  retryAttempt: number;
}

/** Options for building retry prompts */
export interface RetryPromptOptions {
  /** Current retry attempt (1 = first retry, 2 = second retry, etc.) */
  retryAttempt?: number;
  /** Filters that have already been removed in previous attempts */
  removedFilters?: string[];
  /** Whether synonyms have already been tried */
  synonymsTried?: boolean;
}
