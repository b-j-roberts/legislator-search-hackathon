"use client";

import * as React from "react";
import type { ChatMessage, Conversation, ConversationsStorage, MessageRole, SearchResultData } from "@/lib/types";
import { ApiClientError } from "@/lib/api";
import {
  loadConversations,
  saveConversations,
  createConversation,
  deleteConversation as deleteConv,
  setActiveConversation,
  addMessageToConversation,
  updateMessageInConversation,
  generateMessageId,
  getActiveConversation,
} from "@/lib/conversation-storage";
import { parseAIResponse, toSearchParams, hasSearchIntent, buildCorrectionPrompt } from "@/lib/parse-ai-response";
import { searchContent, type SearchResult } from "@/lib/search-service";
import { buildSearchSystemPrompt, buildSearchResultsPrompt, type SearchResultForPrompt, type SearchResultsMetadata } from "@/lib/prompts/search-system";

// =============================================================================
// Constants
// =============================================================================

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;
const MAX_SEARCH_RETRIES = 2;

// =============================================================================
// Orchestration Helpers
// =============================================================================

interface OrchestrationMessage {
  role: MessageRole;
  content: string;
}

/**
 * Send a message to the orchestrated chat API (non-streaming)
 */
async function sendOrchestrationMessage(
  message: string,
  previousMessages: OrchestrationMessage[] = [],
  systemPrompt?: string
): Promise<string> {
  const response = await fetch("/api/chat/orchestrated", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message,
      context: {
        previousMessages,
        systemPrompt,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  return data.content || "";
}

/**
 * Convert SearchResult to SearchResultForPrompt for building result prompts
 */
function toSearchResultForPrompt(result: SearchResult): SearchResultForPrompt {
  return {
    content_type: result.content_type,
    title: result.title,
    date: result.date,
    speaker_name: result.speaker_name,
    chamber: result.chamber,
    committee: result.committee,
    text: result.text,
    source_url: result.source_url,
  };
}

/**
 * Convert SearchResult to SearchResultData for storing in messages
 */
function toSearchResultData(result: SearchResult): SearchResultData {
  return {
    content_id: result.content_id,
    content_type: result.content_type,
    segment_index: result.segment_index,
    text: result.text,
    title: result.title,
    date: result.date,
    speaker_name: result.speaker_name,
    source_url: result.source_url,
    chamber: result.chamber,
    committee: result.committee,
  };
}

// =============================================================================
// Types
// =============================================================================

interface ChatContextValue {
  /** Current messages */
  messages: ChatMessage[];
  /** Loading state */
  isLoading: boolean;
  /** Error message */
  error: string | null;
  /** Current conversation ID */
  conversationId: string | undefined;
  /** All conversations */
  conversations: Conversation[];
  /** Active conversation */
  activeConversation: Conversation | undefined;
  /** Send a new message */
  sendMessage: (content: string) => Promise<void>;
  /** Retry a failed message */
  retryMessage: (messageId: string) => Promise<void>;
  /** Clear current conversation messages */
  clearMessages: () => void;
  /** Clear error state */
  clearError: () => void;
  /** Create a new conversation */
  newConversation: () => void;
  /** Switch to a different conversation */
  switchConversation: (id: string) => void;
  /** Delete a conversation */
  deleteConversation: (id: string) => void;
  /** Rename a conversation */
  renameConversation: (id: string, title: string) => void;
  /** Sidebar open state */
  isSidebarOpen: boolean;
  /** Toggle sidebar */
  toggleSidebar: () => void;
  /** Set sidebar state */
  setSidebarOpen: (open: boolean) => void;
}

type ChatAction =
  | { type: "LOAD_STORAGE"; payload: ConversationsStorage }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "ADD_MESSAGE"; payload: { conversationId: string; message: ChatMessage } }
  | {
      type: "UPDATE_MESSAGE";
      payload: { conversationId: string; messageId: string; updates: Partial<ChatMessage> };
    }
  | { type: "NEW_CONVERSATION"; payload: Conversation }
  | { type: "SWITCH_CONVERSATION"; payload: string }
  | { type: "DELETE_CONVERSATION"; payload: string }
  | { type: "RENAME_CONVERSATION"; payload: { id: string; title: string } }
  | { type: "CLEAR_MESSAGES" }
  | { type: "TOGGLE_SIDEBAR" }
  | { type: "SET_SIDEBAR"; payload: boolean };

interface ChatState {
  storage: ConversationsStorage;
  isLoading: boolean;
  error: string | null;
  isSidebarOpen: boolean;
}

// =============================================================================
// Utilities
// =============================================================================

/** Sleep utility for retry delays */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Reducer
// =============================================================================

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "LOAD_STORAGE":
      return {
        ...state,
        storage: action.payload,
      };

    case "SET_LOADING":
      return {
        ...state,
        isLoading: action.payload,
      };

    case "SET_ERROR":
      return {
        ...state,
        error: action.payload,
      };

    case "ADD_MESSAGE": {
      const newStorage = addMessageToConversation(
        state.storage,
        action.payload.conversationId,
        action.payload.message
      );
      return {
        ...state,
        storage: newStorage,
      };
    }

    case "UPDATE_MESSAGE": {
      const newStorage = updateMessageInConversation(
        state.storage,
        action.payload.conversationId,
        action.payload.messageId,
        action.payload.updates
      );
      return {
        ...state,
        storage: newStorage,
      };
    }

    case "NEW_CONVERSATION": {
      return {
        ...state,
        storage: {
          ...state.storage,
          conversations: [action.payload, ...state.storage.conversations],
          activeConversationId: action.payload.id,
        },
      };
    }

    case "SWITCH_CONVERSATION": {
      return {
        ...state,
        storage: setActiveConversation(state.storage, action.payload),
        error: null,
      };
    }

    case "DELETE_CONVERSATION": {
      return {
        ...state,
        storage: deleteConv(state.storage, action.payload),
      };
    }

    case "RENAME_CONVERSATION": {
      return {
        ...state,
        storage: {
          ...state.storage,
          conversations: state.storage.conversations.map((c) =>
            c.id === action.payload.id
              ? { ...c, title: action.payload.title, updatedAt: new Date().toISOString() }
              : c
          ),
        },
      };
    }

    case "CLEAR_MESSAGES": {
      const activeId = state.storage.activeConversationId;
      if (!activeId) return state;

      return {
        ...state,
        storage: {
          ...state.storage,
          conversations: state.storage.conversations.map((c) =>
            c.id === activeId
              ? {
                  ...c,
                  messages: [],
                  title: "New Conversation",
                  updatedAt: new Date().toISOString(),
                }
              : c
          ),
        },
        error: null,
      };
    }

    case "TOGGLE_SIDEBAR":
      return {
        ...state,
        isSidebarOpen: !state.isSidebarOpen,
      };

    case "SET_SIDEBAR":
      return {
        ...state,
        isSidebarOpen: action.payload,
      };

    default:
      return state;
  }
}

// =============================================================================
// Context
// =============================================================================

const ChatContext = React.createContext<ChatContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface ChatProviderProps {
  children: React.ReactNode;
}

export function ChatProvider({ children }: ChatProviderProps) {
  const [state, dispatch] = React.useReducer(chatReducer, {
    storage: {
      conversations: [],
      activeConversationId: null,
      version: 1,
    },
    isLoading: false,
    error: null,
    isSidebarOpen: false,
  });

  // Load conversations from localStorage on mount
  React.useEffect(() => {
    const loaded = loadConversations();
    dispatch({ type: "LOAD_STORAGE", payload: loaded });
  }, []);

  // Persist conversations to localStorage when they change
  React.useEffect(() => {
    // Only save if we have conversations (avoid saving on initial load)
    if (state.storage.conversations.length > 0 || state.storage.activeConversationId) {
      saveConversations(state.storage);
    }
  }, [state.storage]);

  // Derived state
  const activeConversation = getActiveConversation(state.storage);
  const messages = activeConversation?.messages || [];
  const conversationId = state.storage.activeConversationId || undefined;

  /**
   * Send a message using the search orchestration flow
   *
   * Flow:
   * 1. Send user message to Maple AI with search system prompt
   * 2. Parse response for JSON search blocks
   * 3. If search found, call PolSearch API
   * 4. Feed results back to Maple for synthesis
   * 5. Return final response with search results attached
   */
  const sendMessage = React.useCallback(
    async (content: string) => {
      // Create a new conversation if we don't have one
      let currentConversationId = state.storage.activeConversationId;

      if (!currentConversationId) {
        const { conversation } = createConversation(state.storage);
        dispatch({ type: "NEW_CONVERSATION", payload: conversation });
        currentConversationId = conversation.id;
      }

      // Create user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
        status: "sent",
      };

      // Create placeholder assistant message
      const assistantMessageId = generateMessageId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        status: "sending",
      };

      dispatch({
        type: "ADD_MESSAGE",
        payload: { conversationId: currentConversationId, message: userMessage },
      });
      dispatch({
        type: "ADD_MESSAGE",
        payload: { conversationId: currentConversationId, message: assistantMessage },
      });
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        // Build context from previous messages
        const currentConv = state.storage.conversations.find((c) => c.id === currentConversationId);
        const previousMessages: OrchestrationMessage[] = (currentConv?.messages || []).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        // Track orchestration state
        const conversation: OrchestrationMessage[] = [...previousMessages];
        let retryCount = 0;
        let lastResponse = "";
        let searchResults: SearchResult[] | null = null;

        // Step 1: Send initial message to Maple with search system prompt
        const systemPrompt = buildSearchSystemPrompt();

        // Update UI to show analyzing
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            conversationId: currentConversationId!,
            messageId: assistantMessageId,
            updates: { content: "Analyzing your question..." },
          },
        });

        lastResponse = await sendOrchestrationMessage(content, conversation, systemPrompt);

        // Add user message to conversation history
        conversation.push({ role: "user", content });

        // Step 2: Parse response for search JSON
        let parseResult = parseAIResponse(lastResponse);

        // Retry loop for malformed JSON
        while (!parseResult.hasSearchAction && parseResult.parseError && retryCount < MAX_SEARCH_RETRIES) {
          if (!hasSearchIntent(lastResponse)) {
            break;
          }

          retryCount++;
          console.log(`Retry ${retryCount}/${MAX_SEARCH_RETRIES}: Requesting corrected JSON format`);

          conversation.push({ role: "assistant", content: lastResponse });
          const correctionPrompt = buildCorrectionPrompt(lastResponse, parseResult.parseError);

          lastResponse = await sendOrchestrationMessage(correctionPrompt, conversation, systemPrompt);
          parseResult = parseAIResponse(lastResponse);
        }

        // Step 3: Execute search if JSON was found
        if (parseResult.hasSearchAction && parseResult.searchAction) {
          const searchQuery = parseResult.searchAction.params.q;

          // Update UI to show searching
          dispatch({
            type: "UPDATE_MESSAGE",
            payload: {
              conversationId: currentConversationId!,
              messageId: assistantMessageId,
              updates: { content: `Searching congressional records for "${searchQuery}"...` },
            },
          });

          try {
            const searchParams = toSearchParams(parseResult.searchAction.params);
            const searchResponse = await searchContent(searchParams);
            searchResults = searchResponse.results;

            // Step 4: Feed results back to Maple for synthesis
            dispatch({
              type: "UPDATE_MESSAGE",
              payload: {
                conversationId: currentConversationId!,
                messageId: assistantMessageId,
                updates: { content: `Found ${searchResults.length} results. Synthesizing information...` },
              },
            });

            // Build the results prompt
            const resultsMetadata: SearchResultsMetadata = {
              query: searchResponse.query,
              totalReturned: searchResponse.total_returned,
              hasMore: searchResponse.has_more,
            };

            const resultsPrompt = buildSearchResultsPrompt(
              searchResults.map(toSearchResultForPrompt),
              resultsMetadata
            );

            // Add the AI's search decision to conversation
            conversation.push({ role: "assistant", content: lastResponse });

            // Send results for synthesis (without search prompt to get natural response)
            lastResponse = await sendOrchestrationMessage(resultsPrompt, conversation);
          } catch (searchError) {
            // Search failed - inform Maple and get a graceful response
            console.error("Search execution failed:", searchError);

            const errorMessage = searchError instanceof Error
              ? searchError.message
              : "The search service is temporarily unavailable.";

            conversation.push({ role: "assistant", content: lastResponse });

            lastResponse = await sendOrchestrationMessage(
              `[SEARCH_ERROR] The search could not be completed: ${errorMessage}. Please provide a helpful response based on your knowledge.`,
              conversation
            );
          }
        }

        // Step 5: Update message with final response and search results
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            conversationId: currentConversationId!,
            messageId: assistantMessageId,
            updates: {
              content: lastResponse,
              status: "sent",
              searchResults: searchResults ? searchResults.map(toSearchResultData) : undefined,
              sources: [],
              confidence: 0,
            },
          },
        });
      } catch (error) {
        const errorMessage =
          error instanceof ApiClientError
            ? error.message
            : error instanceof Error
              ? error.message
              : "Failed to send message";

        // Update the assistant message to error state
        dispatch({
          type: "UPDATE_MESSAGE",
          payload: {
            conversationId: currentConversationId!,
            messageId: assistantMessageId,
            updates: {
              status: "error",
              error: errorMessage,
            },
          },
        });
        dispatch({ type: "SET_ERROR", payload: errorMessage });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [state.storage]
  );

  /**
   * Retry a failed message using orchestration flow
   */
  const retryMessage = React.useCallback(
    async (messageId: string) => {
      const currentConversationId = state.storage.activeConversationId;
      if (!currentConversationId) return;

      const conv = state.storage.conversations.find((c) => c.id === currentConversationId);
      if (!conv) return;

      // Find the failed message
      const messageIndex = conv.messages.findIndex((msg) => msg.id === messageId);

      if (messageIndex === -1) {
        console.warn(`Message ${messageId} not found`);
        return;
      }

      const message = conv.messages[messageIndex];

      if (message.status !== "error") {
        console.warn(`Message ${messageId} is not in error state`);
        return;
      }

      // Find the user message that triggered this response
      let userMsg: ChatMessage | undefined;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (conv.messages[i].role === "user") {
          userMsg = conv.messages[i];
          break;
        }
      }

      if (!userMsg) {
        console.warn("Could not find user message to retry");
        return;
      }

      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          conversationId: currentConversationId,
          messageId,
          updates: { status: "sending", error: undefined, content: "Retrying..." },
        },
      });

      // Retry with exponential backoff
      let lastError: Error | undefined;

      for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
        try {
          if (attempt > 0) {
            await sleep(RETRY_DELAY_MS * Math.pow(2, attempt - 1));
          }

          // Build context from messages up to the user message
          const previousMessages: OrchestrationMessage[] = conv.messages
            .slice(0, messageIndex - 1)
            .map((msg) => ({
              role: msg.role,
              content: msg.content,
            }));

          // Run orchestration flow
          const orchestrationConversation: OrchestrationMessage[] = [...previousMessages];
          let retryCount = 0;
          let lastResponse = "";
          let searchResults: SearchResult[] | null = null;

          const systemPrompt = buildSearchSystemPrompt();

          dispatch({
            type: "UPDATE_MESSAGE",
            payload: {
              conversationId: currentConversationId,
              messageId,
              updates: { content: "Analyzing your question..." },
            },
          });

          lastResponse = await sendOrchestrationMessage(userMsg.content, orchestrationConversation, systemPrompt);
          orchestrationConversation.push({ role: "user", content: userMsg.content });

          let parseResult = parseAIResponse(lastResponse);

          while (!parseResult.hasSearchAction && parseResult.parseError && retryCount < MAX_SEARCH_RETRIES) {
            if (!hasSearchIntent(lastResponse)) break;
            retryCount++;
            orchestrationConversation.push({ role: "assistant", content: lastResponse });
            const correctionPrompt = buildCorrectionPrompt(lastResponse, parseResult.parseError);
            lastResponse = await sendOrchestrationMessage(correctionPrompt, orchestrationConversation, systemPrompt);
            parseResult = parseAIResponse(lastResponse);
          }

          if (parseResult.hasSearchAction && parseResult.searchAction) {
            const searchQuery = parseResult.searchAction.params.q;

            dispatch({
              type: "UPDATE_MESSAGE",
              payload: {
                conversationId: currentConversationId,
                messageId,
                updates: { content: `Searching for "${searchQuery}"...` },
              },
            });

            try {
              const searchParams = toSearchParams(parseResult.searchAction.params);
              const searchResponse = await searchContent(searchParams);
              searchResults = searchResponse.results;

              dispatch({
                type: "UPDATE_MESSAGE",
                payload: {
                  conversationId: currentConversationId,
                  messageId,
                  updates: { content: `Found ${searchResults.length} results. Synthesizing...` },
                },
              });

              const resultsMetadata: SearchResultsMetadata = {
                query: searchResponse.query,
                totalReturned: searchResponse.total_returned,
                hasMore: searchResponse.has_more,
              };

              const resultsPrompt = buildSearchResultsPrompt(
                searchResults.map(toSearchResultForPrompt),
                resultsMetadata
              );

              orchestrationConversation.push({ role: "assistant", content: lastResponse });
              lastResponse = await sendOrchestrationMessage(resultsPrompt, orchestrationConversation);
            } catch (searchError) {
              console.error("Search failed during retry:", searchError);
              orchestrationConversation.push({ role: "assistant", content: lastResponse });
              lastResponse = await sendOrchestrationMessage(
                `[SEARCH_ERROR] Search failed. Please provide a helpful response based on your knowledge.`,
                orchestrationConversation
              );
            }
          }

          dispatch({
            type: "UPDATE_MESSAGE",
            payload: {
              conversationId: currentConversationId,
              messageId,
              updates: {
                content: lastResponse,
                status: "sent",
                searchResults: searchResults ? searchResults.map(toSearchResultData) : undefined,
                sources: [],
                confidence: 0,
                error: undefined,
              },
            },
          });

          dispatch({ type: "SET_LOADING", payload: false });
          return;
        } catch (error) {
          lastError = error instanceof Error ? error : new Error(String(error));
        }
      }

      // All retries failed
      const errorMessage = lastError?.message || "Failed after multiple retries";
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          conversationId: currentConversationId,
          messageId,
          updates: {
            status: "error",
            error: errorMessage,
          },
        },
      });
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      dispatch({ type: "SET_LOADING", payload: false });
    },
    [state.storage]
  );

  /**
   * Clear current conversation messages
   */
  const clearMessages = React.useCallback(() => {
    dispatch({ type: "CLEAR_MESSAGES" });
  }, []);

  /**
   * Clear error state
   */
  const clearError = React.useCallback(() => {
    dispatch({ type: "SET_ERROR", payload: null });
  }, []);

  /**
   * Create a new conversation
   */
  const newConversation = React.useCallback(() => {
    const { conversation } = createConversation(state.storage);
    dispatch({ type: "NEW_CONVERSATION", payload: conversation });
  }, [state.storage]);

  /**
   * Switch to a different conversation
   */
  const switchConversation = React.useCallback((id: string) => {
    dispatch({ type: "SWITCH_CONVERSATION", payload: id });
  }, []);

  /**
   * Delete a conversation
   */
  const deleteConversation = React.useCallback((id: string) => {
    dispatch({ type: "DELETE_CONVERSATION", payload: id });
  }, []);

  /**
   * Rename a conversation
   */
  const renameConversation = React.useCallback((id: string, title: string) => {
    dispatch({ type: "RENAME_CONVERSATION", payload: { id, title } });
  }, []);

  /**
   * Toggle sidebar
   */
  const toggleSidebar = React.useCallback(() => {
    dispatch({ type: "TOGGLE_SIDEBAR" });
  }, []);

  /**
   * Set sidebar state
   */
  const setSidebarOpen = React.useCallback((open: boolean) => {
    dispatch({ type: "SET_SIDEBAR", payload: open });
  }, []);

  const value: ChatContextValue = {
    messages,
    isLoading: state.isLoading,
    error: state.error,
    conversationId,
    conversations: state.storage.conversations,
    activeConversation,
    sendMessage,
    retryMessage,
    clearMessages,
    clearError,
    newConversation,
    switchConversation,
    deleteConversation,
    renameConversation,
    isSidebarOpen: state.isSidebarOpen,
    toggleSidebar,
    setSidebarOpen,
  };

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

export function useChat(): ChatContextValue {
  const context = React.useContext(ChatContext);

  if (!context) {
    throw new Error("useChat must be used within a ChatProvider");
  }

  return context;
}
