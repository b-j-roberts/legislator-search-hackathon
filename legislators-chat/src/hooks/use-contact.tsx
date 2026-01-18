"use client";

import * as React from "react";
import type { Legislator, AdvocacyContext } from "@/lib/types";
import type { ContactMethod } from "@/lib/types";
import {
  type QueueStorage,
  type QueueItem,
  type ContactStatus,
  type ContactOutcome,
  type SavedDraft,
  loadQueue,
  saveQueue,
  clearQueue,
  createQueue,
  reorderQueue,
  markContacted,
  skipCurrent,
  removeFromQueue,
  setActive,
  getContactedCount,
  getRemainingCount,
  isQueueComplete,
  setContactMethod,
  setDefaultContactMethod,
  getEffectiveContactMethod,
  getContactAvailability,
  saveDraft,
  getSavedDraft,
  clearDraft,
  updateAdvocacyContext as updateQueueAdvocacyContext,
  isQueueForConversation,
  saveQueueForConversation,
  loadQueueForConversation,
} from "@/lib/queue-storage";
import { clearFilterStorage } from "./use-filters";

// =============================================================================
// Types
// =============================================================================

/** Contact flow step */
export type ContactStep = "research" | "contact" | "complete";

/** Re-export queue types for consumers */
export type { QueueItem, ContactStatus, ContactMethod, ContactOutcome, SavedDraft };
export { getEffectiveContactMethod, getContactAvailability };

interface ContactContextValue {
  /** Currently selected legislators */
  selectedLegislators: Legislator[];
  /** Select a legislator */
  selectLegislator: (legislator: Legislator) => void;
  /** Deselect a legislator */
  deselectLegislator: (legislatorId: string) => void;
  /** Toggle legislator selection */
  toggleLegislator: (legislator: Legislator) => void;
  /** Check if a legislator is selected */
  isSelected: (legislatorId: string) => boolean;
  /** Clear all selections */
  clearSelections: () => void;
  /** Set all selections at once */
  setSelectedLegislators: (legislators: Legislator[]) => void;
  /** Current step in the contact flow */
  currentStep: ContactStep;
  /** Set the current step */
  setCurrentStep: (step: ContactStep) => void;
  /** Research topic/context from chat */
  researchContext: string | null;
  /** Set the research context */
  setResearchContext: (context: string | null) => void;
  /** Full advocacy context extracted from chat for auto-populating contact form */
  advocacyContext: AdvocacyContext | null;
  /** Set the advocacy context (extracted from chat) */
  setAdvocacyContext: (context: AdvocacyContext | null, populatedFields?: (keyof AdvocacyContext)[]) => void;
  /** Update specific fields of advocacy context */
  updateAdvocacyContext: (updates: Partial<AdvocacyContext>) => void;
  /** Fields that were auto-populated from chat extraction */
  autoPopulatedFields: (keyof AdvocacyContext)[];
  /** Whether there are any selections */
  hasSelections: boolean;
  /** Number of selections */
  selectionCount: number;

  // Queue Management
  /** The contact queue */
  queue: QueueStorage | null;
  /** Initialize queue from selected legislators */
  initializeQueue: () => void;
  /** Reorder queue items */
  reorderQueueItems: (fromIndex: number, toIndex: number) => void;
  /** Mark current legislator as contacted and move to next */
  markCurrentContacted: (outcome?: ContactOutcome, notes?: string) => void;
  /** Skip current legislator (move to end of queue) */
  skipCurrentLegislator: () => void;
  /** Remove a legislator from the queue */
  removeFromQueueById: (legislatorId: string) => void;
  /** Set a specific legislator as active */
  setActiveLegislator: (legislatorId: string) => void;
  /** Clear the queue */
  clearQueueData: () => void;
  /** Number of contacted legislators */
  contactedCount: number;
  /** Number of remaining legislators */
  remainingCount: number;
  /** Whether all legislators have been contacted */
  isComplete: boolean;
  /** Get the currently active queue item */
  activeItem: QueueItem | null;

  // Contact Method Management
  /** Set the contact method for a specific legislator */
  setLegislatorContactMethod: (legislatorId: string, method: ContactMethod) => void;
  /** Set the default contact method (optionally apply to all pending) */
  setDefaultMethod: (method: ContactMethod, applyToAll?: boolean) => void;
  /** Get the current default contact method */
  defaultContactMethod: ContactMethod;

  // Draft Management
  /** Save a draft for a legislator */
  saveLegislatorDraft: (legislatorId: string, draft: Omit<SavedDraft, "savedAt">) => void;
  /** Get a saved draft for a legislator */
  getLegislatorDraft: (legislatorId: string) => SavedDraft | undefined;
  /** Clear a saved draft for a legislator */
  clearLegislatorDraft: (legislatorId: string) => void;

  // Session Management
  /** Current conversation ID for session isolation */
  currentConversationId: string | null;
  /** Set the current conversation ID (triggers cleanup if conversation changed) */
  setCurrentConversationId: (conversationId: string | null) => void;
  /** Reset all contact state for a fresh session. Options: { clearFilters: boolean } */
  resetForNewSession: (options?: { clearFilters?: boolean }) => void;
  /** Check if current queue belongs to the active conversation */
  isQueueForCurrentConversation: boolean;
}

type ContactAction =
  | { type: "SELECT"; payload: Legislator }
  | { type: "DESELECT"; payload: string }
  | { type: "TOGGLE"; payload: Legislator }
  | { type: "CLEAR" }
  | { type: "SET_ALL"; payload: Legislator[] }
  | { type: "SET_STEP"; payload: ContactStep }
  | { type: "SET_RESEARCH_CONTEXT"; payload: string | null }
  | { type: "SET_ADVOCACY_CONTEXT"; payload: { context: AdvocacyContext | null; populatedFields?: (keyof AdvocacyContext)[] } }
  | { type: "UPDATE_ADVOCACY_CONTEXT"; payload: Partial<AdvocacyContext> }
  | { type: "SET_QUEUE"; payload: QueueStorage | null }
  | { type: "HYDRATE_QUEUE"; payload: QueueStorage }
  | { type: "SET_CONVERSATION_ID"; payload: string | null }
  | { type: "RESET_SESSION" };

interface ContactState {
  selectedLegislators: Legislator[];
  currentStep: ContactStep;
  researchContext: string | null;
  advocacyContext: AdvocacyContext | null;
  autoPopulatedFields: (keyof AdvocacyContext)[];
  queue: QueueStorage | null;
  /** Current conversation ID for session isolation */
  currentConversationId: string | null;
}

// =============================================================================
// Reducer
// =============================================================================

function contactReducer(state: ContactState, action: ContactAction): ContactState {
  switch (action.type) {
    case "SELECT": {
      // Don't add duplicates
      if (state.selectedLegislators.some((l) => l.id === action.payload.id)) {
        return state;
      }
      return {
        ...state,
        selectedLegislators: [...state.selectedLegislators, action.payload],
      };
    }

    case "DESELECT": {
      return {
        ...state,
        selectedLegislators: state.selectedLegislators.filter((l) => l.id !== action.payload),
      };
    }

    case "TOGGLE": {
      const isSelected = state.selectedLegislators.some((l) => l.id === action.payload.id);
      if (isSelected) {
        return {
          ...state,
          selectedLegislators: state.selectedLegislators.filter((l) => l.id !== action.payload.id),
        };
      }
      return {
        ...state,
        selectedLegislators: [...state.selectedLegislators, action.payload],
      };
    }

    case "CLEAR": {
      return {
        ...state,
        selectedLegislators: [],
        queue: null,
      };
    }

    case "SET_ALL": {
      return {
        ...state,
        selectedLegislators: action.payload,
      };
    }

    case "SET_STEP": {
      return {
        ...state,
        currentStep: action.payload,
      };
    }

    case "SET_RESEARCH_CONTEXT": {
      return {
        ...state,
        researchContext: action.payload,
        // Also update advocacy context topic for consistency
        advocacyContext: action.payload
          ? { ...state.advocacyContext, topic: action.payload }
          : state.advocacyContext,
      };
    }

    case "SET_ADVOCACY_CONTEXT": {
      return {
        ...state,
        advocacyContext: action.payload.context,
        autoPopulatedFields: action.payload.populatedFields ?? [],
        // Keep researchContext in sync
        researchContext: action.payload.context?.topic ?? state.researchContext,
      };
    }

    case "UPDATE_ADVOCACY_CONTEXT": {
      const newContext = state.advocacyContext
        ? { ...state.advocacyContext, ...action.payload }
        : { topic: "", ...action.payload };
      return {
        ...state,
        advocacyContext: newContext,
        // Keep researchContext in sync if topic was updated
        researchContext: action.payload.topic ?? state.researchContext,
      };
    }

    case "SET_QUEUE": {
      return {
        ...state,
        queue: action.payload,
      };
    }

    case "HYDRATE_QUEUE": {
      // Hydrate queue from localStorage and sync selectedLegislators
      const legislators = action.payload.items.map((item) => item.legislator);
      return {
        ...state,
        queue: action.payload,
        selectedLegislators: legislators,
        researchContext: action.payload.researchContext,
        advocacyContext: action.payload.advocacyContext ?? null,
        autoPopulatedFields: action.payload.autoPopulatedFields ?? [],
      };
    }

    case "SET_CONVERSATION_ID": {
      return {
        ...state,
        currentConversationId: action.payload,
      };
    }

    case "RESET_SESSION": {
      // Reset all session-specific state to defaults
      return {
        selectedLegislators: [],
        currentStep: "research",
        researchContext: null,
        advocacyContext: null,
        autoPopulatedFields: [],
        queue: null,
        currentConversationId: state.currentConversationId,
      };
    }

    default:
      return state;
  }
}

// =============================================================================
// Context
// =============================================================================

const ContactContext = React.createContext<ContactContextValue | null>(null);

// =============================================================================
// Provider
// =============================================================================

interface ContactProviderProps {
  children: React.ReactNode;
}

export function ContactProvider({ children }: ContactProviderProps) {
  const [state, dispatch] = React.useReducer(contactReducer, {
    selectedLegislators: [],
    currentStep: "research",
    researchContext: null,
    advocacyContext: null,
    autoPopulatedFields: [],
    queue: null,
    currentConversationId: null,
  });

  // Hydrate queue from localStorage on mount
  // Note: We don't validate conversationId here because the chat context
  // hasn't loaded yet. Validation happens via useSessionSync when the
  // conversation ID is set.
  React.useEffect(() => {
    const storedQueue = loadQueue();
    if (storedQueue) {
      dispatch({ type: "HYDRATE_QUEUE", payload: storedQueue });
    }
  }, []);

  // Handle conversation changes - save current queue and load new conversation's queue
  const handleConversationChange = React.useCallback((newConversationId: string | null) => {
    const prevConversationId = state.currentConversationId;

    console.log("[ContactProvider] handleConversationChange:", {
      prevConversationId,
      newConversationId,
      hasQueue: !!state.queue,
      queueConversationId: state.queue?.conversationId,
    });

    // If conversation didn't actually change, do nothing
    if (prevConversationId === newConversationId) {
      return;
    }

    // Save current queue to the old conversation (if we have one)
    if (prevConversationId && state.queue) {
      console.log("[ContactProvider] Saving queue for conversation:", prevConversationId);
      saveQueueForConversation(prevConversationId, state.queue);
    }

    // Update the conversation ID
    dispatch({ type: "SET_CONVERSATION_ID", payload: newConversationId });

    // Load queue for the new conversation (if one exists)
    if (newConversationId) {
      const savedQueue = loadQueueForConversation(newConversationId);
      if (savedQueue) {
        console.log("[ContactProvider] Loading saved queue for conversation:", newConversationId);
        dispatch({ type: "HYDRATE_QUEUE", payload: savedQueue });
      } else {
        console.log("[ContactProvider] No saved queue for conversation, resetting state");
        // No queue for this conversation - reset to fresh state
        dispatch({ type: "RESET_SESSION" });
        dispatch({ type: "SET_CONVERSATION_ID", payload: newConversationId });
      }
    } else {
      // No conversation ID - reset to fresh state
      console.log("[ContactProvider] No conversation ID, resetting state");
      dispatch({ type: "RESET_SESSION" });
    }
  }, [state.currentConversationId, state.queue]);

  // Persist queue to localStorage when it changes
  React.useEffect(() => {
    if (state.queue) {
      // Save to global storage (for backward compatibility and /contact page)
      saveQueue(state.queue);
      // Also save to conversation-scoped storage if we have a conversation ID
      if (state.currentConversationId) {
        saveQueueForConversation(state.currentConversationId, state.queue);
      }
    }
  }, [state.queue, state.currentConversationId]);

  const selectLegislator = React.useCallback((legislator: Legislator) => {
    dispatch({ type: "SELECT", payload: legislator });
  }, []);

  const deselectLegislator = React.useCallback((legislatorId: string) => {
    dispatch({ type: "DESELECT", payload: legislatorId });
  }, []);

  const toggleLegislator = React.useCallback((legislator: Legislator) => {
    dispatch({ type: "TOGGLE", payload: legislator });
  }, []);

  const isSelected = React.useCallback(
    (legislatorId: string) => {
      return state.selectedLegislators.some((l) => l.id === legislatorId);
    },
    [state.selectedLegislators]
  );

  const clearSelections = React.useCallback(() => {
    clearQueue();
    dispatch({ type: "CLEAR" });
  }, []);

  const setSelectedLegislators = React.useCallback((legislators: Legislator[]) => {
    dispatch({ type: "SET_ALL", payload: legislators });
  }, []);

  const setCurrentStep = React.useCallback((step: ContactStep) => {
    dispatch({ type: "SET_STEP", payload: step });
  }, []);

  const setResearchContext = React.useCallback((context: string | null) => {
    dispatch({ type: "SET_RESEARCH_CONTEXT", payload: context });
  }, []);

  const setAdvocacyContext = React.useCallback((context: AdvocacyContext | null, populatedFields?: (keyof AdvocacyContext)[]) => {
    dispatch({ type: "SET_ADVOCACY_CONTEXT", payload: { context, populatedFields } });
    // Also update the queue if it exists
    if (state.queue) {
      const newQueue = updateQueueAdvocacyContext(state.queue, context);
      // Also update autoPopulatedFields in queue
      newQueue.autoPopulatedFields = populatedFields ?? [];
      dispatch({ type: "SET_QUEUE", payload: newQueue });
    }
  }, [state.queue]);

  const updateAdvocacyContext = React.useCallback((updates: Partial<AdvocacyContext>) => {
    dispatch({ type: "UPDATE_ADVOCACY_CONTEXT", payload: updates });
    // Also update the queue if it exists
    if (state.queue) {
      const newContext = state.advocacyContext
        ? { ...state.advocacyContext, ...updates }
        : { topic: "", ...updates };
      const newQueue = updateQueueAdvocacyContext(state.queue, newContext);
      dispatch({ type: "SET_QUEUE", payload: newQueue });
    }
  }, [state.queue, state.advocacyContext]);

  // Queue management functions
  const initializeQueue = React.useCallback(() => {
    const newQueue = createQueue(
      state.selectedLegislators,
      state.researchContext,
      "email",
      state.advocacyContext,
      state.autoPopulatedFields,
      state.currentConversationId
    );
    dispatch({ type: "SET_QUEUE", payload: newQueue });
  }, [state.selectedLegislators, state.researchContext, state.advocacyContext, state.autoPopulatedFields, state.currentConversationId]);

  const reorderQueueItems = React.useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!state.queue) return;
      const newQueue = reorderQueue(state.queue, fromIndex, toIndex);
      dispatch({ type: "SET_QUEUE", payload: newQueue });
    },
    [state.queue]
  );

  const markCurrentContacted = React.useCallback(
    (outcome?: ContactOutcome, notes?: string) => {
      if (!state.queue) return;
      const newQueue = markContacted(state.queue, outcome, notes);
      dispatch({ type: "SET_QUEUE", payload: newQueue });
    },
    [state.queue]
  );

  const skipCurrentLegislator = React.useCallback(() => {
    if (!state.queue) return;
    const newQueue = skipCurrent(state.queue);
    dispatch({ type: "SET_QUEUE", payload: newQueue });
  }, [state.queue]);

  const removeFromQueueById = React.useCallback(
    (legislatorId: string) => {
      if (!state.queue) return;
      const newQueue = removeFromQueue(state.queue, legislatorId);
      // Also remove from selectedLegislators
      dispatch({ type: "DESELECT", payload: legislatorId });
      dispatch({ type: "SET_QUEUE", payload: newQueue });
    },
    [state.queue]
  );

  const setActiveLegislator = React.useCallback(
    (legislatorId: string) => {
      if (!state.queue) return;
      const newQueue = setActive(state.queue, legislatorId);
      dispatch({ type: "SET_QUEUE", payload: newQueue });
    },
    [state.queue]
  );

  const clearQueueData = React.useCallback(() => {
    clearQueue();
    dispatch({ type: "SET_QUEUE", payload: null });
  }, []);

  // Contact method management
  const setLegislatorContactMethod = React.useCallback(
    (legislatorId: string, method: ContactMethod) => {
      if (!state.queue) return;
      const newQueue = setContactMethod(state.queue, legislatorId, method);
      dispatch({ type: "SET_QUEUE", payload: newQueue });
    },
    [state.queue]
  );

  const setDefaultMethod = React.useCallback(
    (method: ContactMethod, applyToAll: boolean = false) => {
      if (!state.queue) return;
      const newQueue = setDefaultContactMethod(state.queue, method, applyToAll);
      dispatch({ type: "SET_QUEUE", payload: newQueue });
    },
    [state.queue]
  );

  // Draft management functions
  const saveLegislatorDraft = React.useCallback(
    (legislatorId: string, draft: Omit<SavedDraft, "savedAt">) => {
      if (!state.queue) return;
      const newQueue = saveDraft(state.queue, legislatorId, draft);
      dispatch({ type: "SET_QUEUE", payload: newQueue });
    },
    [state.queue]
  );

  const getLegislatorDraft = React.useCallback(
    (legislatorId: string): SavedDraft | undefined => {
      if (!state.queue) return undefined;
      return getSavedDraft(state.queue, legislatorId);
    },
    [state.queue]
  );

  const clearLegislatorDraft = React.useCallback(
    (legislatorId: string) => {
      if (!state.queue) return;
      const newQueue = clearDraft(state.queue, legislatorId);
      dispatch({ type: "SET_QUEUE", payload: newQueue });
    },
    [state.queue]
  );

  // Session management functions
  const setCurrentConversationId = React.useCallback((conversationId: string | null) => {
    handleConversationChange(conversationId);
  }, [handleConversationChange]);

  const resetForNewSession = React.useCallback((options?: { clearFilters?: boolean }) => {
    clearQueue();
    dispatch({ type: "RESET_SESSION" });
    if (options?.clearFilters) {
      clearFilterStorage();
    }
  }, []);

  // Check if current queue belongs to the active conversation
  const isQueueForCurrentConversation = isQueueForConversation(state.queue, state.currentConversationId);

  // Derived queue values
  const contactedCount = state.queue ? getContactedCount(state.queue) : 0;
  const remainingCount = state.queue ? getRemainingCount(state.queue) : 0;
  const isComplete = state.queue ? isQueueComplete(state.queue) : false;
  const activeItem =
    state.queue && state.queue.activeIndex >= 0 ? state.queue.items[state.queue.activeIndex] : null;
  const defaultContactMethod: ContactMethod = state.queue?.defaultContactMethod ?? "email";

  const value: ContactContextValue = {
    selectedLegislators: state.selectedLegislators,
    selectLegislator,
    deselectLegislator,
    toggleLegislator,
    isSelected,
    clearSelections,
    setSelectedLegislators,
    currentStep: state.currentStep,
    setCurrentStep,
    researchContext: state.researchContext,
    setResearchContext,
    advocacyContext: state.advocacyContext,
    setAdvocacyContext,
    updateAdvocacyContext,
    autoPopulatedFields: state.autoPopulatedFields,
    hasSelections: state.selectedLegislators.length > 0,
    selectionCount: state.selectedLegislators.length,
    // Queue management
    queue: state.queue,
    initializeQueue,
    reorderQueueItems,
    markCurrentContacted,
    skipCurrentLegislator,
    removeFromQueueById,
    setActiveLegislator,
    clearQueueData,
    contactedCount,
    remainingCount,
    isComplete,
    activeItem,
    // Contact method management
    setLegislatorContactMethod,
    setDefaultMethod,
    defaultContactMethod,
    // Draft management
    saveLegislatorDraft,
    getLegislatorDraft,
    clearLegislatorDraft,
    // Session management
    currentConversationId: state.currentConversationId,
    setCurrentConversationId,
    resetForNewSession,
    isQueueForCurrentConversation,
  };

  return <ContactContext.Provider value={value}>{children}</ContactContext.Provider>;
}

// =============================================================================
// Hook
// =============================================================================

export function useContact(): ContactContextValue {
  const context = React.useContext(ContactContext);

  if (!context) {
    throw new Error("useContact must be used within a ContactProvider");
  }

  return context;
}
