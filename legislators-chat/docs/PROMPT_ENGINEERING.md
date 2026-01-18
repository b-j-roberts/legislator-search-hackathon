# Prompt Engineering Guide

## Executive Summary

This document catalogs all LLM prompts in the Legislators Chat app and defines engineering goals for each. The system currently has **15 distinct prompts** across **6 functional areas**.

---

## Prompt Inventory

| # | Prompt | Location | Feature | Phase |
|---|--------|----------|---------|-------|
| 1 | Search System | `lib/prompts/search-system.ts:41-307` | Main Chat | System |
| 2 | Search System Builder | `lib/prompts/search-system.ts:338-379` | Main Chat | Dynamic |
| 3 | Search Results Formatter | `lib/prompts/search-system.ts:388-426` | Main Chat | Phase 2 |
| 4 | No Results Retry | `lib/prompts/search-system.ts:434-449` | Main Chat | Fallback |
| 5 | Basic Chat System | `app/api/chat/route.ts:11-20` | General Q&A | System |
| 6 | Orchestrated Chat System | `app/api/chat/orchestrated/route.ts:17-27` | Multi-step | System |
| 7 | Call Script System | `lib/prompt-builder.ts:106-114` | Contact Page | System |
| 8 | Call Script User | `lib/prompt-builder.ts:154-221` | Contact Page | User |
| 9 | Email Draft System | `lib/prompt-builder.ts:116-124` | Contact Page | System |
| 10 | Email Draft User | `lib/prompt-builder.ts:233-302` | Contact Page | User |
| 11 | Refinement System | `app/api/refine-content/route.ts:40-52` | Contact Page | System |
| 12 | Call Script Refinement | `app/api/refine-content/route.ts:57-116` | Contact Page | User |
| 13 | Email Draft Refinement | `app/api/refine-content/route.ts:121-180` | Contact Page | User |
| 14 | Sentiment System | `app/api/sentiment/route.ts:64-65` | Results Analysis | System |
| 15 | Sentiment Analysis | `lib/sentiment.ts:264-306` | Results Analysis | User |

---

## Feature Areas & Prompt Flows

### 1. Main Search Chat (Multi-Phase)

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Intent & Search Decision                               │
│ ─────────────────────────────────────────────────────────────── │
│ Prompt: Search System (#1)                                      │
│ Input: User query + active filters + conversation history       │
│ Output: Either conversational response OR search JSON block     │
│ Decision: Should we search? What parameters?                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                   [If search JSON detected]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Results Synthesis                                      │
│ ─────────────────────────────────────────────────────────────── │
│ Prompt: Search Results Formatter (#3)                           │
│ Input: PoliSearch API results + original query + metadata       │
│ Output: Synthesized natural language response                   │
│ Goal: Summarize, cite sources, offer follow-ups                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                   [If zero results]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 3: Retry Strategy (Optional)                              │
│ ─────────────────────────────────────────────────────────────── │
│ Prompt: No Results Retry (#4)                                   │
│ Input: Original search params that yielded 0 results            │
│ Output: New search JSON with relaxed parameters                 │
│ Goal: Broaden search intelligently                              │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Contact Page: Content Generation (Two-Phase)

```
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 1: Generate Initial Draft                                 │
│ ─────────────────────────────────────────────────────────────── │
│ Prompts: Call Script System (#7) + User (#8)                    │
│          OR Email Draft System (#9) + User (#10)                │
│ Input: Legislator data, advocacy context, tone preference       │
│ Output: Structured JSON (talking points, anticipated Q&A, etc.) │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                   [User requests changes]
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ PHASE 2: Iterative Refinement (Repeatable)                      │
│ ─────────────────────────────────────────────────────────────── │
│ Prompts: Refinement System (#11) + Content-specific (#12/#13)   │
│ Input: Current content + refinement request + last 4 messages   │
│ Output: Updated content + explanation + change summary          │
│ Preserves: Chat history for context, unchanged elements         │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Sentiment Analysis (Single-Phase)

```
┌─────────────────────────────────────────────────────────────────┐
│ Sentiment Scoring                                               │
│ ─────────────────────────────────────────────────────────────── │
│ Prompts: Sentiment System (#14) + Analysis (#15)                │
│ Input: Topic + speaker statements (max 5 per speaker)           │
│ Output: JSON map of speaker IDs → sentiment scores (0-100)      │
│ Config: temp=0.3, max_tokens=1000, 3 retries w/ backoff         │
└─────────────────────────────────────────────────────────────────┘
```

---

## Engineering Goals by Prompt

### 1. Search System Prompt (CRITICAL - Primary User Experience)

**Current Issues:**
- Prompt is 300+ lines - may hit context limits inefficiently
- No example of multi-turn refinement conversations
- Limited guidance on controversial/sensitive topics
- No web search integration for current events

**Engineering Goals:**
| Goal | Priority | Description |
|------|----------|-------------|
| Reduce token footprint | High | Compress examples, use tabular format more |
| Add controversy handling | High | Guide nonpartisan responses on hot-button issues |
| Add recency awareness | High | Inject "today's date is X" for current context |
| Web search fallback | Medium | When PoliSearch lacks data, suggest web search |
| Multi-query support | Medium | Handle "compare X and Y" with parallel searches |
| Citation format standardization | Medium | Consistent `[Speaker, Date, Type]` format |

**New Prompt Sections Needed:**
```
## HANDLING SENSITIVE TOPICS
When users ask about controversial issues (abortion, guns, immigration):
1. Present facts from congressional record without editorial stance
2. Include voices from both parties when available
3. Avoid loaded language - use neutral descriptors
4. If asked your opinion, redirect to legislator positions

## CURRENT DATE CONTEXT
Today is [DATE]. When users ask about "recent" or "latest":
- Prioritize results from the last 6 months
- If no recent results, note the most recent available date
- For events after [DATA_CUTOFF], suggest web search
```

---

### 2. Search Results Formatter (Phase 2)

**Current Issues:**
- All results treated equally regardless of relevance
- No confidence scoring for matches
- Snippet length inconsistent
- Missing context about why result matched

**Engineering Goals:**
| Goal | Priority | Description |
|------|----------|-------------|
| Add relevance indicators | High | Mark top results as "most relevant" |
| Highlight matched terms | High | Bold the query terms in snippets |
| Group by theme | Medium | Cluster related results together |
| Source credibility notes | Medium | Distinguish official testimony vs. floor remarks |
| Pagination guidance | Low | Better "would you like more results" UX |

**Target Output Format:**
```
I found 15 results about climate legislation. Here are the most relevant:

**Most Relevant:**
1. [HEARING] Sen. Whitehouse on Climate Adaptation (Jan 2024)
   > "The cost of inaction on **climate change** exceeds $2 trillion..."
   [Environment Committee | Full transcript →]

2. [FLOOR_SPEECH] Rep. Ocasio-Cortez on Green New Deal (Dec 2023)
   > "We must treat **climate** as the emergency it is..."
   [House Floor | Full transcript →]

**Also Mentioned:**
3-5. [Brief list with less detail]

Want me to focus on a specific legislator or time period?
```

---

### 3. No Results Retry Prompt

**Current Issues:**
- Only removes filters - doesn't try synonym expansion
- No feedback to user about what was tried
- Limited intelligence about which filter to drop

**Engineering Goals:**
| Goal | Priority | Description |
|------|----------|-------------|
| Synonym expansion | High | "gun control" → also try "firearms regulation", "2nd amendment" |
| Smart filter removal | High | Drop least essential filter first (date > committee > speaker) |
| User transparency | Medium | Tell user "I broadened your search by..." |
| Web search suggestion | Medium | Offer to search web if data might exist elsewhere |

**Enhanced Prompt Logic:**
```
The previous search for "[query]" with filters [list] returned no results.

RETRY STRATEGY (try in order):
1. Expand keywords: Add synonyms/related terms
   Original: "gun control" → Try: "gun control OR firearms OR second amendment"

2. Remove filters (priority order):
   - Date range (most restrictive)
   - Speaker name
   - Committee
   - Content type
   - Chamber

3. Broaden content types: If searching only hearings, add floor_speech

After each retry attempt, note what you changed so the user understands.
```

---

### 4. Call Script Generation

**Current Issues:**
- No A/B testing of different script structures
- Anticipated Q&A limited to 1-2 items
- No awareness of recent news about legislator
- Doesn't adapt to call purpose (thanking vs. persuading vs. informing)

**Engineering Goals:**
| Goal | Priority | Description |
|------|----------|-------------|
| Call purpose variants | High | Different structures for thank you / persuade / inform |
| More anticipated Q&A | High | 3-5 realistic staff questions |
| Current events context | Medium | Reference recent votes/statements |
| Staffer psychology | Medium | Tips for engaging with busy staff |
| Local impact framing | Medium | Connect to constituent's specific district |
| Timing suggestions | Low | Best times to call, session awareness |

**New Prompt Additions:**
```
## CALL PURPOSE
Determine the primary purpose and adjust structure:

1. THANK YOU CALL
   - Lead with appreciation
   - Reference specific vote/action
   - Encourage continued support

2. PERSUASION CALL
   - Lead with constituent status
   - Present strongest argument first
   - Address likely counter-arguments
   - Clear specific ask

3. INFORMATION CALL
   - Ask about legislator's position
   - Request specific information
   - Follow-up question ready

## STAFFER ENGAGEMENT TIPS
- Staffers track constituent calls by topic
- Mentioning specific bill numbers gets logged
- Being polite but persistent is most effective
- Ask for the staffer's name for follow-up
```

---

### 5. Email Draft Generation

**Current Issues:**
- Subject lines generic
- No awareness of legislator's communication preferences
- Citations don't link to primary sources effectively
- Body paragraphs can be repetitive

**Engineering Goals:**
| Goal | Priority | Description |
|------|----------|-------------|
| Subject line optimization | High | A/B test data on open rates (shorter, action-oriented) |
| Legislator-specific tone | High | Match formality to representative's style |
| Primary source citations | High | Direct GovInfo links in citations |
| Paragraph distinctiveness | Medium | Each para should serve different purpose |
| Follow-up mention | Medium | Note intent to follow up for accountability |
| Social proof | Low | "Join X other constituents who..." |

**Enhanced Subject Line Examples:**
```
Instead of: "Concerns About Climate Legislation"
Try:
- "[Your City] Constituent: HR 1234 Vote Request"
- "Flood damage in [District] - Climate Action Needed"
- "Thank you for your YES vote on [Bill]"
```

---

### 6. Content Refinement Prompts

**Current Issues:**
- Only last 4 messages for context (may lose important earlier context)
- No learning from common refinement patterns
- Explanation of changes could be more specific

**Engineering Goals:**
| Goal | Priority | Description |
|------|----------|-------------|
| Extended context window | High | Keep full advocacy context + key messages |
| Common refinement shortcuts | Medium | Recognize "make shorter" "add data" patterns |
| Before/after diff | Medium | Show exactly what changed |
| Preserve user additions | Medium | Detect and protect user-edited sections |
| Style consistency | Low | Maintain tone across refinements |

---

### 7. Sentiment Analysis

**Current Issues:**
- 0-100 scale may be too granular for accuracy
- No confidence intervals
- Doesn't distinguish between stated position and voting record
- No explanation of score derivation

**Engineering Goals:**
| Goal | Priority | Description |
|------|----------|-------------|
| Simplify to 5-tier scale | High | Strong Oppose / Lean Oppose / Neutral / Lean Support / Strong Support |
| Add confidence indicator | High | High/Medium/Low based on statement volume |
| Statement vs Vote weight | Medium | Weight votes higher than statements |
| Explain scoring | Medium | "Based on 3 statements and 1 vote..." |
| Trend detection | Medium | "Position has shifted from X to Y since..." |
| Party comparison | Low | Show vs. party average for context |

**Revised Output Format:**
```json
{
  "john-doe": {
    "score": 75,
    "tier": "lean_support",
    "confidence": "high",
    "basis": {
      "statements": 4,
      "votes": 2
    },
    "summary": "Generally supportive based on floor speeches, voted YES on HR1234"
  }
}
```

---

## New Prompts Needed

### A. Web Search Integration Prompt (NEW)

**Purpose:** When PoliSearch lacks data or user needs current events context

**Trigger Conditions:**
- Query about events after data cutoff
- No PoliSearch results after retry
- Explicit request for "news" or "recent"

**Proposed System Prompt:**
```
You have access to web search for finding current news and updates about legislators
and legislation that may not be in the congressional record database.

Use web search when:
- User asks about very recent events (last 30 days)
- Congressional record search returns no results
- User explicitly asks for news/updates
- Topic involves ongoing legislation not yet in record

When presenting web search results:
- Cite source name and publication date
- Note that web sources are not official congressional records
- Offer to search congressional records for related historical context
```

---

### B. Query Clarification Prompt (NEW)

**Purpose:** Handle ambiguous queries before searching

**Trigger Conditions:**
- Query too vague: "What about taxes?"
- Multiple interpretations: "Tell me about the bill"
- Missing context: "What did she say?"

**Proposed Prompt:**
```
The user's query is ambiguous. Before searching, ask ONE clarifying question.

Ambiguity types:
1. VAGUE TOPIC: "taxes" → Ask: "Are you interested in income taxes, corporate taxes,
   or a specific tax bill?"

2. MISSING REFERENT: "the bill" → Ask: "Which bill would you like me to search for?
   If you remember any details (topic, number, sponsor), that helps."

3. TIME AMBIGUITY: "recently" → Assume last 6 months, but offer to adjust

4. SCOPE AMBIGUITY: "what do they think" → Ask: "Would you like me to search for
   statements from Democrats, Republicans, or both?"

Keep clarifying questions brief and offer 2-3 specific options when possible.
```

---

### C. Comparative Analysis Prompt (NEW)

**Purpose:** Handle "compare X and Y" or "what's the difference" queries

**Proposed Prompt:**
```
The user wants to compare multiple items (legislators, bills, positions).

Comparison types:
1. LEGISLATOR vs LEGISLATOR: Compare voting records and statements on same issue
   - Search both legislators separately
   - Present side-by-side voting history
   - Note agreements and disagreements

2. BILL vs BILL: Compare provisions and sponsor positions
   - Search each bill
   - Highlight key differences
   - Note party line positions

3. BEFORE vs AFTER: Compare position changes over time
   - Search with different date ranges
   - Note evolution of stance
   - Link to specific events that may explain shift

Output format:
| Aspect | [Legislator A] | [Legislator B] |
|--------|----------------|----------------|
| Position | ... | ... |
| Key Vote | ... | ... |
| Recent Statement | ... | ... |
```

---

### D. Legislator Profile Prompt (NEW)

**Purpose:** Comprehensive legislator lookup when user focuses on one person

**Trigger:** User asks "Tell me about Senator X" or navigates to legislator profile

**Proposed Prompt:**
```
Generate a comprehensive profile for [LEGISLATOR].

Sections to include:
1. BASIC INFO: Party, state, chamber, years in office, committees
2. RECENT ACTIVITY: Last 5 notable votes, recent floor speeches
3. KEY POSITIONS: Stance on major issues (from voting + statements)
4. CONTACT INFO: Office addresses, phone numbers, social media
5. CONSTITUENT RELEVANCE: If user location known, note district overlap

Data sources to query:
- PoliSearch API for congressional record
- ProPublica or similar for voting record
- Official .gov sites for contact info

Present as scannable sections with option to dive deeper.
```

---

### E. Follow-up Suggestion Prompt (NEW)

**Purpose:** Generate contextual follow-up questions after search results

**Proposed Prompt:**
```
Based on the search results just presented, suggest 2-3 natural follow-up questions.

Follow-up types:
1. DIVE DEEPER: "Would you like to see [specific legislator]'s full statement?"
2. RELATED SEARCH: "I also found activity on [related topic] - interested?"
3. ACTION PROMPT: "Would you like help drafting a message to [legislator]?"
4. TIME EXPANSION: "Want to see how this evolved since [earlier date]?"
5. COMPARISON: "Want to compare this with [opposing party/different legislator]?"

Select follow-ups based on:
- What results were shown
- What the original question was
- What logical next steps a researcher would take

Format as clickable suggestions in the UI.
```

---

## Conditional Prompt Selection Matrix

| User Intent | Active Filters | Results Count | Primary Prompt | Secondary Prompts |
|-------------|----------------|---------------|----------------|-------------------|
| New search | None | N/A | Search System | → Results Formatter |
| New search | Party/State/Chamber | N/A | Search System + Filter Context | → Results Formatter |
| Refinement | Existing | Has results | Search System + Results Context | → Results Formatter |
| No results | Any | 0 | No Results Retry | → Web Search (if still 0) |
| Comparison | N/A | N/A | Comparative Analysis | → Results Formatter x2 |
| Legislator focus | N/A | N/A | Legislator Profile | → Results Formatter |
| Vague query | N/A | N/A | Query Clarification | → (wait for response) |
| Generate call | N/A | N/A | Call Script System + User | → Refinement (if edited) |
| Generate email | N/A | N/A | Email Draft System + User | → Refinement (if edited) |
| Sentiment request | N/A | Has speakers | Sentiment Analysis | None |
| Current events | N/A | N/A | Web Search Integration | → Results Formatter |

---

## Parameter Tuning Recommendations

| Prompt Type | Temperature | Max Tokens | Reasoning |
|-------------|-------------|------------|-----------|
| Search decisions | 0.3 | 500 | Consistent JSON output |
| Results synthesis | 0.7 | 2000 | Natural, varied language |
| Content generation | 0.7 | 1500 | Creative but structured |
| Content refinement | 0.5 | 1500 | Preserve original voice |
| Sentiment analysis | 0.1 | 500 | Highly consistent scoring |
| Clarification | 0.6 | 300 | Natural but focused |
| Web search synthesis | 0.7 | 2000 | Integrate diverse sources |

---

## Testing & Validation Strategy

### Test Cases per Prompt

**Search System:**
1. Simple topic query → Should search
2. Greeting → Should NOT search
3. Follow-up question → Should use context
4. Multi-filter query → Should combine filters correctly
5. Controversial topic → Should be nonpartisan
6. Ambiguous query → Should clarify

**Content Generation:**
1. Aligned legislator → Appropriate thankful tone
2. Opposed legislator → Persuasive approach
3. Unknown position → Information-seeking approach
4. Each tone option → Matches description
5. Empty fields → Graceful handling

**Sentiment:**
1. Clear supporter → Score 80-100
2. Clear opponent → Score 0-20
3. Mixed signals → Score 40-60
4. Limited data → Low confidence flag
5. Partisan topic → Both sides analyzed fairly

---

## Implementation Priority

### Phase 1: Critical Improvements
1. [ ] Reduce Search System prompt size (30% compression target)
2. [ ] Add controversy handling section
3. [ ] Implement 5-tier sentiment scale
4. [ ] Add Query Clarification prompt
5. [ ] Improve No Results Retry with synonyms

### Phase 2: Feature Enhancements
1. [ ] Web Search Integration prompt
2. [ ] Comparative Analysis prompt
3. [ ] Enhanced subject line generation
4. [ ] Call purpose variants
5. [ ] Extended refinement context

### Phase 3: Polish & Optimization
1. [ ] Follow-up Suggestion prompt
2. [ ] Legislator Profile prompt
3. [ ] A/B testing framework
4. [ ] Temperature tuning validation
5. [ ] Token usage optimization

---

## Metrics to Track

| Metric | Target | Measurement |
|--------|--------|-------------|
| Search success rate | >85% | Results returned / searches attempted |
| Zero-result recovery | >50% | Successful retry / zero-result attempts |
| JSON parse success | >99% | Valid JSON / total generations |
| Content regeneration rate | <20% | Refinements needed / initial generations |
| Sentiment accuracy | >80% | Manual validation sample |
| User satisfaction | >4/5 | Post-interaction survey |

---

## Notes for Implementation

1. **Prompt Versioning:** Create `/lib/prompts/v2/` for new prompts, A/B test against v1
2. **Context Injection:** Use `buildSearchSystemPrompt()` pattern for all dynamic prompts
3. **Fallback Chain:** Always have graceful degradation (retry → web → apologize)
4. **Token Budget:** Target <4000 tokens for system prompts to leave room for context
5. **Logging:** Log prompt versions + inputs for debugging and improvement
