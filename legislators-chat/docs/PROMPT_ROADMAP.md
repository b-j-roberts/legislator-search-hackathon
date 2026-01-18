# Prompt Engineering Roadmap

Roadmap for improving LLM prompts across Legislators Chat, broken into Phase 1 (Critical), Phase 2 (Enhancements), and Phase 3 (New Capabilities).

> **Reference:** See `PROMPT_ENGINEERING.md` for detailed prompt inventory, flow diagrams, and engineering goals.

---

## Prompt Initialization

Hey, I am working on prompt engineering for legislators-chat. Let's continue with implementing:
After implementing the prompt changes, please test with sample queries and document any edge cases discovered.

---

# Phase 1: Critical Improvements

Core prompt fixes that directly impact user experience and reliability.

---

### 1.1 Compress Search System Prompt

**Description**: Reduce the Search System prompt from 300+ lines to improve token efficiency and leave room for conversation context.

**Requirements**:
- [ ] Audit current prompt at `lib/prompts/search-system.ts:41-307` for redundancy
- [ ] Convert verbose examples to tabular format
- [ ] Consolidate similar sections (e.g., merge filter explanations)
- [ ] Remove redundant phrasing while preserving clarity
- [ ] Target 30% reduction (~210 lines max)
- [ ] Validate JSON output still works correctly after compression

**Implementation Notes**:
- Use markdown tables instead of prose for parameter documentation
- Keep critical examples, remove variations that demonstrate same concept
- Test with 20+ sample queries to ensure no regression

---

### 1.2 Add Controversy Handling

**Description**: Add guidance for handling politically sensitive topics (abortion, guns, immigration) to ensure nonpartisan responses.

**Requirements**:
- [ ] Create new `## HANDLING SENSITIVE TOPICS` section in search system prompt
- [ ] Define list of sensitive topic keywords to detect
- [ ] Add instructions for presenting multiple perspectives
- [ ] Include examples of neutral language alternatives
- [ ] Add guidance for declining to share personal opinions
- [ ] Test with 10+ controversial topic queries

**Implementation Notes**:
- Reference: `PROMPT_ENGINEERING.md` → Search System Prompt → Engineering Goals
- Topics to cover: abortion, gun control, immigration, LGBTQ+ rights, police reform
- Key principle: present congressional record facts, not editorial stance

**Sample Addition**:
```
## HANDLING SENSITIVE TOPICS
When users ask about controversial issues:
1. Present facts from congressional record without editorial stance
2. Include voices from both parties when available
3. Use neutral descriptors (e.g., "reproductive rights legislation" not "pro-life/pro-choice")
4. If asked your opinion, redirect: "I can show you what legislators have said about this..."
```

---

### 1.3 Improve No Results Retry Strategy

**Description**: Enhance the retry prompt to use synonym expansion and smarter filter removal instead of just dropping filters.

**Requirements**:
- [ ] Update `buildNoResultsRetryPrompt()` at `lib/prompts/search-system.ts:434-449`
- [ ] Add synonym mapping for common political terms
- [ ] Implement priority-based filter removal (date → speaker → committee → type)
- [ ] Add user transparency message explaining what was broadened
- [ ] Include web search suggestion as final fallback
- [ ] Test with 10+ queries that typically return zero results

**Implementation Notes**:
- Common synonyms: "gun control" ↔ "firearms", "climate" ↔ "environment", "immigration" ↔ "border"
- Filter removal priority based on restrictiveness
- Final message should explain what was tried

**Synonym Map Example**:
```typescript
const SEARCH_SYNONYMS: Record<string, string[]> = {
  "gun control": ["firearms", "second amendment", "gun violence"],
  "climate change": ["climate", "environment", "global warming"],
  "immigration": ["border", "migrants", "asylum"],
  // ... more
};
```

---

### 1.4 Simplify Sentiment Scale

**Description**: Replace 0-100 sentiment scale with 5-tier system for more accurate and interpretable results.

**Requirements**:
- [ ] Update sentiment prompt at `lib/sentiment.ts:264-306`
- [ ] Define 5-tier scale: Strong Oppose / Lean Oppose / Neutral / Lean Support / Strong Support
- [ ] Add confidence indicator (High/Medium/Low based on statement count)
- [ ] Update response JSON schema to include tier and confidence
- [ ] Update sentiment UI components to display new format
- [ ] Validate with 20+ speaker samples

**Implementation Notes**:
- Tiers map to score ranges: 0-20, 21-40, 41-60, 61-80, 81-100
- Confidence: High (5+ statements), Medium (2-4), Low (1)
- See `PROMPT_ENGINEERING.md` → Sentiment Analysis → Revised Output Format

**New Output Schema**:
```json
{
  "speaker-id": {
    "score": 75,
    "tier": "lean_support",
    "confidence": "high",
    "basis": { "statements": 4, "votes": 2 }
  }
}
```

---

### 1.5 Add Query Clarification Prompt

**Description**: Create new prompt to handle ambiguous queries before attempting search.

**Requirements**:
- [ ] Create new file `lib/prompts/clarification.ts`
- [ ] Define ambiguity detection patterns (vague topic, missing referent, scope unclear)
- [ ] Create `buildClarificationPrompt()` function
- [ ] Integrate with search orchestration to detect when clarification needed
- [ ] Add UI for displaying clarification questions
- [ ] Test with 15+ ambiguous query examples

**Implementation Notes**:
- Ambiguity types: vague ("taxes"), missing referent ("the bill"), scope ("what do they think")
- Keep clarifying questions brief, offer 2-3 specific options
- See `PROMPT_ENGINEERING.md` → New Prompts Needed → Query Clarification Prompt

**Sample Prompt**:
```
The user's query is ambiguous. Before searching, ask ONE clarifying question.

VAGUE TOPIC: "taxes" → "Are you interested in income taxes, corporate taxes, or a specific tax bill?"
MISSING REFERENT: "the bill" → "Which bill? Any details like topic, number, or sponsor help."
SCOPE: "what do they think" → "Would you like statements from Democrats, Republicans, or both?"
```

---

### 1.6 Ensure Reliable Legislator & Document Retrieval

**Description**: Modify prompts and orchestration to reliably extract legislators and documents from most user queries. This is critical for the core value proposition of the app.

**Requirements**:
- [ ] Add "## SEARCH BIAS" section to search system prompt encouraging search for substantive queries
- [ ] Add instruction to ALWAYS search when topic could have congressional record data
- [ ] Add "## LEGISLATOR EXTRACTION" section requiring AI to list legislators found
- [ ] Update results synthesis prompt to explicitly call out legislators with their full names
- [ ] Add post-search step in orchestration to match speaker_names to legislators.json
- [ ] Integrate `findLegislatorsByName()` from `lib/legislator-lookup.ts` into results processing
- [ ] Return extracted legislators as structured data alongside the response
- [ ] Test with 20+ queries to ensure >85% legislator extraction rate

**Implementation Notes**:
- Current gap: Search returns `speaker_name` but no matching to static legislator data
- `legislator-lookup.ts` has `findLegislatorsByName()` and `enrichLegislatorWithContactData()` ready to use
- Orchestration hook (`use-search-orchestration.tsx`) needs to extract unique speakers and match them
- AI should be instructed to format legislator names consistently (e.g., "Sen. Elizabeth Warren (D-MA)")

**Prompt Addition for Search System**:
```
## SEARCH BIAS

When in doubt, SEARCH. This tool's primary value is connecting users with congressional records.

ALWAYS search when the user:
- Mentions any political topic (healthcare, taxes, immigration, climate, etc.)
- Asks about legislation, bills, or laws
- Mentions any legislator by name
- Asks "what do they think about X" or similar opinion/stance questions
- Uses words like "position", "stance", "voted", "said", "supports", "opposes"

Only skip searching for:
- Pure greetings ("hi", "hello")
- Meta questions about how to use the tool
- Requests to contact a legislator (use existing data)

## LEGISLATOR EXTRACTION

When presenting search results, ALWAYS:
1. List the legislators mentioned by full name with party and state: "Sen. Elizabeth Warren (D-MA)"
2. Group findings by legislator when multiple are found
3. Note if a legislator has taken multiple positions over time
4. Offer to help the user contact any legislator mentioned
```

**Orchestration Enhancement**:
```typescript
// After search results received, extract legislators:
const extractLegislatorsFromResults = (results: SearchResult[]): Legislator[] => {
  const speakerNames = [...new Set(results.map(r => r.speaker_name).filter(Boolean))];
  return speakerNames
    .map(name => findBestMatchingLegislator(name))
    .filter((l): l is Legislator => l !== undefined)
    .map(enrichLegislatorWithContactData);
};

// Return in OrchestrationResult:
return {
  content: lastResponse,
  searchResults,
  searchQuery,
  searchPerformed: true,
  legislators: extractLegislatorsFromResults(searchResults), // NEW
  error: null,
};
```

**UI Integration**:
- Display extracted legislators in a sidebar/panel
- Show "Contact" button for each legislator found
- Allow clicking legislator to navigate to contact flow with pre-filled context

---

### 1.7 Add Search Trigger Keywords

**Description**: Create explicit keyword detection to ensure searches are triggered for common political queries.

**Requirements**:
- [ ] Create `lib/prompts/search-triggers.ts` with keyword lists
- [ ] Define categories: legislators, topics, actions, document types
- [ ] Add pre-prompt check that flags queries likely needing search
- [ ] Inject "This query likely needs a search" hint into system prompt when detected
- [ ] Test keyword coverage with 50+ sample queries

**Implementation Notes**:
- Keywords should cover common variations (e.g., "senator", "sen.", "Sen")
- Topic keywords: healthcare, abortion, guns, immigration, climate, taxes, budget, military, education
- Action keywords: voted, said, testified, sponsored, opposed, supported, cosponsored
- Combine with query intent detection in `lib/query-intent.ts`

**Keyword Categories**:
```typescript
const SEARCH_TRIGGER_KEYWORDS = {
  legislators: [
    /\b(senator|sen\.?|representative|rep\.?|congressman|congresswoman)\b/i,
    /\b(pelosi|schumer|mcconnell|warren|sanders|ocasio-cortez|cruz|hawley)\b/i,
  ],
  topics: [
    /\b(healthcare|abortion|gun|immigration|climate|tax|budget|military|education)\b/i,
    /\b(bill|legislation|act|amendment|resolution|vote|hearing)\b/i,
  ],
  actions: [
    /\b(voted?|said|testified|sponsored|opposed|supported|cosponsored|introduced)\b/i,
    /\b(position|stance|view|opinion|record)\b/i,
  ],
  questions: [
    /\b(what|who|how|when|where|which)\b.*\b(think|say|vote|support|oppose)\b/i,
  ],
};
```

---

# Phase 2: Feature Enhancements

Improvements to existing prompts for better output quality.

---

### 2.1 Add Call Script Purpose Variants

**Description**: Create different call script structures based on call purpose (thanking, persuading, informing).

**Requirements**:
- [ ] Update `buildCallScriptUserPrompt()` at `lib/prompt-builder.ts:154-221`
- [ ] Add `purpose` parameter: "thank" | "persuade" | "inform"
- [ ] Create distinct structures for each purpose type
- [ ] Update UI to allow purpose selection
- [ ] Add staffer engagement tips section
- [ ] Test each variant with 5+ scenarios

**Implementation Notes**:
- Thank: Lead with appreciation, reference specific vote
- Persuade: Constituent status first, strongest argument, clear ask
- Inform: Ask about position, request information, follow-up ready
- See `PROMPT_ENGINEERING.md` → Call Script Generation → New Prompt Additions

---

### 2.2 Improve Email Subject Lines

**Description**: Generate more effective email subject lines using action-oriented, specific formats.

**Requirements**:
- [ ] Update email draft prompt at `lib/prompt-builder.ts:233-302`
- [ ] Add subject line best practices section
- [ ] Include location/district in subject options
- [ ] Reference specific bill numbers when available
- [ ] Add A/B variant generation (3 options with different approaches)
- [ ] Test open-rate optimization patterns

**Implementation Notes**:
- Pattern: "[Location] Constituent: [Topic/Bill]"
- Avoid generic: "Concerns About Climate Legislation"
- Prefer specific: "Austin Constituent: HR 1234 Vote Request"

**Subject Line Templates**:
```
- "[City] Constituent: [Bill Number] Vote Request"
- "[Issue] Impact on [District] - Request for Action"
- "Thank You for Your [YES/NO] Vote on [Bill]"
```

---

### 2.3 Add Primary Source Citations

**Description**: Improve citations in generated content to link directly to GovInfo sources.

**Requirements**:
- [ ] Update content generation prompts to emphasize citation format
- [ ] Include GovInfo URL in citation output
- [ ] Add citation count requirement (minimum 2 for emails)
- [ ] Format citations consistently across call scripts and emails
- [ ] Validate URLs are properly formatted

**Implementation Notes**:
- Citations should include: text, source name, date, URL
- GovInfo base URL: `https://www.govinfo.gov/`
- Consider separate citations section vs. inline

---

### 2.4 Extend Refinement Context Window

**Description**: Increase context available during content refinement from 4 messages to full advocacy context.

**Requirements**:
- [ ] Update refinement prompts at `app/api/refine-content/route.ts`
- [ ] Preserve full `advocacyContext` through refinement cycles
- [ ] Identify and protect user-edited sections
- [ ] Add common refinement shortcut recognition ("make shorter", "add data")
- [ ] Implement before/after diff in explanation

**Implementation Notes**:
- Current limit: 4 messages - may lose important context
- Key context to preserve: topic, position, personal story, specific ask
- Shortcut patterns: "shorter", "longer", "more formal", "add statistics"

---

### 2.5 Add Results Relevance Indicators

**Description**: Enhance search results formatting to indicate relevance and group by theme.

**Requirements**:
- [ ] Update `buildSearchResultsPrompt()` at `lib/prompts/search-system.ts:388-426`
- [ ] Add "Most Relevant" section for top 3 results
- [ ] Highlight matched query terms in snippets (using **bold**)
- [ ] Group related results by theme when applicable
- [ ] Add source credibility notes (testimony vs. floor remarks)
- [ ] Improve pagination guidance

**Implementation Notes**:
- Relevance based on: direct keyword match, speaker prominence, recency
- Grouping themes: same bill, same speaker, same committee
- See `PROMPT_ENGINEERING.md` → Search Results Formatter → Target Output Format

---

### 2.6 Add Current Date Context

**Description**: Inject current date into prompts for proper handling of "recent" and "latest" queries.

**Requirements**:
- [ ] Add date injection to `buildSearchSystemPrompt()`
- [ ] Define "recent" as last 6 months by default
- [ ] Note data coverage period (2020-present)
- [ ] Suggest web search for events after data cutoff
- [ ] Handle relative time queries ("last month", "this year")

**Implementation Notes**:
- Format: "Today is January 18, 2026"
- Data cutoff awareness prevents confusion
- Relative dates need calculation before search

---

# Phase 3: New Capabilities

New prompts that add significant functionality.

---

### 3.1 Web Search Integration Prompt

**Description**: Create fallback prompt for searching web when PoliSearch lacks data.

**Requirements**:
- [ ] Create new file `lib/prompts/web-search.ts`
- [ ] Define trigger conditions (recent events, no results, explicit request)
- [ ] Create `buildWebSearchPrompt()` function
- [ ] Add source credibility notes for web results
- [ ] Integrate with search orchestration as fallback
- [ ] Test with current events queries

**Implementation Notes**:
- Trigger: events in last 30 days, zero results after retry, "news" keyword
- Note that web sources are not official congressional records
- Offer to search congressional records for related historical context

---

### 3.2 Comparative Analysis Prompt

**Description**: Handle "compare X and Y" queries with structured side-by-side output.

**Requirements**:
- [ ] Create new file `lib/prompts/comparative.ts`
- [ ] Support comparison types: legislator vs. legislator, bill vs. bill, before vs. after
- [ ] Create `buildComparativePrompt()` function
- [ ] Generate parallel search requests
- [ ] Format output as comparison table
- [ ] Test with 10+ comparison queries

**Implementation Notes**:
- Detect: "compare", "difference between", "X vs Y", "X and Y on [topic]"
- Output format: markdown table with aspects as rows
- May require multiple sequential searches

**Output Format**:
```markdown
| Aspect | Sen. Warren | Sen. Cruz |
|--------|-------------|-----------|
| Position | Supports | Opposes |
| Key Vote | YES on HR1234 | NO on HR1234 |
| Statement | "..." | "..." |
```

---

### 3.3 Legislator Profile Prompt

**Description**: Generate comprehensive profiles when user focuses on single legislator.

**Requirements**:
- [ ] Create new file `lib/prompts/legislator-profile.ts`
- [ ] Define profile sections: basic info, recent activity, key positions, contact
- [ ] Create `buildLegislatorProfilePrompt()` function
- [ ] Integrate with PoliSearch API for activity data
- [ ] Add constituent relevance (district overlap if location known)
- [ ] Test with 10+ legislators

**Implementation Notes**:
- Trigger: "Tell me about Senator X", profile page navigation
- Sections: basic → activity → positions → contact
- Consider caching for frequently requested legislators

---

### 3.4 Follow-up Suggestion Prompt

**Description**: Generate contextual follow-up questions after search results.

**Requirements**:
- [ ] Create new file `lib/prompts/follow-up.ts`
- [ ] Define follow-up types: dive deeper, related search, action prompt, comparison
- [ ] Create `buildFollowUpSuggestionsPrompt()` function
- [ ] Generate 2-3 suggestions based on result content
- [ ] Format as clickable UI elements
- [ ] Test suggestion quality across result types

**Implementation Notes**:
- Types: "See full statement?", "Related topic found", "Draft message to [legislator]?"
- Base suggestions on: results shown, original question, logical next steps
- See `PROMPT_ENGINEERING.md` → New Prompts Needed → Follow-up Suggestion Prompt

---

### 3.5 Multi-Query Comparison Handler

**Description**: Handle complex queries that require multiple parallel searches.

**Requirements**:
- [ ] Detect multi-entity queries ("what do Democrats and Republicans say about...")
- [ ] Split into parallel search requests
- [ ] Merge and synthesize results
- [ ] Present balanced comparison
- [ ] Handle partial failures gracefully

**Implementation Notes**:
- Detection patterns: "both parties", "X and Y", "compare"
- Execute searches in parallel for performance
- Synthesis should note when one side has more data

---

### 3.6 Session Context Summarization

**Description**: Summarize long conversations to maintain context within token limits.

**Requirements**:
- [ ] Detect when conversation exceeds token threshold
- [ ] Create summarization prompt for conversation history
- [ ] Preserve key facts: topic, legislators discussed, user position
- [ ] Inject summary as context for new queries
- [ ] Test with long multi-turn conversations

**Implementation Notes**:
- Trigger: conversation > N messages or > X tokens
- Summary should capture: main topic, key findings, user intent
- Replace old messages with summary block

---

# Phase 4: Optimization & Testing

Infrastructure for prompt quality and performance.

---

### 4.1 Prompt Versioning System

**Description**: Implement versioning for A/B testing prompt changes.

**Requirements**:
- [ ] Create `/lib/prompts/v2/` directory structure
- [ ] Add version parameter to prompt builder functions
- [ ] Implement A/B routing logic
- [ ] Log prompt version with each request
- [ ] Create comparison metrics dashboard

**Implementation Notes**:
- Start with search system prompt (highest impact)
- Track: search success rate, zero-result rate, user satisfaction
- Gradual rollout: 10% → 50% → 100%

---

### 4.2 Prompt Test Suite

**Description**: Create automated test suite for prompt quality validation.

**Requirements**:
- [ ] Define test cases per prompt (see `PROMPT_ENGINEERING.md` → Testing & Validation)
- [ ] Create test harness for running prompts against test inputs
- [ ] Validate JSON output structure
- [ ] Check for regression on key behaviors
- [ ] Integrate with CI/CD pipeline

**Test Cases**:
- Search: greeting (no search), topic (search), follow-up (context)
- Content: each tone option, aligned vs. opposed legislator
- Sentiment: clear supporter, clear opponent, mixed signals

---

### 4.3 Token Usage Monitoring

**Description**: Track and optimize token consumption across prompts.

**Requirements**:
- [ ] Log token counts per prompt type
- [ ] Identify highest token consumers
- [ ] Set token budget targets (system prompts < 4000)
- [ ] Alert on budget exceeded
- [ ] Create optimization recommendations

**Implementation Notes**:
- Target: leave 50%+ context window for conversation
- Monitor: input tokens, output tokens, total per request
- Optimize: compression, dynamic section loading

---

### 4.4 Temperature Tuning Validation

**Description**: Validate and optimize temperature settings for each prompt type.

**Requirements**:
- [ ] Document current temperature settings per endpoint
- [ ] Run consistency tests at different temperatures
- [ ] Measure JSON parse success rate vs. temperature
- [ ] Measure output quality/creativity vs. temperature
- [ ] Update settings based on findings

**Current Settings**:
| Prompt Type | Current Temp | Target |
|-------------|--------------|--------|
| Search decisions | 0.7 | 0.3 (more consistent) |
| Results synthesis | 0.7 | 0.7 (keep) |
| Content generation | 0.7 | 0.7 (keep) |
| Sentiment analysis | 0.3 | 0.1 (more consistent) |

---

## Success Metrics

| Metric | Current | Target | Measurement |
|--------|---------|--------|-------------|
| Search success rate | Unknown | >85% | Results returned / searches |
| Zero-result recovery | Unknown | >50% | Successful retry / zero-results |
| JSON parse success | ~95% | >99% | Valid JSON / generations |
| Content regeneration | Unknown | <20% | Refinements / initial gens |
| Sentiment accuracy | Unknown | >80% | Manual validation sample |
| Token efficiency | Unknown | <4000 | System prompt tokens |

---

## Dependencies

- Phase 1.4 (Sentiment) requires UI updates in sentiment display components
- Phase 2.1 (Call Variants) requires UI for purpose selection
- Phase 3.1 (Web Search) requires web search API integration
- Phase 4.1 (Versioning) should complete before major prompt changes for A/B testing
