"use client";

import * as React from "react";

// =============================================================================
// Types
// =============================================================================

export interface EditHistoryEntry<T> {
  /** Unique ID for this entry */
  id: string;
  /** The content state at this point */
  content: T;
  /** Timestamp of this edit */
  timestamp: number;
  /** Optional description of the change */
  description?: string;
  /** Whether this was an AI refinement */
  isAIRefinement?: boolean;
}

export interface EditHistoryState<T> {
  /** All history entries */
  entries: EditHistoryEntry<T>[];
  /** Current position in history (index) */
  currentIndex: number;
  /** The original content (first entry) */
  originalContent: T | null;
}

export interface UseEditHistoryReturn<T> {
  /** Current content */
  currentContent: T | null;
  /** Push a new state to history */
  pushState: (content: T, description?: string, isAIRefinement?: boolean) => void;
  /** Undo to previous state */
  undo: () => void;
  /** Redo to next state */
  redo: () => void;
  /** Can undo */
  canUndo: boolean;
  /** Can redo */
  canRedo: boolean;
  /** Reset history with new initial content */
  reset: (content: T) => void;
  /** Clear all history */
  clear: () => void;
  /** Get all history entries */
  history: EditHistoryEntry<T>[];
  /** Current index in history */
  currentIndex: number;
  /** Jump to a specific history entry */
  jumpTo: (index: number) => void;
  /** Total number of entries */
  historyLength: number;
  /** Original content (for comparison) */
  originalContent: T | null;
  /** Whether content has been modified from original */
  isDirty: boolean;
  /** Revert to original content */
  revertToOriginal: () => void;
}

// =============================================================================
// Hook
// =============================================================================

function generateId(): string {
  return `edit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function useEditHistory<T>(
  initialContent?: T,
  options?: {
    maxHistoryLength?: number;
    onStateChange?: (content: T | null, entry: EditHistoryEntry<T> | null) => void;
  }
): UseEditHistoryReturn<T> {
  const { maxHistoryLength = 50, onStateChange } = options || {};

  const [state, setState] = React.useState<EditHistoryState<T>>(() => {
    if (initialContent !== undefined) {
      const initialEntry: EditHistoryEntry<T> = {
        id: generateId(),
        content: initialContent,
        timestamp: Date.now(),
        description: "Original",
      };
      return {
        entries: [initialEntry],
        currentIndex: 0,
        originalContent: initialContent,
      };
    }
    return {
      entries: [],
      currentIndex: -1,
      originalContent: null,
    };
  });

  // Current content
  const currentContent = React.useMemo(() => {
    if (state.currentIndex >= 0 && state.currentIndex < state.entries.length) {
      return state.entries[state.currentIndex].content;
    }
    return null;
  }, [state.entries, state.currentIndex]);

  // Can undo/redo
  const canUndo = state.currentIndex > 0;
  const canRedo = state.currentIndex < state.entries.length - 1;

  // Is dirty (modified from original)
  const isDirty = React.useMemo(() => {
    if (state.originalContent === null || currentContent === null) return false;
    return JSON.stringify(currentContent) !== JSON.stringify(state.originalContent);
  }, [currentContent, state.originalContent]);

  // Push new state
  const pushState = React.useCallback(
    (content: T, description?: string, isAIRefinement?: boolean) => {
      setState((prev) => {
        // Remove any entries after current index (discard redo history)
        const newEntries = prev.entries.slice(0, prev.currentIndex + 1);

        const newEntry: EditHistoryEntry<T> = {
          id: generateId(),
          content,
          timestamp: Date.now(),
          description,
          isAIRefinement,
        };

        newEntries.push(newEntry);

        // Trim to max length (keeping original)
        while (newEntries.length > maxHistoryLength) {
          // Keep the first entry (original) and remove the second
          if (newEntries.length > 2) {
            newEntries.splice(1, 1);
          } else {
            break;
          }
        }

        const newState = {
          ...prev,
          entries: newEntries,
          currentIndex: newEntries.length - 1,
        };

        // Call onStateChange callback
        if (onStateChange) {
          onStateChange(content, newEntry);
        }

        return newState;
      });
    },
    [maxHistoryLength, onStateChange]
  );

  // Undo
  const undo = React.useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex <= 0) return prev;
      const newIndex = prev.currentIndex - 1;
      const entry = prev.entries[newIndex];

      if (onStateChange && entry) {
        onStateChange(entry.content, entry);
      }

      return {
        ...prev,
        currentIndex: newIndex,
      };
    });
  }, [onStateChange]);

  // Redo
  const redo = React.useCallback(() => {
    setState((prev) => {
      if (prev.currentIndex >= prev.entries.length - 1) return prev;
      const newIndex = prev.currentIndex + 1;
      const entry = prev.entries[newIndex];

      if (onStateChange && entry) {
        onStateChange(entry.content, entry);
      }

      return {
        ...prev,
        currentIndex: newIndex,
      };
    });
  }, [onStateChange]);

  // Reset with new content
  const reset = React.useCallback(
    (content: T) => {
      const initialEntry: EditHistoryEntry<T> = {
        id: generateId(),
        content,
        timestamp: Date.now(),
        description: "Original",
      };

      setState({
        entries: [initialEntry],
        currentIndex: 0,
        originalContent: content,
      });

      if (onStateChange) {
        onStateChange(content, initialEntry);
      }
    },
    [onStateChange]
  );

  // Clear all history
  const clear = React.useCallback(() => {
    setState({
      entries: [],
      currentIndex: -1,
      originalContent: null,
    });

    if (onStateChange) {
      onStateChange(null, null);
    }
  }, [onStateChange]);

  // Jump to specific index
  const jumpTo = React.useCallback(
    (index: number) => {
      setState((prev) => {
        if (index < 0 || index >= prev.entries.length) return prev;
        const entry = prev.entries[index];

        if (onStateChange && entry) {
          onStateChange(entry.content, entry);
        }

        return {
          ...prev,
          currentIndex: index,
        };
      });
    },
    [onStateChange]
  );

  // Revert to original
  const revertToOriginal = React.useCallback(() => {
    if (state.entries.length > 0) {
      jumpTo(0);
    }
  }, [state.entries.length, jumpTo]);

  return {
    currentContent,
    pushState,
    undo,
    redo,
    canUndo,
    canRedo,
    reset,
    clear,
    history: state.entries,
    currentIndex: state.currentIndex,
    jumpTo,
    historyLength: state.entries.length,
    originalContent: state.originalContent,
    isDirty,
    revertToOriginal,
  };
}

// =============================================================================
// Keyboard shortcuts hook
// =============================================================================

export function useEditHistoryKeyboard<T>(
  editHistory: UseEditHistoryReturn<T>,
  enabled: boolean = true
) {
  React.useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd/Ctrl + Z (undo) or Cmd/Ctrl + Shift + Z (redo)
      if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          if (editHistory.canRedo) {
            editHistory.redo();
          }
        } else {
          if (editHistory.canUndo) {
            editHistory.undo();
          }
        }
      }
      // Also support Cmd/Ctrl + Y for redo (Windows convention)
      if ((e.metaKey || e.ctrlKey) && e.key === "y") {
        e.preventDefault();
        if (editHistory.canRedo) {
          editHistory.redo();
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [enabled, editHistory]);
}
