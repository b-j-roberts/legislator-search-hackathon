# Roadmap

Feature roadmap for Legislators Chat frontend, broken into Phase 0 (Setup), MVP, Nice-to-have, and Future phases.

> **AI Integration:** This project uses [Maple AI](https://trymaple.ai/) for all LLM operations. Maple provides end-to-end encrypted inference via their OpenAI-compatible Proxy API. See `ARCHITECTURE.md` for details.

---

## Prompt Initialization

Hey, I am working on the legislators-chat project. Let's continue with implementing:
After implementing the feature, please provide a concise step-by-step instruction on how to test it locally, if applicable, and what I should expect to see.

---

# Phase 1: MVP

Core features required for initial usable product.

### 1.2 Chat Messages Display

**Description**: Display conversation history with distinct styling for user and AI messages.

**Requirements**:
- [ ] Create ChatMessages container with scroll behavior
- [ ] Create ChatBubble component for individual messages
- [ ] Style user messages (right-aligned, accent color)
- [ ] Style AI messages (left-aligned, secondary color)
- [ ] Implement auto-scroll to latest message
- [ ] Add timestamps to messages
- [ ] Show typing indicator during API calls

**Implementation Notes**:
- Use ScrollArea for smooth scrolling
- Consider virtualization for long conversations (future)
- Animate new messages with Framer Motion

---

### 1.3 Chat State Management

**Description**: Implement state management for chat functionality.

**Requirements**:
- [ ] Create useChat hook for managing chat state
- [ ] Implement message history storage
- [ ] Handle sending messages to API
- [ ] Handle receiving and parsing responses
- [ ] Implement error handling for failed requests
- [ ] Add retry functionality for failed messages

**Implementation Notes**:
- Start with React Context; migrate to Zustand if needed
- Consider persisting chat history to localStorage
- Handle network errors gracefully with user feedback

---

### 1.4 API Client Setup

**Description**: Create API client for communicating with the backend (which uses Maple AI).

**Requirements**:
- [ ] Create API client module in src/lib/api.ts
- [ ] Implement chat endpoint function
- [ ] Add request/response type validation
- [ ] Configure base URL from environment
- [ ] Implement request timeout handling
- [ ] Add error response parsing

**Implementation Notes**:
- Use native fetch with error handling
- Backend connects to Maple Proxy for LLM inference
- Maple uses OpenAI-compatible API format (streaming only)
- Structure for easy addition of new endpoints
- Consider adding request interceptors for auth (future)

---

### 1.5 Legislator Card Component

**Description**: Create card component for displaying legislator information.

**Requirements**:
- [ ] Create LegislatorCard component
- [ ] Display name, party, state, chamber
- [ ] Show stance badge (for/against/mixed)
- [ ] Display stance summary text
- [ ] Show primary contact info (phone, email)
- [ ] Add click-to-call/email functionality
- [ ] Add expand/collapse for full details

**Implementation Notes**:
- Use shadcn Card as base
- Party colors: D=blue, R=red, I=purple
- Stance badges: for=green, against=red, mixed=yellow, unknown=gray

---

### 1.6 Results Panel

**Description**: Create the panel that displays structured results alongside chat.

**Requirements**:
- [ ] Create ResultsPanel container component
- [ ] Implement LegislatorList to display multiple cards
- [ ] Add empty state for no results
- [ ] Add loading state with skeletons
- [ ] Implement responsive behavior (below chat on mobile)

**Implementation Notes**:
- Panel should update after each AI response
- Consider tabs for different result types (People, Documents, Votes)
- Animate list changes with Framer Motion

---

### 1.7 Responsive Layout

**Description**: Implement responsive layout for desktop and mobile views.

**Requirements**:
- [ ] Desktop: side-by-side chat and results
- [ ] Tablet: stacked or collapsible results
- [ ] Mobile: full-width chat with results below or in drawer
- [ ] Ensure touch-friendly tap targets
- [ ] Test on various viewport sizes

**Implementation Notes**:
- Use Tailwind responsive prefixes (sm:, md:, lg:)
- Consider drawer pattern for mobile results
- Maintain usability at all breakpoints

---

### 1.8 Error Handling UI

**Description**: Implement user-facing error states and recovery.

**Requirements**:
- [ ] Create error message component
- [ ] Show errors inline in chat
- [ ] Add retry button for failed messages
- [ ] Handle network offline state
- [ ] Show toast notifications for transient errors

**Implementation Notes**:
- Use shadcn Alert or custom error bubble
- Provide actionable error messages
- Log errors for debugging (console in dev)

---

# Phase 2: Nice-to-Have

Features that enhance the experience but aren't required for initial launch.

### 2.1 Chat History Persistence

**Description**: Save and restore chat history across sessions.

**Requirements**:
- [ ] Persist chat history to localStorage
- [ ] Restore previous conversations on load
- [ ] Add ability to start new conversation
- [ ] Implement conversation list sidebar
- [ ] Add delete conversation functionality

**Implementation Notes**:
- Consider data size limits of localStorage
- May need to move to IndexedDB for large histories
- Future: sync to backend for cross-device

---

### 2.2 Advanced Filtering & Sorting

**Description**: Allow users to filter and sort legislator results.

**Requirements**:
- [ ] Filter by party (D/R/I)
- [ ] Filter by chamber (House/Senate)
- [ ] Filter by state
- [ ] Filter by stance (for/against)
- [ ] Sort by relevance, name, state
- [ ] Persist filter preferences

**Implementation Notes**:
- Use shadcn Select/Checkbox for filters
- Filters should update results in real-time
- Consider filter chips for active filters

---

### 2.3 Document Viewer

**Description**: Display related documents, hearings, and vote records.

**Requirements**:
- [ ] Create DocumentCard component
- [ ] Create HearingCard component
- [ ] Create VoteRecordCard component
- [ ] Add document type tabs in ResultsPanel
- [ ] Implement expandable document previews
- [ ] Add links to source documents

**Implementation Notes**:
- Use consistent card design across types
- Show relevance score or highlight
- Consider modal for detailed view

---

### 2.4 Report Generation

**Description**: Generate and export advocacy reports.

**Requirements**:
- [ ] Add "Generate Report" button
- [ ] Create report preview modal
- [ ] Export as PDF option
- [ ] Export as shareable link
- [ ] Include selected legislators and documents

**Implementation Notes**:
- Report generation happens on backend
- Frontend handles display and export
- Consider print-friendly CSS

---

### 2.5 Streaming Responses

**Description**: Implement real-time streaming of AI responses from Maple AI.

**Requirements**:
- [ ] Set up SSE connection for streaming
- [ ] Stream message text token-by-token
- [ ] Update structured data as it arrives
- [ ] Handle connection interruptions
- [ ] Show connection status indicator

**Implementation Notes**:
- Maple Proxy API is streaming-only (`/v1/chat/completions`)
- Improves perceived performance significantly
- Backend proxies Maple stream to frontend via SSE
- Handle TEE attestation delays gracefully

---

### 2.6 Search Suggestions

**Description**: Provide query suggestions and autocomplete.

**Requirements**:
- [ ] Show suggested topics/queries
- [ ] Implement recent searches
- [ ] Add popular/trending topics
- [ ] Autocomplete legislator names
- [ ] Quick action buttons (e.g., "Find my representatives")

**Implementation Notes**:
- Suggestions from backend or predefined list
- Use Command/Combobox pattern from shadcn
- Consider location-based suggestions

---

### 2.7 Accessibility Improvements

**Description**: Ensure full accessibility compliance.

**Requirements**:
- [ ] Audit with screen reader
- [ ] Add ARIA labels throughout
- [ ] Ensure keyboard navigation
- [ ] Implement focus trapping in modals
- [ ] Add skip links
- [ ] Test color contrast ratios

**Implementation Notes**:
- Target WCAG 2.1 AA compliance
- Use axe-core for automated testing
- Manual testing with VoiceOver/NVDA

---

# Phase 3: Future Improvements

Features for long-term product evolution.

### 3.1 User Accounts

**Description**: Allow users to create accounts for personalized experience.

**Requirements**:
- [ ] Authentication system (email, social)
- [ ] User profile management
- [ ] Saved searches and preferences
- [ ] Cross-device sync

---

### 3.2 Legislator Tracking

**Description**: Let users follow specific legislators for updates.

**Requirements**:
- [ ] Follow/unfollow legislators
- [ ] Notification preferences
- [ ] Activity feed for followed legislators
- [ ] Email digest of updates

---

### 3.3 Advocacy Actions

**Description**: Enable direct civic engagement actions.

**Requirements**:
- [ ] One-click call scripts
- [ ] Email templates to legislators
- [ ] Social media share templates
- [ ] Petition integration
- [ ] Track outreach history

---

### 3.4 Collaboration Features

**Description**: Allow groups to collaborate on research.

**Requirements**:
- [ ] Share conversations
- [ ] Collaborative workspaces
- [ ] Comments and annotations
- [ ] Export for teams

---

### 3.5 Analytics Dashboard

**Description**: Visualize legislative data and trends.

**Requirements**:
- [ ] Voting pattern charts
- [ ] Topic trend analysis
- [ ] Geographic visualizations
- [ ] Timeline views

---

### 3.6 Mobile App

**Description**: Native mobile application.

**Requirements**:
- [ ] iOS app (React Native or Swift)
- [ ] Android app
- [ ] Push notifications
- [ ] Offline support

---

### 3.7 Integrations

**Description**: Third-party integrations for enhanced functionality.

**Requirements**:
- [ ] CRM integration for advocacy orgs
- [ ] Calendar integration for hearings
- [ ] News feed integration
- [ ] GovTrack/Congress.gov APIs
