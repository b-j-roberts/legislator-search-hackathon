"use client";

import * as React from "react";
import type { Legislator } from "@/lib/types";
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
} from "@/lib/queue-storage";

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
}

type ContactAction =
  | { type: "SELECT"; payload: Legislator }
  | { type: "DESELECT"; payload: string }
  | { type: "TOGGLE"; payload: Legislator }
  | { type: "CLEAR" }
  | { type: "SET_ALL"; payload: Legislator[] }
  | { type: "SET_STEP"; payload: ContactStep }
  | { type: "SET_RESEARCH_CONTEXT"; payload: string | null }
  | { type: "SET_QUEUE"; payload: QueueStorage | null }
  | { type: "HYDRATE_QUEUE"; payload: QueueStorage };

interface ContactState {
  selectedLegislators: Legislator[];
  currentStep: ContactStep;
  researchContext: string | null;
  queue: QueueStorage | null;
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
    queue: null,
  });

  // Hydrate queue from localStorage on mount
  React.useEffect(() => {
    const storedQueue = loadQueue();
    if (storedQueue) {
      dispatch({ type: "HYDRATE_QUEUE", payload: storedQueue });
    }
  }, []);

  // Persist queue to localStorage when it changes
  React.useEffect(() => {
    if (state.queue) {
      saveQueue(state.queue);
    }
  }, [state.queue]);

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

  // Queue management functions
  const initializeQueue = React.useCallback(() => {
    const newQueue = createQueue(state.selectedLegislators, state.researchContext);
    dispatch({ type: "SET_QUEUE", payload: newQueue });
  }, [state.selectedLegislators, state.researchContext]);

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
