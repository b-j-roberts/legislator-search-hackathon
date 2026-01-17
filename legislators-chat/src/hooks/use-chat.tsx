"use client";

import * as React from "react";
import type {
  ChatMessage,
  ChatResponse,
  ChatState,
  MessageRole,
} from "@/lib/types";

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = "legislators-chat-history";
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

// =============================================================================
// Types
// =============================================================================

interface ChatContextValue extends ChatState {
  /** Send a new message */
  sendMessage: (content: string) => Promise<void>;
  /** Retry a failed message */
  retryMessage: (messageId: string) => Promise<void>;
  /** Clear all messages */
  clearMessages: () => void;
  /** Clear error state */
  clearError: () => void;
}

type ChatAction =
  | { type: "ADD_USER_MESSAGE"; payload: ChatMessage }
  | { type: "ADD_ASSISTANT_MESSAGE"; payload: ChatMessage }
  | { type: "UPDATE_MESSAGE"; payload: { id: string; updates: Partial<ChatMessage> } }
  | { type: "SET_LOADING"; payload: boolean }
  | { type: "SET_ERROR"; payload: string | null }
  | { type: "SET_CONVERSATION_ID"; payload: string }
  | { type: "CLEAR_MESSAGES" }
  | { type: "LOAD_MESSAGES"; payload: ChatMessage[] };

// =============================================================================
// Utilities
// =============================================================================

/** Generate a unique message ID */
function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Generate a unique conversation ID */
function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Load messages from localStorage */
function loadMessagesFromStorage(): ChatMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const parsed = JSON.parse(stored);
    if (Array.isArray(parsed)) {
      return parsed;
    }
    return [];
  } catch {
    console.warn("Failed to load chat history from localStorage");
    return [];
  }
}

/** Save messages to localStorage */
function saveMessagesToStorage(messages: ChatMessage[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch {
    console.warn("Failed to save chat history to localStorage");
  }
}

/** Sleep utility for retry delays */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// =============================================================================
// Reducer
// =============================================================================

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case "ADD_USER_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case "ADD_ASSISTANT_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.payload],
      };

    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.payload.id
            ? { ...msg, ...action.payload.updates }
            : msg
        ),
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

    case "SET_CONVERSATION_ID":
      return {
        ...state,
        conversationId: action.payload,
      };

    case "CLEAR_MESSAGES":
      return {
        ...state,
        messages: [],
        conversationId: undefined,
        error: null,
      };

    case "LOAD_MESSAGES":
      return {
        ...state,
        messages: action.payload,
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
    messages: [],
    isLoading: false,
    error: null,
  });

  // Load messages from localStorage on mount
  React.useEffect(() => {
    const storedMessages = loadMessagesFromStorage();
    if (storedMessages.length > 0) {
      dispatch({ type: "LOAD_MESSAGES", payload: storedMessages });
    }
  }, []);

  // Persist messages to localStorage when they change
  React.useEffect(() => {
    saveMessagesToStorage(state.messages);
  }, [state.messages]);

  /**
   * Send a message to the chat API
   */
  const sendMessage = React.useCallback(
    async (content: string) => {
      // Generate conversation ID if this is the first message
      if (!state.conversationId) {
        dispatch({ type: "SET_CONVERSATION_ID", payload: generateConversationId() });
      }

      // Create user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
        status: "sent",
      };

      dispatch({ type: "ADD_USER_MESSAGE", payload: userMessage });
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        // Build context from previous messages
        const previousMessages: Array<{ role: MessageRole; content: string }> =
          state.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

        // Call the chat API
        const response = await sendChatRequest(
          content,
          state.conversationId,
          previousMessages
        );

        // Add assistant message with response
        const assistantMessage: ChatMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: response.message,
          timestamp: new Date().toISOString(),
          status: "sent",
          legislators: response.legislators,
          documents: response.documents,
          votes: response.votes,
          hearings: response.hearings,
          report: response.report,
          sources: response.sources,
          confidence: response.confidence,
        };

        dispatch({ type: "ADD_ASSISTANT_MESSAGE", payload: assistantMessage });
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to send message";

        // Add failed assistant message for retry capability
        const failedMessage: ChatMessage = {
          id: generateMessageId(),
          role: "assistant",
          content: "",
          timestamp: new Date().toISOString(),
          status: "error",
          error: errorMessage,
        };

        dispatch({ type: "ADD_ASSISTANT_MESSAGE", payload: failedMessage });
        dispatch({ type: "SET_ERROR", payload: errorMessage });
      } finally {
        dispatch({ type: "SET_LOADING", payload: false });
      }
    },
    [state.conversationId, state.messages]
  );

  /**
   * Retry a failed message
   */
  const retryMessage = React.useCallback(
    async (messageId: string) => {
      // Find the failed message
      const messageIndex = state.messages.findIndex(
        (msg) => msg.id === messageId
      );

      if (messageIndex === -1) {
        console.warn(`Message ${messageId} not found`);
        return;
      }

      const message = state.messages[messageIndex];

      if (message.status !== "error") {
        console.warn(`Message ${messageId} is not in error state`);
        return;
      }

      // Find the user message that triggered this response
      // It should be the message right before this one
      let userMessage: ChatMessage | undefined;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (state.messages[i].role === "user") {
          userMessage = state.messages[i];
          break;
        }
      }

      if (!userMessage) {
        console.warn("Could not find user message to retry");
        return;
      }

      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });
      dispatch({
        type: "UPDATE_MESSAGE",
        payload: {
          id: messageId,
          updates: { status: "sending", error: undefined },
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
          const previousMessages: Array<{ role: MessageRole; content: string }> =
            state.messages.slice(0, messageIndex - 1).map((msg) => ({
              role: msg.role,
              content: msg.content,
            }));

          const response = await sendChatRequest(
            userMessage.content,
            state.conversationId,
            previousMessages
          );

          dispatch({
            type: "UPDATE_MESSAGE",
            payload: {
              id: messageId,
              updates: {
                content: response.message,
                status: "sent",
                legislators: response.legislators,
                documents: response.documents,
                votes: response.votes,
                hearings: response.hearings,
                report: response.report,
                sources: response.sources,
                confidence: response.confidence,
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
          id: messageId,
          updates: {
            status: "error",
            error: errorMessage,
          },
        },
      });
      dispatch({ type: "SET_ERROR", payload: errorMessage });
      dispatch({ type: "SET_LOADING", payload: false });
    },
    [state.messages, state.conversationId]
  );

  /**
   * Clear all messages
   */
  const clearMessages = React.useCallback(() => {
    dispatch({ type: "CLEAR_MESSAGES" });
    if (typeof window !== "undefined") {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  /**
   * Clear error state
   */
  const clearError = React.useCallback(() => {
    dispatch({ type: "SET_ERROR", payload: null });
  }, []);

  const value: ChatContextValue = {
    ...state,
    sendMessage,
    retryMessage,
    clearMessages,
    clearError,
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

// =============================================================================
// API Client (placeholder)
// =============================================================================

/**
 * Send a chat request to the backend API
 *
 * TODO: Replace with actual API client when Phase 1.4 is implemented
 */
async function sendChatRequest(
  message: string,
  conversationId?: string,
  previousMessages?: Array<{ role: MessageRole; content: string }>
): Promise<ChatResponse> {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;

  // If no API URL is configured, use simulated response
  if (!apiUrl) {
    return simulatedResponse(message);
  }

  const response = await fetch(`${apiUrl}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message,
      conversationId,
      context: {
        previousMessages,
      },
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.error?.message || `API error: ${response.status}`
    );
  }

  return response.json();
}

/**
 * Simulated response for development/demo
 */
async function simulatedResponse(message: string): Promise<ChatResponse> {
  // Simulate network delay
  await sleep(1000 + Math.random() * 500);

  // Randomly fail sometimes to test error handling (10% chance)
  if (Math.random() < 0.1) {
    throw new Error("Simulated network error");
  }

  const truncatedMessage =
    message.length > 50 ? `${message.slice(0, 50)}...` : message;

  return {
    message: `I'm researching your question about "${truncatedMessage}". This is a simulated response - the actual API integration will provide real legislator data, voting records, and hearing information.`,
    sources: ["Simulated data"],
    confidence: 0.85,
  };
}
