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
- Do not feel obligated to keep existing elements/layout if a better design is possible

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

### 2.2 Issues with data cleaning between different chats/sessions

**Description**: Fix data persistence and cleaning issues when switching between different chat sessions.

**Requirements**:
- [ ] Identify data leakage points between sessions for chat, contacts, and completions
- [ ] Ensure each chat session has isolated state for autofilling fields, drafts/contact form fillings, contact/completion data/props, ...
- [ ] Implement cleanup routines when switching sessions

**Implementation Notes**:
- Review state management logic
- Test switching between multiple sessions rapidly
- Ensure no residual data from previous sessions appears

### 2.3 Real Contact Data

**Description**: Integrate real contact data for legislators.

**Requirements**:
- [ ] Source reliable legislator contact data per legislator
- [ ] If no email is available, use phone/fax/address/...
- [ ] Provide links to official contact pages per legislator ( with note on required info needs to be filled out by user )
- [ ] Update ContactCard component to display real data
- [ ] Test with multiple legislators to ensure data accuracy

**Implementation Notes**:
- Use official government APIs or datasets
- Ensure data is up-to-date and accurate
- Handle missing data gracefully
- Scrape, check, and look into all data related to contact methods for legislators

### 2.4 Document Viewer

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

### 2.5 Report Generation

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
