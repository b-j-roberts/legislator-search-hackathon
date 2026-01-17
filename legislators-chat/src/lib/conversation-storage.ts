/**
 * Conversation Storage Utilities
 *
 * Handles persistence of chat conversations to localStorage.
 * Includes migration from old single-conversation format.
 */

import type { Conversation, ConversationsStorage, ChatMessage } from "./types";

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = "legislators-chat-conversations";
const OLD_STORAGE_KEY = "legislators-chat-history";
const STORAGE_VERSION = 1;
const MAX_CONVERSATIONS = 50;
const MAX_TITLE_LENGTH = 60;

// =============================================================================
// Utilities
// =============================================================================

/** Generate a unique conversation ID */
export function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Generate a unique message ID */
export function generateMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/** Extract a title from the first user message */
export function generateTitleFromMessage(content: string): string {
  // Remove markdown and special characters
  const cleaned = content
    .replace(/[#*_`~\[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (cleaned.length <= MAX_TITLE_LENGTH) {
    return cleaned || "New Conversation";
  }

  // Truncate at word boundary
  const truncated = cleaned.slice(0, MAX_TITLE_LENGTH);
  const lastSpace = truncated.lastIndexOf(" ");

  if (lastSpace > MAX_TITLE_LENGTH / 2) {
    return truncated.slice(0, lastSpace) + "...";
  }

  return truncated + "...";
}

// =============================================================================
// Storage Operations
// =============================================================================

/** Check if we're in a browser environment */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/** Get the default empty storage state */
function getDefaultStorage(): ConversationsStorage {
  return {
    conversations: [],
    activeConversationId: null,
    version: STORAGE_VERSION,
  };
}

/** Migrate from old single-conversation format */
function migrateFromOldFormat(): ConversationsStorage | null {
  if (!isBrowser()) return null;

  try {
    const oldData = localStorage.getItem(OLD_STORAGE_KEY);
    if (!oldData) return null;

    const oldMessages: ChatMessage[] = JSON.parse(oldData);
    if (!Array.isArray(oldMessages) || oldMessages.length === 0) {
      // Clean up empty old storage
      localStorage.removeItem(OLD_STORAGE_KEY);
      return null;
    }

    // Create a conversation from the old messages
    const firstUserMessage = oldMessages.find((m) => m.role === "user");
    const title = firstUserMessage
      ? generateTitleFromMessage(firstUserMessage.content)
      : "Previous Conversation";

    const conversation: Conversation = {
      id: generateConversationId(),
      title,
      messages: oldMessages,
      createdAt: oldMessages[0]?.timestamp || new Date().toISOString(),
      updatedAt:
        oldMessages[oldMessages.length - 1]?.timestamp ||
        new Date().toISOString(),
    };

    // Clean up old storage
    localStorage.removeItem(OLD_STORAGE_KEY);

    return {
      conversations: [conversation],
      activeConversationId: conversation.id,
      version: STORAGE_VERSION,
    };
  } catch {
    console.warn("Failed to migrate old chat history");
    return null;
  }
}

/** Load conversations from localStorage */
export function loadConversations(): ConversationsStorage {
  if (!isBrowser()) return getDefaultStorage();

  try {
    // Try to load new format first
    const stored = localStorage.getItem(STORAGE_KEY);

    if (stored) {
      const parsed = JSON.parse(stored) as ConversationsStorage;

      // Validate structure
      if (
        parsed &&
        Array.isArray(parsed.conversations) &&
        typeof parsed.version === "number"
      ) {
        return parsed;
      }
    }

    // Try to migrate from old format
    const migrated = migrateFromOldFormat();
    if (migrated) {
      saveConversations(migrated);
      return migrated;
    }

    return getDefaultStorage();
  } catch {
    console.warn("Failed to load conversations from localStorage");
    return getDefaultStorage();
  }
}

/** Save conversations to localStorage */
export function saveConversations(storage: ConversationsStorage): void {
  if (!isBrowser()) return;

  try {
    // Enforce max conversations limit (keep most recent)
    if (storage.conversations.length > MAX_CONVERSATIONS) {
      storage.conversations = storage.conversations
        .sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        )
        .slice(0, MAX_CONVERSATIONS);

      // Ensure active conversation is still in the list
      if (
        storage.activeConversationId &&
        !storage.conversations.find(
          (c) => c.id === storage.activeConversationId
        )
      ) {
        storage.activeConversationId = storage.conversations[0]?.id || null;
      }
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(storage));
  } catch (error) {
    // Handle quota exceeded
    if (
      error instanceof DOMException &&
      (error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED")
    ) {
      console.warn("localStorage quota exceeded, removing oldest conversations");

      // Remove oldest conversations and try again
      const reducedStorage = {
        ...storage,
        conversations: storage.conversations
          .sort(
            (a, b) =>
              new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          )
          .slice(0, Math.floor(storage.conversations.length / 2)),
      };

      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(reducedStorage));
      } catch {
        console.error("Failed to save conversations even after reducing size");
      }
    } else {
      console.warn("Failed to save conversations to localStorage");
    }
  }
}

// =============================================================================
// Conversation CRUD Operations
// =============================================================================

/** Create a new conversation */
export function createConversation(
  storage: ConversationsStorage,
  title?: string
): { storage: ConversationsStorage; conversation: Conversation } {
  const conversation: Conversation = {
    id: generateConversationId(),
    title: title || "New Conversation",
    messages: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const newStorage: ConversationsStorage = {
    ...storage,
    conversations: [conversation, ...storage.conversations],
    activeConversationId: conversation.id,
  };

  return { storage: newStorage, conversation };
}

/** Get a conversation by ID */
export function getConversation(
  storage: ConversationsStorage,
  id: string
): Conversation | undefined {
  return storage.conversations.find((c) => c.id === id);
}

/** Get the active conversation */
export function getActiveConversation(
  storage: ConversationsStorage
): Conversation | undefined {
  if (!storage.activeConversationId) return undefined;
  return getConversation(storage, storage.activeConversationId);
}

/** Update a conversation */
export function updateConversation(
  storage: ConversationsStorage,
  id: string,
  updates: Partial<Omit<Conversation, "id">>
): ConversationsStorage {
  return {
    ...storage,
    conversations: storage.conversations.map((c) =>
      c.id === id
        ? { ...c, ...updates, updatedAt: new Date().toISOString() }
        : c
    ),
  };
}

/** Delete a conversation */
export function deleteConversation(
  storage: ConversationsStorage,
  id: string
): ConversationsStorage {
  const newConversations = storage.conversations.filter((c) => c.id !== id);

  // If we deleted the active conversation, select another one
  let newActiveId = storage.activeConversationId;
  if (storage.activeConversationId === id) {
    newActiveId = newConversations[0]?.id || null;
  }

  return {
    ...storage,
    conversations: newConversations,
    activeConversationId: newActiveId,
  };
}

/** Set the active conversation */
export function setActiveConversation(
  storage: ConversationsStorage,
  id: string | null
): ConversationsStorage {
  return {
    ...storage,
    activeConversationId: id,
  };
}

/** Add a message to a conversation */
export function addMessageToConversation(
  storage: ConversationsStorage,
  conversationId: string,
  message: ChatMessage
): ConversationsStorage {
  return {
    ...storage,
    conversations: storage.conversations.map((c) => {
      if (c.id !== conversationId) return c;

      // Update title if this is the first user message
      let newTitle = c.title;
      if (
        message.role === "user" &&
        !c.messages.some((m) => m.role === "user")
      ) {
        newTitle = generateTitleFromMessage(message.content);
      }

      return {
        ...c,
        title: newTitle,
        messages: [...c.messages, message],
        updatedAt: new Date().toISOString(),
      };
    }),
  };
}

/** Update a message in a conversation */
export function updateMessageInConversation(
  storage: ConversationsStorage,
  conversationId: string,
  messageId: string,
  updates: Partial<ChatMessage>
): ConversationsStorage {
  return {
    ...storage,
    conversations: storage.conversations.map((c) => {
      if (c.id !== conversationId) return c;

      return {
        ...c,
        messages: c.messages.map((m) =>
          m.id === messageId ? { ...m, ...updates } : m
        ),
        updatedAt: new Date().toISOString(),
      };
    }),
  };
}

/** Clear all conversations */
export function clearAllConversations(): ConversationsStorage {
  const storage = getDefaultStorage();
  if (isBrowser()) {
    localStorage.removeItem(STORAGE_KEY);
  }
  return storage;
}
