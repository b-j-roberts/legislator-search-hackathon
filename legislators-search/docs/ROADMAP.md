# Roadmap

## Phase 0: Project Foundation

- [x] 0.1 Initialize Next.js 15 project with App Router
- [x] 0.2 Configure Tailwind CSS v4 with dark mode
- [x] 0.3 Initialize shadcn/ui component library
- [x] 0.4 Set up Prettier and ESLint
- [x] 0.5 Create common components (Button, Input, Card, etc.)
- [x] 0.6 Set up Motion (Framer Motion) for animations

## Phase 1: MVP

- [ ] 1.1 Home page search interface
  - [ ] Hero section with title and description
  - [ ] Search bar component with query input
  - [ ] State filter dropdown
  - [ ] Search button with navigation

- [ ] 1.2 Search results page layout
  - [ ] Persistent search bar at top
  - [ ] Advanced filters sidebar
  - [ ] Results count and summary
  - [ ] Grid layout for legislator cards

- [ ] 1.3 Legislator card component
  - [ ] Photo and basic info display
  - [ ] Party affiliation badge
  - [ ] Chamber and state info
  - [ ] Issue-specific blurb
  - [ ] Contact information
  - [ ] Social media links

- [ ] 1.4 Advanced filters
  - [ ] State filter
  - [ ] Party filter (Democrat, Republican, Independent)
  - [ ] Chamber filter (House, Senate)
  - [ ] Tag filters (ethnicity, caucus, etc.)
  - [ ] Clear filters button

- [ ] 1.5 Mock data integration
  - [ ] Create sample legislator data
  - [ ] Implement client-side filtering
  - [ ] Add loading states

- [ ] 1.6 Search API route (stub)
  - [ ] Create `/api/search` route
  - [ ] Accept query and filter params
  - [ ] Return mock filtered results

## Phase 2: Nice-to-have

- [ ] 2.1 Legislator detail modal/page
  - [ ] Full voting record summary
  - [ ] Committee memberships
  - [ ] Recent news/press releases
  - [ ] Related legislation

- [ ] 2.2 Search history
  - [ ] Recent searches dropdown
  - [ ] localStorage persistence
  - [ ] Clear history option

- [ ] 2.3 Share functionality
  - [ ] Copy link to clipboard
  - [ ] Social media share buttons
  - [ ] Embed code generation

- [ ] 2.4 Comparison view
  - [ ] Select multiple legislators
  - [ ] Side-by-side comparison
  - [ ] Issue stance comparison

## Phase 3: Future

- [ ] 3.1 Real AI backend integration
  - [ ] Connect to AI service for issue blurbs
  - [ ] Semantic search implementation
  - [ ] Natural language query processing

- [ ] 3.2 User accounts
  - [ ] Sign up / sign in
  - [ ] Saved searches
  - [ ] Followed legislators
  - [ ] Custom alerts

- [ ] 3.3 Email notifications
  - [ ] Voting alerts for followed legislators
  - [ ] Issue updates
  - [ ] New legislation alerts

- [ ] 3.4 Data visualizations
  - [ ] Voting record charts
  - [ ] Party alignment graphs
  - [ ] Issue stance spectrum
  - [ ] Campaign finance breakdown

- [ ] 3.5 Mobile app
  - [ ] React Native or PWA
  - [ ] Push notifications
  - [ ] Offline support

## Stretch Goals

- [ ] Geolocation-based representative lookup
- [ ] Integration with voter registration services
- [ ] Town hall and event calendar
- [ ] Constituent messaging system
- [ ] Bill tracking and alerts
- [ ] AI-powered policy explainers
