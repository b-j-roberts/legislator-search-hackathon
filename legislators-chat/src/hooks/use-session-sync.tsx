"use client";

import * as React from "react";
import { useChat } from "./use-chat";
import { useContact } from "./use-contact";

/**
 * Hook that synchronizes chat conversation ID with contact state.
 *
 * This ensures session isolation by:
 * 1. Tracking when the active conversation changes
 * 2. Resetting contact state when switching to a different conversation
 * 3. Maintaining isolation between different research sessions
 *
 * Usage: Call this hook in a component that's rendered when chat and contact
 * contexts are both available (e.g., the main chat page).
 */
export function useSessionSync() {
  const { conversationId } = useChat();
  const { currentConversationId, setCurrentConversationId, isQueueForCurrentConversation } = useContact();

  // Sync conversation ID when it changes
  React.useEffect(() => {
    if (conversationId !== currentConversationId) {
      console.log("[SessionSync] Conversation ID changed:", {
        from: currentConversationId,
        to: conversationId,
      });
      setCurrentConversationId(conversationId ?? null);
    }
  }, [conversationId, currentConversationId, setCurrentConversationId]);

  return {
    /** Current conversation ID */
    conversationId,
    /** Whether the contact queue belongs to the current conversation */
    isQueueForCurrentConversation,
  };
}
