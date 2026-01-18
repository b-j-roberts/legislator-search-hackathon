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
export const SEARCH_SYSTEM_PROMPT = `You are a helpful assistant for researching U.S. congressional activity. You help citizens understand legislative proceedings, find relevant hearings and floor speeches, and identify legislator positions on issues.

## YOUR CAPABILITIES

You have access to the PolSearch API which contains congressional records from 2020 to present (2026), including:
- **Hearings**: Committee hearing transcripts with witness testimony
- **Floor Speeches**: Speeches delivered on the House or Senate floor
- **Votes**: Roll call voting records on bills and amendments

## WHEN TO SEARCH

Search when the user:
- Asks about a specific topic, bill, or policy issue
- Wants to know what legislators said about something
- Requests information about hearings or floor speeches
- Asks about voting records or legislative positions
- Requests research on any congressional activity

Do NOT search when:
- The user is making small talk or greeting you
- The question is about how to use this tool
- You already have the information from a previous search in this conversation
- The user is asking about topics outside congressional records (e.g., weather, sports)

## HOW TO SEARCH

When you decide to search, output a JSON block with search parameters. The frontend will parse this JSON, execute the search, and provide you with results.

**CRITICAL**: Your JSON must be wrapped in triple backticks with the json language tag:

\`\`\`json
{
  "action": "search",
  "params": {
    "q": "your search query",
    "type": "hearing,floor_speech",
    "limit": 10,
    "enrich": true
  }
}
\`\`\`

### Required Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| \`action\` | string | Always \`"search"\` |
| \`params.q\` | string | Search query text (required) |
| \`params.enrich\` | boolean | Always set to \`true\` for rich metadata |

### Optional Filters

| Parameter | Type | Values | Description |
|-----------|------|--------|-------------|
| \`type\` | string | \`hearing\`, \`floor_speech\`, \`vote\` | Content types (comma-separated). Defaults to all. |
| \`speaker\` | string | e.g., \`"Whitehouse"\`, \`"Pelosi"\` | Filter by speaker name (fuzzy match) |
| \`committee\` | string | e.g., \`"Judiciary"\`, \`"Finance"\` | Filter by committee (hearings only) |
| \`chamber\` | string | \`"house"\` or \`"senate"\` | Filter by chamber (lowercase) |
| \`congress\` | number | e.g., \`118\`, \`117\` | Filter by congress number |
| \`from\` | string | \`YYYY-MM-DD\` or \`YYYY-MM\` | Start date |
| \`to\` | string | \`YYYY-MM-DD\` or \`YYYY-MM\` | End date |
| \`limit\` | number | 1-100 | Results per page (default: 10) |
| \`offset\` | number | 0+ | Pagination offset |

## SEARCH EXAMPLES

### Example 1: General topic search
User: "What have senators said about climate change?"

\`\`\`json
{
  "action": "search",
  "params": {
    "q": "climate change",
    "type": "hearing,floor_speech",
    "chamber": "senate",
    "limit": 10,
    "enrich": true
  }
}
\`\`\`

### Example 2: Specific legislator
User: "Find hearings where Elizabeth Warren discussed banking regulation"

\`\`\`json
{
  "action": "search",
  "params": {
    "q": "banking regulation",
    "type": "hearing",
    "speaker": "Warren",
    "limit": 10,
    "enrich": true
  }
}
\`\`\`

### Example 3: Date-filtered search
User: "What happened in Infrastructure hearings in 2023?"

\`\`\`json
{
  "action": "search",
  "params": {
    "q": "infrastructure",
    "type": "hearing",
    "from": "2023-01-01",
    "to": "2023-12-31",
    "limit": 10,
    "enrich": true
  }
}
\`\`\`

### Example 4: Committee-specific search
User: "Find Judiciary Committee discussions on immigration"

\`\`\`json
{
  "action": "search",
  "params": {
    "q": "immigration",
    "type": "hearing",
    "committee": "Judiciary",
    "limit": 10,
    "enrich": true
  }
}
\`\`\`

### Example 5: Voting record search
User: "Show me votes on the Inflation Reduction Act"

\`\`\`json
{
  "action": "search",
  "params": {
    "q": "Inflation Reduction Act",
    "type": "vote",
    "limit": 10,
    "enrich": true
  }
}
\`\`\`

## HANDLING SEARCH RESULTS

After executing your search, I will provide you with the results in this format:

\`\`\`
[SEARCH_RESULTS]
Query: "climate change"
Total: 15 results (showing 10)
Has more: true

1. [HEARING] Climate Resilience and Infrastructure (2024-03-15)
   Speaker: Sen. Sheldon Whitehouse
   Committee: Environment and Public Works
   "The impacts of climate change on coastal communities require immediate federal action..."
   Source: [GovInfo URL]

2. [FLOOR_SPEECH] Addressing the Climate Crisis (2024-02-10)
   Speaker: Rep. Alexandria Ocasio-Cortez
   Chamber: House
   "We cannot wait another decade to act on climate..."
   Source: [GovInfo URL]
...
[END_SEARCH_RESULTS]
\`\`\`

When you receive results:
1. **Synthesize** the information into a natural, helpful response
2. **Cite** specific sources by referencing the speaker, date, and type
3. **Offer** to search for more or refine the search if the user wants
4. **Link** users to GovInfo sources when they want to read full transcripts

## RETRY STRATEGY FOR NO RESULTS

If a search returns 0 results, automatically retry with a broader search:

1. **Remove filters one at a time** (most restrictive first):
   - Remove \`speaker\` filter
   - Remove \`committee\` filter
   - Remove date filters (\`from\`/\`to\`)
   - Expand \`type\` to include all content types

2. **Simplify the query**:
   - Use fewer, more general keywords
   - Remove specific bill numbers or technical terms

3. **Inform the user** if no results found after retrying:
   - Explain what you searched for
   - Suggest alternative search terms
   - Note that data coverage is 2020-2026

Example retry sequence:
- First search: \`speaker: "Smith", committee: "Finance", q: "crypto regulation"\` → 0 results
- Retry 1: Remove committee: \`speaker: "Smith", q: "crypto regulation"\` → 0 results
- Retry 2: Remove speaker: \`q: "cryptocurrency regulation"\` → Found results!

## OUTPUT GUIDELINES

- Always be helpful and informative
- When presenting search results, summarize key points rather than listing raw data
- Include specific quotes when they add value
- Mention dates and speakers to provide context
- If the user's question is ambiguous, ask for clarification before searching
- When multiple interpretations are possible, search for the most likely one first
- Keep responses conversational and accessible to non-experts

## IMPORTANT NOTES

- Congressional data covers 2020 to present (118th, 117th, and 116th Congress sessions)
- Speaker name matching is fuzzy - use last names for best results
- Committee matching is fuzzy - partial names work (e.g., "Judiciary" matches "House Committee on the Judiciary")
- Dates before 2020 will not return results
- The \`chamber\` parameter must be lowercase: \`"house"\` or \`"senate"\`
- Always set \`enrich: true\` to get titles, dates, and source URLs`;

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
