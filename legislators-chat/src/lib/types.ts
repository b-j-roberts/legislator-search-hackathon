/**
 * Type definitions for Legislators Chat
 *
 * Shared TypeScript interfaces for all data models used across the application.
 * Component-specific types should live with their components.
 */

// =============================================================================
// Base Types
// =============================================================================

/** Political party affiliation */
export type Party = "D" | "R" | "I";

/** Congressional chamber */
export type Chamber = "House" | "Senate";

/** Legislator stance on a topic */
export type Stance = "for" | "against" | "mixed" | "unknown";

/** US State abbreviation */
export type StateAbbreviation =
  | "AL"
  | "AK"
  | "AZ"
  | "AR"
  | "CA"
  | "CO"
  | "CT"
  | "DE"
  | "FL"
  | "GA"
  | "HI"
  | "ID"
  | "IL"
  | "IN"
  | "IA"
  | "KS"
  | "KY"
  | "LA"
  | "ME"
  | "MD"
  | "MA"
  | "MI"
  | "MN"
  | "MS"
  | "MO"
  | "MT"
  | "NE"
  | "NV"
  | "NH"
  | "NJ"
  | "NM"
  | "NY"
  | "NC"
  | "ND"
  | "OH"
  | "OK"
  | "OR"
  | "PA"
  | "RI"
  | "SC"
  | "SD"
  | "TN"
  | "TX"
  | "UT"
  | "VT"
  | "VA"
  | "WA"
  | "WV"
  | "WI"
  | "WY"
  | "DC"
  | "PR"
  | "GU"
  | "VI"
  | "AS"
  | "MP";

// =============================================================================
// Contact Information
// =============================================================================

/** Social media handles */
export interface SocialMedia {
  twitter?: string;
  facebook?: string;
  instagram?: string;
  youtube?: string;
}

/** Contact information for a legislator */
export interface ContactInfo {
  phone?: string;
  email?: string;
  website?: string;
  office?: string;
  socialMedia?: SocialMedia;
}

// =============================================================================
// Legislator Types
// =============================================================================

/** Summary of a legislator's vote on a specific bill/issue */
export interface VoteSummary {
  id: string;
  billId: string;
  billTitle: string;
  vote: "yea" | "nay" | "present" | "not_voting";
  date: string;
  description?: string;
}

/** A statement made by a legislator */
export interface Statement {
  id: string;
  date: string;
  source: string;
  text: string;
  url?: string;
  context?: string;
}

/** Full legislator information */
export interface Legislator {
  id: string;
  name: string;
  party: Party;
  chamber: Chamber;
  state: StateAbbreviation;
  district?: string;

  /** Stance on the queried topic */
  stance: Stance;
  stanceSummary: string;

  /** Contact information */
  contact: ContactInfo;

  /** Relevant voting record for the topic */
  relevantVotes?: VoteSummary[];

  /** Relevant public statements */
  relevantStatements?: Statement[];

  /** Profile image URL */
  imageUrl?: string;

  /** Date they took office */
  termStart?: string;

  /** Next election date */
  nextElection?: string;
}

// =============================================================================
// Document Types
// =============================================================================

/** Type of document */
export type DocumentType = "hearing" | "bill" | "vote" | "statement" | "transcript";

/** A document from congressional records */
export interface Document {
  id: string;
  type: DocumentType;
  title: string;
  date: string;
  summary: string;
  url?: string;
  relevance: number;
}

/** A congressional hearing */
export interface Hearing {
  id: string;
  title: string;
  date: string;
  committee: string;
  subcommittee?: string;
  summary: string;
  witnesses?: string[];
  transcript?: string;
  videoUrl?: string;
  url?: string;
  relevance: number;
}

/** A recorded vote */
export interface VoteRecord {
  id: string;
  billId: string;
  billTitle: string;
  date: string;
  chamber: Chamber;
  result: "passed" | "failed";
  yeas: number;
  nays: number;
  present: number;
  notVoting: number;
  description?: string;
  url?: string;
  relevance: number;
}

// =============================================================================
// Report Types
// =============================================================================

/** Generated advocacy report */
export interface Report {
  id: string;
  title: string;
  generatedAt: string;
  topic: string;
  summary: string;
  legislators: Legislator[];
  documents: Document[];
  recommendations: string[];
  exportUrl?: string;
}

// =============================================================================
// Chat Types
// =============================================================================

/** Role of a message sender */
export type MessageRole = "user" | "assistant" | "system";

/** Status of a chat message */
export type MessageStatus = "sending" | "sent" | "error";

/** A single chat message */
export interface ChatMessage {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: string;
  status?: MessageStatus;

  /** Structured data returned with AI responses */
  legislators?: Legislator[];
  documents?: Document[];
  votes?: VoteRecord[];
  hearings?: Hearing[];
  report?: Report;

  /** Sources used to generate the response */
  sources?: string[];

  /** Confidence score for the response */
  confidence?: number;

  /** Error message if status is 'error' */
  error?: string;
}

/** Response from the chat API */
export interface ChatResponse {
  /** AI-generated conversational response */
  message: string;

  /** Structured data for UI components */
  legislators?: Legislator[];
  documents?: Document[];
  votes?: VoteRecord[];
  hearings?: Hearing[];

  /** Report generation (when requested) */
  report?: Report;

  /** Metadata */
  sources: string[];
  confidence: number;
}

/** Request to the chat API */
export interface ChatRequest {
  message: string;
  conversationId?: string;
  context?: {
    previousMessages?: Array<{ role: MessageRole; content: string }>;
    filters?: Filter[];
  };
}

// =============================================================================
// Conversation Types
// =============================================================================

/** A saved conversation */
export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

/** Storage format for conversations */
export interface ConversationsStorage {
  conversations: Conversation[];
  activeConversationId: string | null;
  version: number;
}

// =============================================================================
// State Management Types
// =============================================================================

/** Chat state for context/store */
export interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  conversationId?: string;
}

/** Filter options for results */
export interface Filter {
  type: "party" | "chamber" | "state" | "stance";
  value: string;
}

/** Sort options for results */
export type SortOption = "relevance" | "name" | "state" | "party" | "date";

/** Results state for filtering/sorting */
export interface ResultsState {
  legislators: Legislator[];
  documents: Document[];
  hearings: Hearing[];
  votes: VoteRecord[];
  activeFilters: Filter[];
  sortBy: SortOption;
}

// =============================================================================
// API Types
// =============================================================================

/** Generic API response wrapper */
export interface ApiResponse<T> {
  data: T;
  success: boolean;
  error?: ApiError;
}

/** API error structure */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
  };
}

/** Search parameters for API requests */
export interface SearchParams {
  query: string;
  filters?: Filter[];
  sortBy?: SortOption;
  page?: number;
  pageSize?: number;
}

// =============================================================================
// UI State Types
// =============================================================================

/** Loading state for async operations */
export type LoadingState = "idle" | "loading" | "success" | "error";

/** Panel visibility state */
export interface PanelState {
  resultsOpen: boolean;
  sidebarOpen: boolean;
}

/** Theme preference */
export type Theme = "light" | "dark" | "system";

// =============================================================================
// Contact Method Types
// =============================================================================

/** Preferred method for contacting a legislator */
export type ContactMethod = "call" | "email";

/** Contact availability for a legislator */
export interface ContactAvailability {
  /** Whether phone contact is available */
  hasPhone: boolean;
  /** Whether email contact is available */
  hasEmail: boolean;
  /** Office hours note (e.g., "9AM-5PM EST") */
  phoneHours?: string;
}
