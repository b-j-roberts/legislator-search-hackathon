# Architecture

System architecture for Legislators Chat, an AI-powered interface for legislative research and civic engagement.

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FRONTEND (This Repo)                            │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                         Next.js Application                              │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────────┐   │ │
│  │  │  Chat View   │  │  Results     │  │  Legislator Cards            │   │ │
│  │  │  - Input     │  │  Panel       │  │  - Contact Info              │   │ │
│  │  │  - Messages  │  │  - Filters   │  │  - Stance Summary            │   │ │
│  │  │  - History   │  │  - Sort      │  │  - Voting Record             │   │ │
│  │  └──────────────┘  └──────────────┘  └──────────────────────────────┘   │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      │ HTTP/WebSocket
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKEND API (Separate)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │  Chat        │  │  Search      │  │  Report      │  │  Legislator  │     │
│  │  Endpoint    │  │  Engine      │  │  Generator   │  │  Lookup      │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
│                              │                                               │
│                              ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │                    Maple AI (via Maple Proxy)                            │ │
│  │  - End-to-end encrypted LLM inference                                    │ │
│  │  - OpenAI-compatible API (streaming)                                     │ │
│  │  - Trusted Execution Environment (TEE)                                   │ │
│  │  - Context retrieval & structured output                                 │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              DATA SOURCES                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ Congressional│  │   Voting     │  │  Legislator  │  │   Video      │     │
│  │   Hearings   │  │   Records    │  │   Profiles   │  │ Transcripts  │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Frontend Architecture

### Technology Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| Framework | Next.js 16 (App Router) | Server-side rendering, routing, API routes |
| UI Library | React 19 | Component-based UI |
| Components | shadcn/ui | Accessible, customizable UI primitives |
| Styling | Tailwind CSS v4 | Utility-first CSS |
| Animations | Framer Motion | Smooth UI transitions |
| State | React Context / Zustand | Client-side state management |
| Types | TypeScript | Type safety |

### AI Integration: Maple AI

We use [Maple AI](https://trymaple.ai/) for all LLM operations. Maple is a privacy-first AI platform that provides end-to-end encrypted inference, often described as "The Signal of AI."

**Why Maple AI:**
- **Privacy**: All inference runs in Trusted Execution Environments (TEEs)
- **Security**: End-to-end encryption for prompts and responses
- **OpenAI Compatible**: Works with standard OpenAI client libraries via Maple Proxy
- **Live Data**: Can perform secure web searches for real-time information

**Available Models (via Maple Proxy):**
| Model | Pricing |
|-------|---------|
| `llama-3.3-70b` | $4/M tokens |
| `gpt-oss-120b` | $4/M tokens |
| `deepseek-r1-0528` | $4/M tokens |
| `qwen3-coder-480b` | $10/M tokens |

**Integration Pattern:**
```
Frontend → Backend API → Maple Proxy → TEE Attestation → Encrypted Inference → Response
```

The backend runs Maple Proxy locally or in a container, which handles:
1. TEE attestation verification
2. Encryption negotiation
3. Key exchange
4. OpenAI-formatted request/response translation

### Directory Structure

```
src/
├── app/                    # Next.js App Router
│   ├── layout.tsx          # Root layout with providers
│   ├── page.tsx            # Home page (chat interface)
│   ├── globals.css         # Global styles & CSS variables
│   └── api/                # API routes (if needed)
│
├── components/
│   ├── ui/                 # shadcn/ui base components
│   ├── chat/               # Chat-specific components
│   │   ├── ChatInput.tsx
│   │   ├── ChatMessages.tsx
│   │   ├── ChatBubble.tsx
│   │   └── ChatContainer.tsx
│   ├── legislators/        # Legislator display components
│   │   ├── LegislatorCard.tsx
│   │   ├── LegislatorList.tsx
│   │   ├── StanceBadge.tsx
│   │   └── ContactInfo.tsx
│   ├── results/            # Search results components
│   │   ├── ResultsPanel.tsx
│   │   ├── DocumentCard.tsx
│   │   └── VoteRecord.tsx
│   └── layout/             # Layout components
│       ├── Header.tsx
│       ├── Sidebar.tsx
│       └── MainContent.tsx
│
├── lib/
│   ├── utils.ts            # Utility functions (cn, etc.)
│   ├── api.ts              # API client functions
│   └── types.ts            # Shared TypeScript types
│
├── hooks/
│   ├── useChat.ts          # Chat state and actions
│   ├── useLegislators.ts   # Legislator data fetching
│   └── useSearch.ts        # Search functionality
│
└── stores/                 # State management (if using Zustand)
    └── chatStore.ts
```

---

## Data Flow

### Chat Request Flow

```
User Input
    │
    ▼
┌─────────────────┐
│  ChatInput.tsx  │ ─── User types message
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   useChat()     │ ─── Hook manages chat state
└─────────────────┘
    │
    ▼
┌─────────────────┐
│   API Client    │ ─── POST to backend API
└─────────────────┘
    │
    ▼
┌─────────────────┐
│  Backend API    │ ─── Processes with AI/LLM
└─────────────────┘
    │
    ▼
┌─────────────────────────────────────────┐
│           Structured Response            │
│  {                                       │
│    message: "AI response text...",       │
│    legislators: [...],                   │
│    documents: [...],                     │
│    votes: [...]                          │
│  }                                       │
└─────────────────────────────────────────┘
    │
    ▼
┌─────────────────┐     ┌─────────────────┐
│  ChatMessages   │     │  ResultsPanel   │
│  (AI response)  │     │  (Structured)   │
└─────────────────┘     └─────────────────┘
```

---

## Response Schema

The backend API returns structured responses that the frontend parses and displays:

```typescript
interface ChatResponse {
  // AI-generated conversational response
  message: string;

  // Structured data for UI components
  legislators?: Legislator[];
  documents?: Document[];
  votes?: VoteRecord[];
  hearings?: Hearing[];

  // Report generation (when requested)
  report?: Report;

  // Metadata
  sources: string[];
  confidence: number;
}

interface Legislator {
  id: string;
  name: string;
  party: 'D' | 'R' | 'I';
  chamber: 'House' | 'Senate';
  state: string;
  district?: string;

  // Stance on the queried topic
  stance: 'for' | 'against' | 'mixed' | 'unknown';
  stanceSummary: string;

  // Contact information
  contact: {
    phone?: string;
    email?: string;
    website?: string;
    office?: string;
    socialMedia?: {
      twitter?: string;
      facebook?: string;
    };
  };

  // Relevant voting/speaking record
  relevantVotes?: VoteSummary[];
  relevantStatements?: Statement[];
}

interface Document {
  id: string;
  type: 'hearing' | 'bill' | 'vote' | 'statement';
  title: string;
  date: string;
  summary: string;
  url?: string;
  relevance: number;
}
```

---

## Component Hierarchy

```
App
├── Layout
│   ├── Header
│   │   ├── Logo
│   │   └── Navigation
│   │
│   └── MainContent
│       ├── ChatContainer
│       │   ├── ChatMessages
│       │   │   └── ChatBubble (multiple)
│       │   └── ChatInput
│       │
│       └── ResultsPanel
│           ├── LegislatorList
│           │   └── LegislatorCard (multiple)
│           │       ├── StanceBadge
│           │       └── ContactInfo
│           │
│           └── DocumentList
│               └── DocumentCard (multiple)
```

---

## State Management

### Chat State

```typescript
interface ChatState {
  messages: Message[];
  isLoading: boolean;
  error: string | null;

  // Actions
  sendMessage: (content: string) => Promise<void>;
  clearHistory: () => void;
}
```

### Results State

```typescript
interface ResultsState {
  legislators: Legislator[];
  documents: Document[];
  activeFilters: Filter[];
  sortBy: SortOption;

  // Actions
  setFilter: (filter: Filter) => void;
  setSortBy: (option: SortOption) => void;
}
```

---

## API Integration

The frontend communicates with the backend via REST or WebSocket:

### REST Endpoints (Expected)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/chat` | Send message, receive AI response |
| GET | `/api/legislators/:id` | Get legislator details |
| GET | `/api/search` | Search documents/records |
| POST | `/api/report` | Generate advocacy report |

### WebSocket (Optional)

For streaming responses:

```typescript
// Connect to chat stream
const ws = new WebSocket('/api/chat/stream');

ws.onmessage = (event) => {
  const chunk = JSON.parse(event.data);
  // Handle streaming response chunks
};
```

---

## Deployment

### Recommended Stack

- **Hosting**: Vercel (optimized for Next.js)
- **CDN**: Vercel Edge Network
- **Environment**: Node.js 18+

### Environment Variables

```bash
# API Configuration
NEXT_PUBLIC_API_URL=         # Backend API base URL
NEXT_PUBLIC_WS_URL=          # WebSocket URL (if streaming)

# Maple AI Configuration (Backend)
MAPLE_API_KEY=               # Maple AI API key
MAPLE_PROXY_URL=             # Maple Proxy endpoint (default: http://localhost:8080/v1)
MAPLE_MODEL=                 # Model to use (e.g., llama-3.3-70b)

# Feature Flags
NEXT_PUBLIC_ENABLE_STREAMING=false
```

---

## Security Considerations

- All API calls should use HTTPS
- Implement rate limiting on API routes
- Sanitize user input before display
- No sensitive data stored client-side
- CSP headers configured in Next.js

### Maple AI Security

Maple AI provides additional security guarantees:
- **End-to-end encryption**: Prompts and responses encrypted in transit
- **TEE isolation**: Inference runs in hardware-secured enclaves
- **No data retention**: Maple cannot access or store conversation data
- **Attestation verification**: Maple Proxy verifies TEE authenticity
- **Open source**: Security teams can audit the encryption implementation
