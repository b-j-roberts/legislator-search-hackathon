"use client";

import * as React from "react";
import type { ChatMessage, Conversation, ConversationsStorage, MessageRole } from "@/lib/types";
import { sendChatMessageStream, ApiClientError } from "@/lib/api";
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

// =============================================================================
// Constants
// =============================================================================

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 1000;

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
   * Send a message to the chat API with streaming support
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

      // Create placeholder assistant message for streaming
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
        const previousMessages: Array<{ role: MessageRole; content: string }> = (
          currentConv?.messages || []
        ).map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

        let streamedContent = "";

        // Call the streaming API
        await sendChatMessageStream(
          {
            message: content,
            conversationId: currentConversationId,
            context: { previousMessages },
          },
          (chunk, done) => {
            if (done) {
              // Mark message as complete
              dispatch({
                type: "UPDATE_MESSAGE",
                payload: {
                  conversationId: currentConversationId!,
                  messageId: assistantMessageId,
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
                  conversationId: currentConversationId!,
                  messageId: assistantMessageId,
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
   * Retry a failed message
   */
  const retryMessage = React.useCallback(
    async (messageId: string) => {
      const currentConversationId = state.storage.activeConversationId;
      if (!currentConversationId) return;

      const conversation = state.storage.conversations.find((c) => c.id === currentConversationId);
      if (!conversation) return;

      // Find the failed message
      const messageIndex = conversation.messages.findIndex((msg) => msg.id === messageId);

      if (messageIndex === -1) {
        console.warn(`Message ${messageId} not found`);
        return;
      }

      const message = conversation.messages[messageIndex];

      if (message.status !== "error") {
        console.warn(`Message ${messageId} is not in error state`);
        return;
      }

      // Find the user message that triggered this response
      let userMessage: ChatMessage | undefined;
      for (let i = messageIndex - 1; i >= 0; i--) {
        if (conversation.messages[i].role === "user") {
          userMessage = conversation.messages[i];
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
          conversationId: currentConversationId,
          messageId,
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
            conversation.messages.slice(0, messageIndex - 1).map((msg) => ({
              role: msg.role,
              content: msg.content,
            }));

          let streamedContent = "";

          await sendChatMessageStream(
            {
              message: userMessage.content,
              conversationId: currentConversationId,
              context: { previousMessages },
            },
            (chunk, done) => {
              if (done) {
                dispatch({
                  type: "UPDATE_MESSAGE",
                  payload: {
                    conversationId: currentConversationId,
                    messageId,
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
                    conversationId: currentConversationId,
                    messageId,
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
