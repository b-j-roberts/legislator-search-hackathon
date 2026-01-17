"use client";

import * as React from "react";
import type {
  ChatMessage,
  ChatState,
  MessageRole,
} from "@/lib/types";
import { sendChatMessageStream, ApiClientError } from "@/lib/api";

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
   * Send a message to the chat API with streaming support
   */
  const sendMessage = React.useCallback(
    async (content: string) => {
      // Generate conversation ID if this is the first message
      const conversationId = state.conversationId || generateConversationId();
      if (!state.conversationId) {
        dispatch({ type: "SET_CONVERSATION_ID", payload: conversationId });
      }

      // Create user message
      const userMessage: ChatMessage = {
        id: generateMessageId(),
        role: "user",
        content,
        timestamp: new Date().toISOString(),
        status: "sent",
      };

      // Create placeholder assistant message for streaming
      const assistantMessageId = generateMessageId();
      const assistantMessage: ChatMessage = {
        id: assistantMessageId,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
        status: "sending",
      };

      dispatch({ type: "ADD_USER_MESSAGE", payload: userMessage });
      dispatch({ type: "ADD_ASSISTANT_MESSAGE", payload: assistantMessage });
      dispatch({ type: "SET_LOADING", payload: true });
      dispatch({ type: "SET_ERROR", payload: null });

      try {
        // Build context from previous messages
        const previousMessages: Array<{ role: MessageRole; content: string }> =
          state.messages.map((msg) => ({
            role: msg.role,
            content: msg.content,
          }));

        let streamedContent = "";

        // Call the streaming API
        await sendChatMessageStream(
          {
            message: content,
            conversationId,
            context: { previousMessages },
          },
          (chunk, done) => {
            if (done) {
              // Mark message as complete
              dispatch({
                type: "UPDATE_MESSAGE",
                payload: {
                  id: assistantMessageId,
                  updates: {
                    status: "sent",
                    sources: [],
                    confidence: 0,
                  },
                },
              });
            } else {
              // Append chunk to content
              streamedContent += chunk;
              dispatch({
                type: "UPDATE_MESSAGE",
                payload: {
                  id: assistantMessageId,
                  updates: { content: streamedContent },
                },
              });
            }
          }
        );
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
            id: assistantMessageId,
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
          updates: { status: "sending", error: undefined, content: "" },
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

          let streamedContent = "";

          await sendChatMessageStream(
            {
              message: userMessage.content,
              conversationId: state.conversationId,
              context: { previousMessages },
            },
            (chunk, done) => {
              if (done) {
                dispatch({
                  type: "UPDATE_MESSAGE",
                  payload: {
                    id: messageId,
                    updates: {
                      status: "sent",
                      sources: [],
                      confidence: 0,
                      error: undefined,
                    },
                  },
                });
              } else {
                streamedContent += chunk;
                dispatch({
                  type: "UPDATE_MESSAGE",
                  payload: {
                    id: messageId,
                    updates: { content: streamedContent },
                  },
                });
              }
            }
          );

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

