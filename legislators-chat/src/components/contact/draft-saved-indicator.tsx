"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cloud, CloudOff, Loader2, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import { formatSaveTime } from "@/hooks/use-auto-save";

interface DraftSavedIndicatorProps {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /** Whether a save is in progress */
  isSaving: boolean;
  /** ISO timestamp of last successful save */
  lastSavedAt: string | null;
  /** Class name for styling */
  className?: string;
}

/**
 * Visual indicator for draft save status
 *
 * Shows:
 * - "Saving..." when save is in progress
 * - "Draft saved" with timestamp when saved
 * - "Unsaved changes" when dirty
 */
export function DraftSavedIndicator({
  isDirty,
  isSaving,
  lastSavedAt,
  className,
}: DraftSavedIndicatorProps) {
  const [displayTime, setDisplayTime] = React.useState(() =>
    formatSaveTime(lastSavedAt)
  );
  const [showSavedFeedback, setShowSavedFeedback] = React.useState(false);

  // Update display time periodically
  React.useEffect(() => {
    if (!lastSavedAt) return;

    // Update immediately
    setDisplayTime(formatSaveTime(lastSavedAt));

    // Update every 10 seconds
    const interval = setInterval(() => {
      setDisplayTime(formatSaveTime(lastSavedAt));
    }, 10000);

    return () => clearInterval(interval);
  }, [lastSavedAt]);

  // Show checkmark feedback briefly after save
  const prevIsSaving = React.useRef(isSaving);
  React.useEffect(() => {
    if (prevIsSaving.current && !isSaving && !isDirty) {
      setShowSavedFeedback(true);
      const timer = setTimeout(() => setShowSavedFeedback(false), 2000);
      return () => clearTimeout(timer);
    }
    prevIsSaving.current = isSaving;
  }, [isSaving, isDirty]);

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 text-xs transition-colors",
        className
      )}
    >
      <AnimatePresence mode="wait">
        {isSaving ? (
          <motion.div
            key="saving"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex items-center gap-1.5 text-muted-foreground"
          >
            <Loader2 className="size-3 animate-spin" />
            <span>Saving...</span>
          </motion.div>
        ) : showSavedFeedback ? (
          <motion.div
            key="saved-feedback"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="flex items-center gap-1.5 text-green-600 dark:text-green-400"
          >
            <Check className="size-3" />
            <span>Saved</span>
          </motion.div>
        ) : isDirty ? (
          <motion.div
            key="unsaved"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400"
          >
            <CloudOff className="size-3" />
            <span>Unsaved changes</span>
          </motion.div>
        ) : lastSavedAt ? (
          <motion.div
            key="last-saved"
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="flex items-center gap-1.5 text-muted-foreground"
          >
            <Cloud className="size-3" />
            <span>Draft saved {displayTime}</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
