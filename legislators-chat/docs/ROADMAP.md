# Roadmap

Feature roadmap for Legislators Chat frontend, broken into Phase 0 (Setup), MVP, Nice-to-have, and Future phases.

> **AI Integration:** This project uses [Maple AI](https://trymaple.ai/) for all LLM operations. Maple provides end-to-end encrypted inference via their OpenAI-compatible Proxy API. See `ARCHITECTURE.md` for details.

---

## Prompt Initialization

Hey, I am working on the legislators-chat project. Let's continue with implementing:
After implementing the feature, please provide a concise step-by-step instruction on how to test it locally, if applicable, and what I should expect to see.

---

# Phase 2: Nice-to-Have

Features that enhance the experience but aren't required for initial launch.

### 2.1a UI Redesign ( Home/Main Page )

**Description**: Revamp the main landing page for better readability and user engagement using the frontend-design SKILL for claude.

**Requirements**:
- [ ] Think through overall layout and structure of the home page
- [ ] Come up with a modern color scheme and typography
- [ ] Design a better header
- [ ] Design a more engaging and modern chat interface
- [ ] Design a more engaging and modern result panel

**Implementation Notes**:
- Use consistent design language
- Focus on usability and clarity
- Consider responsive design for mobile
- Try to reduce cognitive load for new users

### 2.1b UI Redesign ( Contact Page )

**Description**: Update the contact page layout and styling for improved user experience using the frontend-design SKILL for claude.

**Requirements**:
- [ ] Think through overall layout and structure of the contact page
- [ ] Use modern color scheme and typography consistent with main page
- [ ] Design a better header/subheader section which takes up less space
- [ ] Design a more engaging and modern contact components based on each contact method
- [ ] Design a more engaging and modern contact queue with better spacing and alignment, more useful icons, and clearer information hierarchy
- [ ] Ensure consistent design considerations for all components/forms and ensure nothing is too cluttered or overwhelming or crowded

**Implementation Notes**:
- Use consistent design language with main page
- Focus on usability and clarity
- Consider responsive design for mobile
- Try to reduce cognitive load for new users

### 2.1c UI Redesign ( Complete Page )

**Description**: Redesign the complete page to enhance visual appeal and usability using the frontend-design SKILL for claude.

**Requirements**:
- [ ] Rethink overall layout and structure of the complete page
- [ ] Apply modern color scheme and typography consistent with other pages
- [ ] Design a better header/subheader section which takes up less space
- [ ] Create a more engaging and modern completion components based on each completion method
- [ ] Ensure consistent design considerations for all components and ensure nothing is too cluttered or overwhelming or crowded

**Implementation Notes**:
- Use consistent design language with other pages
- Focus on usability and clarity
- Consider responsive design for mobile
- Try to reduce cognitive load for new users

### 2.2 Contact Page Auto-Populate

**Description**: Auto-fill contact form based on home page chat.

**Requirements**:
- [ ] Capture key details from chat (name, email, message, subject)
- [ ] Check what fields you think would be useful to auto-populate ( and can be captured from the chat )
- [ ] Pre-fill contact form fields when navigating to contact page & when switching between people from contact queue
- [ ] Allow user to edit pre-filled fields
- [ ] Validate pre-filled data

**Implementation Notes**:
- Use context or state management to pass data
- Ensure data privacy and security
- Consider edge cases (e.g., incomplete data)
- Test with various chat inputs

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

### 2.8 Speech-to-Text Input

**Description**: Allow voice input for chat.

**Requirements**:
- [ ] Integrate Web Speech API
- [ ] Integrate microphone button in chat input
- [ ] Display real-time transcription
- [ ] Handle start/stop recording
- [ ] Allow editing of transcribed text

**Implementation Notes**:
- Fallback for unsupported browsers
- Consider privacy implications
- Test with various accents and speech patterns

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
