"use client";

import * as React from "react";

interface UseAutoSaveOptions<T> {
  /** Data to save */
  data: T;
  /** Function to call when saving */
  onSave: (data: T) => void;
  /** Debounce delay in milliseconds (default: 2000ms) */
  delay?: number;
  /** Whether auto-save is enabled (default: true) */
  enabled?: boolean;
  /** Key to compare for changes (if undefined, will use shallow compare) */
  compareKey?: string;
}

interface UseAutoSaveReturn {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether a save is pending (debounce in progress) */
  isSaving: boolean;
  /** Timestamp of last successful save */
  lastSavedAt: string | null;
  /** Manually trigger a save */
  saveNow: () => void;
  /** Mark current state as saved (useful after external save) */
  markSaved: () => void;
  /** Reset dirty state without saving */
  resetDirty: () => void;
}

/**
 * Hook for auto-saving data with debounce
 *
 * Automatically saves data after a period of inactivity.
 * Useful for editors and forms that need draft persistence.
 */
export function useAutoSave<T>({
  data,
  onSave,
  delay = 2000,
  enabled = true,
  compareKey,
}: UseAutoSaveOptions<T>): UseAutoSaveReturn {
  const [isDirty, setIsDirty] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [lastSavedAt, setLastSavedAt] = React.useState<string | null>(null);

  // Refs to track previous data and timeout
  const previousDataRef = React.useRef<T>(data);
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const onSaveRef = React.useRef(onSave);

  // Keep onSave ref updated
  React.useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Compare data to detect changes
  const hasChanged = React.useCallback((newData: T, oldData: T): boolean => {
    if (compareKey) {
      // Compare specific key
      const newValue = (newData as Record<string, unknown>)[compareKey];
      const oldValue = (oldData as Record<string, unknown>)[compareKey];
      return JSON.stringify(newValue) !== JSON.stringify(oldValue);
    }
    // Deep compare
    return JSON.stringify(newData) !== JSON.stringify(oldData);
  }, [compareKey]);

  // Perform save
  const performSave = React.useCallback((dataToSave: T) => {
    setIsSaving(true);
    try {
      onSaveRef.current(dataToSave);
      setLastSavedAt(new Date().toISOString());
      setIsDirty(false);
      previousDataRef.current = dataToSave;
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Cancel any pending save
  const cancelPendingSave = React.useCallback(() => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
  }, []);

  // Save immediately
  const saveNow = React.useCallback(() => {
    cancelPendingSave();
    if (isDirty) {
      performSave(data);
    }
  }, [cancelPendingSave, isDirty, performSave, data]);

  // Mark as saved (useful when external code does the save)
  const markSaved = React.useCallback(() => {
    cancelPendingSave();
    setIsDirty(false);
    setLastSavedAt(new Date().toISOString());
    previousDataRef.current = data;
  }, [cancelPendingSave, data]);

  // Reset dirty state without saving
  const resetDirty = React.useCallback(() => {
    cancelPendingSave();
    setIsDirty(false);
    previousDataRef.current = data;
  }, [cancelPendingSave, data]);

  // Watch for data changes and schedule saves
  React.useEffect(() => {
    if (!enabled) return;

    const dataChanged = hasChanged(data, previousDataRef.current);

    if (dataChanged) {
      setIsDirty(true);
      setIsSaving(true);

      // Cancel previous timeout
      cancelPendingSave();

      // Schedule new save
      saveTimeoutRef.current = setTimeout(() => {
        performSave(data);
      }, delay);
    }

    return () => {
      cancelPendingSave();
    };
  }, [data, enabled, delay, hasChanged, cancelPendingSave, performSave]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      cancelPendingSave();
    };
  }, [cancelPendingSave]);

  return {
    isDirty,
    isSaving,
    lastSavedAt,
    saveNow,
    markSaved,
    resetDirty,
  };
}

/**
 * Format a timestamp as a relative time string for display
 */
export function formatSaveTime(isoString: string | null): string {
  if (!isoString) return "";

  const savedDate = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - savedDate.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);

  if (diffSeconds < 5) return "Just now";
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  // Show time for today
  const isToday = savedDate.toDateString() === now.toDateString();
  if (isToday) {
    return savedDate.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  // Show date for older
  return savedDate.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
