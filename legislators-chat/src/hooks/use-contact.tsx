"use client";

import * as React from "react";
import type { Legislator } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

/** Contact flow step */
export type ContactStep = "research" | "contact" | "complete";

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
}

type ContactAction =
  | { type: "SELECT"; payload: Legislator }
  | { type: "DESELECT"; payload: string }
  | { type: "TOGGLE"; payload: Legislator }
  | { type: "CLEAR" }
  | { type: "SET_ALL"; payload: Legislator[] }
  | { type: "SET_STEP"; payload: ContactStep }
  | { type: "SET_RESEARCH_CONTEXT"; payload: string | null };

interface ContactState {
  selectedLegislators: Legislator[];
  currentStep: ContactStep;
  researchContext: string | null;
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
        selectedLegislators: state.selectedLegislators.filter(
          (l) => l.id !== action.payload
        ),
      };
    }

    case "TOGGLE": {
      const isSelected = state.selectedLegislators.some(
        (l) => l.id === action.payload.id
      );
      if (isSelected) {
        return {
          ...state,
          selectedLegislators: state.selectedLegislators.filter(
            (l) => l.id !== action.payload.id
          ),
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
  });

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
  };

  return (
    <ContactContext.Provider value={value}>{children}</ContactContext.Provider>
  );
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
