# Roadmap

Feature roadmap for Legislators Chat frontend, broken into Phase 0 (Setup), MVP, Nice-to-have, and Future phases.

> **AI Integration:** This project uses [Maple AI](https://trymaple.ai/) for all LLM operations. Maple provides end-to-end encrypted inference via their OpenAI-compatible Proxy API. See `ARCHITECTURE.md` for details.

---

## Prompt Initialization

Hey, I am working on the legislators-chat project. Let's continue with implementing:
After implementing the feature, please provide a concise step-by-step instruction on how to test it locally, if applicable, and what I should expect to see.

---

# Phase 1: Contact Representatives MVP

Enable users to transition from research/chat phase to taking action by contacting their representatives with AI-generated, personalized call scripts and email drafts.

## 1.3 AI Content Generation

**Description**: Generate personalized call scripts and email drafts using AI.

**Requirements**:
- [ ] Create prompt builder that includes:
  - User's advocacy topic/message from chat phase
  - Relevant research findings (votes, hearings, positions)
  - Legislator-specific context (committees, past statements)
  - User's tone preference (formal, passionate, personal story)
- [ ] Generate call script with:
  - Introduction template
  - Key talking points
  - Responses to common questions
  - Closing/call-to-action
- [ ] Generate email draft with:
  - Subject line options
  - Proper salutation
  - Body with clear ask
  - Relevant citations/references
  - Professional closing
- [ ] Show loading state during generation
- [ ] Allow regeneration with different parameters

**Implementation Notes**:
- Use Maple AI for generation (streaming response)
- Include legislator's voting record on relevant issues
- Reference specific bills/hearings when applicable
- Keep scripts concise (under 2 minutes for calls)

---

## 1.4 Content Editor with AI Chat

**Description**: Allow users to refine generated content through AI conversation.

**Requirements**:
- [ ] Display generated script/email in editable rich text area
- [ ] Add inline AI chat panel for refinement requests
- [ ] Support common refinement commands:
  - "Make it shorter/longer"
  - "Make it more formal/casual"
  - "Add more statistics"
  - "Include my personal story about..."
  - "Change the tone to..."
- [ ] Apply AI suggestions directly to draft
- [ ] Show diff/changes highlighted
- [ ] Maintain edit history with undo/redo
- [ ] Add quick-action buttons for common edits

**Implementation Notes**:
- Keep refinement chat context separate from research chat
- Consider side-by-side layout (draft | chat)
- Preserve original generated version for comparison

---

## 1.5 Actions & Completion

**Description**: Enable users to finalize and send/save their outreach.

**Requirements**:
- [ ] "Copy to Clipboard" button for scripts/emails
- [ ] "Download as PDF" for call scripts (printable format)
- [ ] "Download as .txt" for emails
- [ ] "Open in Email Client" (mailto: link with prefilled content)
- [ ] "Mark as Complete" to log the contact and move to next
- [ ] "Save Draft" to preserve work-in-progress
- [ ] Show confirmation modal before marking complete
- [ ] Track completion status per legislator

**Implementation Notes**:
- mailto: links have character limits (~2000 chars)
- Offer both copy and direct email options
- Consider integration with email APIs in future

---

## 1.6 Context Switching & Persistence

**Description**: Allow async work across multiple legislators.

**Requirements**:
- [ ] Auto-save draft content when switching legislators
- [ ] Preserve AI refinement chat history per legislator
- [ ] Store all state in local storage:
  - Queue order
  - Draft content per legislator
  - Completion status
  - Contact method selections
  - Refinement chat history
- [ ] Show "Draft saved" indicator
- [ ] Warn before leaving with unsaved changes
- [ ] Allow resuming from any point in queue

**Implementation Notes**:
- Use localStorage with structured key schema
- Consider IndexedDB for larger chat histories
- Implement debounced auto-save (every 2-3 seconds of inactivity)

---

## 1.7 Session Summary

**Description**: Provide summary view of completed outreach.

**Requirements**:
- [ ] Create summary page showing all contacted legislators
- [ ] Display which method was used (call/email) for each
- [ ] Show date/time of completion
- [ ] Allow downloading full session as report
- [ ] Provide "Share your impact" social templates
- [ ] Option to clear session and start fresh
- [ ] Link back to chat for continued research

**Implementation Notes**:
- Summary can be a modal or separate route
- Include encouraging messaging about civic engagement
- Track aggregate stats (total contacted, methods used)

---

# Phase 2: Nice-to-Have

Features that enhance the experience but aren't required for initial launch.

### 2.1 Leaning feature

**Description**: Show legislator's leaning on a gauge for particular issues/chats instead   of just Support/Oppose/...

**Requirements**:
- [ ] Design a gauge component
- [ ] Integrate with legislator data model
- [ ] Display gauge in LegislatorCard
- [ ] Add tooltip explaining the leaning scale
- [ ] Replace binary indicators with gauge where applicable

**Implementation Notes**:
- Use color gradients for visual appeal
- Ensure accessibility with text alternatives
- Consider animation for gauge filling

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
