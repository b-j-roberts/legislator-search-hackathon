# API Integration Roadmap

Integration roadmap for connecting Legislators Chat frontend to the PolSearch API backend. Covers AI orchestration, search integration, and progressive enhancement phases.

> **API Reference:** See [API_SPEC.md](./API_SPEC.md) for full PolSearch API documentation.
> **Backend URL:** `http://10.246.40.72:3000` (via Next.js API route proxy)

---

## Prompt Initialization

Hey, I am working on integrating the PolSearch API into legislators-chat. Let's continue with implementing:
After implementing the feature, please provide a concise step-by-step instruction on how to test it locally, if applicable, and what I should expect to see.

---

# Phase 1: Core Integration (MVP)

Minimum viable integration to enable AI-powered congressional search.

### 1.6 Source URL Integration

**Description**: Make search results clickable to open official GovInfo source documents.

**Requirements**:
- [ ] Update `DocumentCard` props to accept `sourceUrl?: string`
- [ ] Make card clickable when `sourceUrl` is present
- [ ] Open link in new tab with `target="_blank"` and `rel="noopener noreferrer"`
- [ ] Show visual indicator (ExternalLink icon) on hover
- [ ] Update existing `Hearing` and `Document` types to include `url` field mapping

**Current State** (from `results-panel.tsx:82-128`):
```tsx
// ExternalLink icon exists but is non-functional
<ExternalLink className="size-4 text-muted-foreground/0 group-hover:text-accent" />
```

**Updated Implementation**:
```tsx
function DocumentCard({
  title,
  date,
  type,
  summary,
  committee,
  sourceUrl,  // NEW: from search result source_url
}: DocumentCardProps) {
  const CardWrapper = sourceUrl ? 'a' : 'div';
  const wrapperProps = sourceUrl ? {
    href: sourceUrl,
    target: '_blank',
    rel: 'noopener noreferrer',
  } : {};

  return (
    <motion.div>
      <CardWrapper {...wrapperProps} className="...">
        {/* existing card content */}
        {sourceUrl && (
          <ExternalLink className="size-4 text-muted-foreground/0 group-hover:text-accent" />
        )}
      </CardWrapper>
    </motion.div>
  );
}
```

**Implementation Notes**:
- The API provides `source_url` directly when `enrich=true`
- No URL construction needed - use the URL as-is from API
- Source URLs point to GovInfo (official government source)

---

### 1.7 Loading States

**Description**: Implement loading UX during multi-step AI orchestration.

**Requirements**:
- [ ] Create loading spinner component for chat messages
- [ ] Show "Thinking..." state during entire orchestration flow
- [ ] Single spinner (no progressive stages for MVP)
- [ ] Handle timeout gracefully (30s max wait)

**Implementation Notes**:
- Reuse existing loading patterns from chat interface
- Disable send button while processing
- Allow user to cancel/interrupt if needed

---

# Phase 2: Enhanced Integration

Features that improve search quality and expand integration points.

### 2.1 Contact Page - Voting Record Context

**Description**: Auto-fetch legislator's voting record on user's advocacy topic.

**Requirements**:
- [ ] When user selects advocacy topic AND legislator, trigger search
- [ ] Search for votes/hearings where legislator spoke on the topic
- [ ] Display voting record in collapsible "Research" section
- [ ] Show relevant votes with yes/no indicators
- [ ] Link to GovInfo using `source_url` for full vote details
- [ ] Use this context to inform AI content generation

**Implementation Notes**:
- Search params: `speaker={legislator_name}`, `q={topic}`, `type=floor_speech,hearing`
- Show max 5 most relevant results
- Cache results for session (avoid re-fetching on form changes)

---

### 2.2 Content Detail View

**Description**: Fetch and display full content details using `/content/{id}` endpoint.

**Requirements**:
- [ ] Add "View Details" action to DocumentCard
- [ ] Call `/api/content/{id}` to get full metadata
- [ ] Display in modal or slide-over panel
- [ ] Show: title, date, chamber, committee, total statements
- [ ] Link to full source via `source_url`

**Implementation Notes**:
- Use the new `/content/{id}` endpoint
- Consider caching content details to avoid repeat fetches
- Show loading skeleton while fetching

---

### 2.3 Legislator Card - Related Content

**Description**: Show related hearings/votes when user expands a legislator card.

**Requirements**:
- [ ] Add "Congressional Activity" section to expanded card
- [ ] Lazy-load when user clicks "Show more"
- [ ] Search for hearings/speeches by this legislator
- [ ] Display as compact list with dates and source links
- [ ] Link each item to GovInfo source

**Implementation Notes**:
- Search params: `speaker={name}`, `limit=5`, `enrich=true`
- Only fetch when card is expanded (not on initial render)
- Show loading skeleton during fetch

---

### 2.4 Error Recovery & Retry UI

**Description**: Improve error handling with user-visible retry options.

**Requirements**:
- [ ] Show "Search unavailable" toast when PolSearch is down
- [ ] Add "Try again" button on failed searches
- [ ] Implement exponential backoff with jitter
- [ ] After 3 failures, show persistent error state
- [ ] Auto-recover when service becomes available

**Implementation Notes**:
- Track API health state globally
- Don't block chat if only search is failing
- Log errors for debugging

---

### 2.5 AI Filter Translation

**Description**: Teach AI to translate existing legislator filters to search params.

**Requirements**:
- [ ] When user has legislator filters active (party, state, chamber)
- [ ] AI should consider these when constructing search
- [ ] Map chamber filter directly to search `chamber` param
- [ ] For party/state, AI narrows results to relevant legislators
- [ ] Update system prompt with filter awareness

**Implementation Notes**:
- Pass active filters to Maple in user context
- AI decides when filters are relevant to search
- Don't force filters on every search

---

### 2.6 Pagination via AI

**Description**: Enable AI to handle pagination for large result sets.

**Requirements**:
- [ ] Teach Maple about `limit` and `offset` params
- [ ] When user asks "show me more", AI increments offset
- [ ] Track pagination state in conversation context
- [ ] Show "Load more" affordance in results UI
- [ ] AI synthesizes pagination into natural response

**Implementation Notes**:
- Default limit: 10 results
- AI tracks offset per content type
- User can also manually request more

---

# Phase 3: Advanced Features

Features for power users and enhanced search experience.

### 3.1 Chat Input Typeahead

**Description**: Add autocomplete suggestions using search API.

**Requirements**:
- [ ] As user types, show suggestions dropdown
- [ ] Suggest bill names, committee names, legislator names
- [ ] Use PolSearch with short debounced queries
- [ ] Selecting suggestion fills input
- [ ] Show suggestion category (Bill, Committee, Person)

**Implementation Notes**:
- Requires creative use of existing search endpoint
- Debounce 200ms to avoid excessive calls
- Cache recent suggestions

---

### 3.2 Advanced Filter Panel

**Description**: Expose PolSearch filters as explicit UI controls.

**Requirements**:
- [ ] Add "Advanced Search" toggle
- [ ] Date range picker (from/to)
- [ ] Congress number selector
- [ ] Committee dropdown (for hearings)
- [ ] Content type checkboxes
- [ ] Filters applied to AI searches

**Implementation Notes**:
- Secondary to AI filter translation
- For users who want explicit control
- Persist filter state in URL params

---

### 3.3 Result Expansion & Context

**Description**: Allow users to see surrounding context for search results.

**Requirements**:
- [ ] Add "Show context" button on each result
- [ ] Fetch result with `context=3` param
- [ ] Display context_before and context_after
- [ ] Highlight the matched segment
- [ ] Smooth expand/collapse animation

**Implementation Notes**:
- Fetch context on-demand (not in initial search)
- Context is currently AI-only, this exposes to users
- Consider performance impact

---

### 3.4 Search History

**Description**: Track and display recent search queries.

**Requirements**:
- [ ] Store recent searches in localStorage
- [ ] Show "Recent searches" in empty state
- [ ] Allow clearing search history
- [ ] Quick re-run previous searches

**Implementation Notes**:
- Max 20 recent searches
- Store query params, not full results
- Privacy: all local, nothing to server

---

### 3.5 Embedded Audio Player

**Description**: Play hearing/speech audio with timestamp seeking.

**Requirements**:
- [ ] Build audio player component
- [ ] Use `start_time_ms` and `end_time_ms` for seeking
- [ ] Source audio from C-SPAN or official archives
- [ ] Show waveform or progress bar
- [ ] Sync playback with transcript highlight

**Implementation Notes**:
- Requires audio URL mapping (not in current API)
- May need additional backend endpoint
- Consider accessibility requirements

---

# Implementation Checklist

## Environment Setup
- [ ] Add `POLSEARCH_API_URL=http://10.246.40.72:3000` to `.env.local`
- [ ] Verify direct network access to PolSearch from dev machine
- [ ] Test `/health` endpoint connectivity

## Files to Create
- [ ] `src/app/api/search/route.ts` - Search API proxy
- [ ] `src/app/api/content/[id]/route.ts` - Content details API proxy
- [ ] `src/lib/search-service.ts` - Search service layer
- [ ] `src/lib/prompts/search-system.ts` - Maple system prompt
- [ ] `src/lib/parse-ai-response.ts` - JSON extraction utilities
- [ ] `src/hooks/use-search-orchestration.ts` - Orchestration hook
- [ ] `src/types/search.ts` - Search type definitions

## Files to Modify
- [ ] `src/components/results/results-panel.tsx` - Conditional tabs, source links
- [ ] `src/components/chat/chat-messages.tsx` - Integrate orchestration
- [ ] `src/hooks/use-chat.tsx` - Connect to search flow
- [ ] `src/lib/types.ts` - Add search types or import from search.ts

## Files to Remove
- [ ] Any mock data files for documents/votes
- [ ] Hardcoded example results

---

## Testing Checklist

### Phase 1 Testing
1. Start dev server: `npm run dev`
2. Open browser to `localhost:3000`
3. Ask: "What hearings discussed climate change in 2024?"
4. Verify:
   - Loading spinner appears
   - Documents tab appears with real results
   - Results have titles, dates, speaker names
   - Clicking a result opens GovInfo in new tab (source_url works)

### Source Link Testing
1. Submit a search query
2. Hover over a DocumentCard
3. Verify ExternalLink icon appears
4. Click the card
5. Verify GovInfo page opens in new tab

### Error Testing
1. Stop PolSearch (or disconnect network)
2. Submit a query
3. Verify:
   - Retry attempts happen (check network tab)
   - Error message appears after retries exhausted
   - Chat still functions for non-search queries

---

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Search mode | Always hybrid | Simplest UX, backend handles optimization |
| AI orchestration | Frontend prompt engineering | No backend changes needed |
| Output format | JSON in Maple response | Structured output parsing, no function calling |
| Tab visibility | Conditional | Show only when results exist |
| Filter approach | AI translates | Reuse existing filter UI |
| Error recovery | Auto-retry with backoff | Better UX than immediate failure |
| Empty results | AI retries broader search | Reduces "no results" dead ends |
| Relevance score | Hidden | Users don't need to see numbers |
| Pagination | AI-controlled | Natural conversation flow |
| Caching | None for MVP | Simplicity over optimization |
| Context segments | AI consumption only | Not shown to users directly |
| Audio timestamps | Future phase | Requires audio URL mapping |
| Source links | Use API's source_url | API provides GovInfo URLs directly |

---

## API Changes Summary

The PolSearch API now includes:

### New Endpoint
- `GET /content/{id}` - Get full content details by UUID

### New Fields in SearchResult (when `enrich=true`)
| Field | Type | Description |
|-------|------|-------------|
| `source_url` | string | Direct link to GovInfo source document |
| `chamber` | string | "House", "Senate", or "House, Senate" |
| `committee` | string | Committee name (hearings only) |
| `congress` | number | Congress number (hearings only) |

### Integration Impact
- **No manual URL construction** - API provides `source_url` directly
- **Richer metadata** - Chamber, committee, congress available for display
- **Content details** - New endpoint for full document info

---

## Related Documentation

- [API_SPEC.md](./API_SPEC.md) - Full PolSearch API reference
- [ARCHITECTURE.md](./ARCHITECTURE.md) - System design
- [ROADMAP.md](./ROADMAP.md) - Feature roadmap
- [STYLES.md](./STYLES.md) - UI/UX guidelines
