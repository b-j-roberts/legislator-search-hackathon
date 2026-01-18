"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Diff, GitCompare, X, ChevronDown, ChevronUp } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { DiffSegment } from "@/lib/types";

// =============================================================================
// Diff Computation
// =============================================================================

/**
 * Simple word-level diff algorithm
 * Computes the difference between two strings at the word level
 */
export function computeWordDiff(original: string, modified: string): DiffSegment[] {
  const originalWords = original.split(/(\s+)/);
  const modifiedWords = modified.split(/(\s+)/);

  // Use LCS (Longest Common Subsequence) for diff
  const lcs = computeLCS(originalWords, modifiedWords);

  const segments: DiffSegment[] = [];
  let origIndex = 0;
  let modIndex = 0;
  let lcsIndex = 0;

  while (origIndex < originalWords.length || modIndex < modifiedWords.length) {
    if (lcsIndex < lcs.length && originalWords[origIndex] === lcs[lcsIndex]) {
      // Handle any additions before this common word
      while (modIndex < modifiedWords.length && modifiedWords[modIndex] !== lcs[lcsIndex]) {
        addToSegments(segments, { type: "added", text: modifiedWords[modIndex] });
        modIndex++;
      }

      // Common word
      addToSegments(segments, { type: "unchanged", text: originalWords[origIndex] });
      origIndex++;
      modIndex++;
      lcsIndex++;
    } else if (origIndex < originalWords.length) {
      // Check if the original word is not in LCS - it's removed
      if (lcsIndex >= lcs.length || originalWords[origIndex] !== lcs[lcsIndex]) {
        addToSegments(segments, { type: "removed", text: originalWords[origIndex] });
        origIndex++;
      }
    } else if (modIndex < modifiedWords.length) {
      // Remaining words in modified are additions
      addToSegments(segments, { type: "added", text: modifiedWords[modIndex] });
      modIndex++;
    } else {
      break;
    }
  }

  // Merge consecutive segments of the same type
  return mergeSegments(segments);
}

function computeLCS(a: string[], b: string[]): string[] {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to find LCS
  const lcs: string[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      lcs.unshift(a[i - 1]);
      i--;
      j--;
    } else if (dp[i - 1][j] > dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  return lcs;
}

function addToSegments(segments: DiffSegment[], segment: DiffSegment) {
  segments.push(segment);
}

function mergeSegments(segments: DiffSegment[]): DiffSegment[] {
  if (segments.length === 0) return [];

  const merged: DiffSegment[] = [];
  let current = { ...segments[0] };

  for (let i = 1; i < segments.length; i++) {
    if (segments[i].type === current.type) {
      current.text += segments[i].text;
    } else {
      merged.push(current);
      current = { ...segments[i] };
    }
  }
  merged.push(current);

  return merged;
}

/**
 * Compute diff for structured content objects
 */
export function computeContentDiff(
  original: Record<string, unknown>,
  modified: Record<string, unknown>
): Record<string, DiffSegment[]> {
  const result: Record<string, DiffSegment[]> = {};

  const allKeys = new Set([...Object.keys(original), ...Object.keys(modified)]);

  for (const key of allKeys) {
    const origValue = original[key];
    const modValue = modified[key];

    if (typeof origValue === "string" && typeof modValue === "string") {
      result[key] = computeWordDiff(origValue, modValue);
    } else if (Array.isArray(origValue) && Array.isArray(modValue)) {
      // Handle arrays of strings (like body paragraphs or talking points)
      const origText = origValue.join("\n\n");
      const modText = modValue.join("\n\n");
      result[key] = computeWordDiff(origText, modText);
    }
  }

  return result;
}

// =============================================================================
// Types
// =============================================================================

interface DiffViewerProps {
  /** Original content (string or structured) */
  original: string | Record<string, unknown>;
  /** Modified content (string or structured) */
  modified: string | Record<string, unknown>;
  /** Optional title */
  title?: string;
  /** Whether to show the viewer */
  isVisible?: boolean;
  /** Toggle visibility */
  onToggleVisibility?: () => void;
  /** Class name for the container */
  className?: string;
}

interface DiffTextProps {
  segments: DiffSegment[];
  className?: string;
}

// =============================================================================
// Diff Text Component
// =============================================================================

function DiffText({ segments, className }: DiffTextProps) {
  if (segments.length === 0) {
    return <span className={cn("text-muted-foreground", className)}>No changes</span>;
  }

  return (
    <span className={className}>
      {segments.map((segment, index) => {
        switch (segment.type) {
          case "added":
            return (
              <span
                key={index}
                className="bg-green-500/20 text-green-700 dark:text-green-400 px-0.5 rounded"
              >
                {segment.text}
              </span>
            );
          case "removed":
            return (
              <span
                key={index}
                className="bg-red-500/20 text-red-700 dark:text-red-400 line-through px-0.5 rounded"
              >
                {segment.text}
              </span>
            );
          case "unchanged":
          default:
            return <span key={index}>{segment.text}</span>;
        }
      })}
    </span>
  );
}

// =============================================================================
// Diff Stats Component
// =============================================================================

function DiffStats({ segments }: { segments: DiffSegment[] }) {
  const stats = React.useMemo(() => {
    let added = 0;
    let removed = 0;
    let unchanged = 0;

    for (const segment of segments) {
      const words = segment.text.trim().split(/\s+/).filter(Boolean).length;
      switch (segment.type) {
        case "added":
          added += words;
          break;
        case "removed":
          removed += words;
          break;
        case "unchanged":
          unchanged += words;
          break;
      }
    }

    return { added, removed, unchanged };
  }, [segments]);

  return (
    <div className="flex items-center gap-2 text-xs">
      {stats.added > 0 && (
        <span className="text-green-600 dark:text-green-400">+{stats.added}</span>
      )}
      {stats.removed > 0 && (
        <span className="text-red-600 dark:text-red-400">-{stats.removed}</span>
      )}
      {stats.added === 0 && stats.removed === 0 && (
        <span className="text-muted-foreground">No changes</span>
      )}
    </div>
  );
}

// =============================================================================
// Main Diff Viewer Component
// =============================================================================

export function DiffViewer({
  original,
  modified,
  title = "Changes",
  isVisible = true,
  onToggleVisibility,
  className,
}: DiffViewerProps) {
  const segments = React.useMemo(() => {
    if (typeof original === "string" && typeof modified === "string") {
      return computeWordDiff(original, modified);
    }
    // For structured content, flatten to text for comparison
    const origText =
      typeof original === "string" ? original : JSON.stringify(original, null, 2);
    const modText =
      typeof modified === "string" ? modified : JSON.stringify(modified, null, 2);
    return computeWordDiff(origText, modText);
  }, [original, modified]);

  const hasChanges = segments.some(
    (s) => s.type === "added" || s.type === "removed"
  );

  if (!hasChanges) {
    return null;
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={onToggleVisibility}
          className="flex items-center justify-between w-full text-left"
          disabled={!onToggleVisibility}
        >
          <div className="flex items-center gap-2">
            <GitCompare className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            <DiffStats segments={segments} />
          </div>
          {onToggleVisibility && (
            isVisible ? (
              <ChevronUp className="size-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="size-4 text-muted-foreground" />
            )
          )}
        </button>
      </CardHeader>

      <AnimatePresence>
        {isVisible && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent>
              <div className="max-h-48 overflow-y-auto rounded-md border border-border bg-muted/30 p-3">
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  <DiffText segments={segments} />
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-border flex items-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-green-500/20 border border-green-500/50" />
                  Added
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded bg-red-500/20 border border-red-500/50" />
                  Removed
                </div>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

// =============================================================================
// Inline Diff Badge Component
// =============================================================================

interface DiffBadgeProps {
  original: string;
  modified: string;
  className?: string;
}

export function DiffBadge({ original, modified, className }: DiffBadgeProps) {
  const segments = React.useMemo(
    () => computeWordDiff(original, modified),
    [original, modified]
  );

  const stats = React.useMemo(() => {
    let added = 0;
    let removed = 0;

    for (const segment of segments) {
      const words = segment.text.trim().split(/\s+/).filter(Boolean).length;
      if (segment.type === "added") added += words;
      if (segment.type === "removed") removed += words;
    }

    return { added, removed };
  }, [segments]);

  if (stats.added === 0 && stats.removed === 0) {
    return null;
  }

  return (
    <Badge variant="outline" className={cn("text-xs gap-1", className)}>
      {stats.added > 0 && (
        <span className="text-green-600 dark:text-green-400">+{stats.added}</span>
      )}
      {stats.added > 0 && stats.removed > 0 && " / "}
      {stats.removed > 0 && (
        <span className="text-red-600 dark:text-red-400">-{stats.removed}</span>
      )}
    </Badge>
  );
}
