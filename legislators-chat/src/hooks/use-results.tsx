"use client";

import * as React from "react";
import type { ChatMessage, Legislator, Document, VoteRecord, Hearing } from "@/lib/types";
import type { ResultsTab } from "@/components/results";

// =============================================================================
// Types
// =============================================================================

export interface ResultsState {
  legislators: Legislator[];
  documents: Document[];
  votes: VoteRecord[];
  hearings: Hearing[];
  activeTab: ResultsTab;
}

export interface UseResultsReturn extends ResultsState {
  /** Set the active tab */
  setActiveTab: (tab: ResultsTab) => void;
  /** Check if there are any results */
  hasResults: boolean;
  /** Total number of results across all categories */
  totalResults: number;
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to extract and aggregate results from chat messages.
 *
 * Results are extracted from assistant messages that contain structured data
 * (legislators, documents, votes, hearings). The hook deduplicates results
 * by ID and returns the aggregated state.
 */
export function useResults(messages: ChatMessage[]): UseResultsReturn {
  const [activeTab, setActiveTab] = React.useState<ResultsTab>("people");

  // Extract and deduplicate results from all assistant messages
  const aggregatedResults = React.useMemo(() => {
    const legislatorMap = new Map<string, Legislator>();
    const documentMap = new Map<string, Document>();
    const voteMap = new Map<string, VoteRecord>();
    const hearingMap = new Map<string, Hearing>();

    // Process messages in reverse order so newer results take precedence
    for (let i = messages.length - 1; i >= 0; i--) {
      const message = messages[i];

      // Only process successful assistant messages
      if (message.role !== "assistant" || message.status === "error") {
        continue;
      }

      // Aggregate legislators
      if (message.legislators) {
        for (const legislator of message.legislators) {
          if (!legislatorMap.has(legislator.id)) {
            legislatorMap.set(legislator.id, legislator);
          }
        }
      }

      // Aggregate documents
      if (message.documents) {
        for (const doc of message.documents) {
          if (!documentMap.has(doc.id)) {
            documentMap.set(doc.id, doc);
          }
        }
      }

      // Aggregate votes
      if (message.votes) {
        for (const vote of message.votes) {
          if (!voteMap.has(vote.id)) {
            voteMap.set(vote.id, vote);
          }
        }
      }

      // Aggregate hearings
      if (message.hearings) {
        for (const hearing of message.hearings) {
          if (!hearingMap.has(hearing.id)) {
            hearingMap.set(hearing.id, hearing);
          }
        }
      }
    }

    return {
      legislators: Array.from(legislatorMap.values()),
      documents: Array.from(documentMap.values()),
      votes: Array.from(voteMap.values()),
      hearings: Array.from(hearingMap.values()),
    };
  }, [messages]);

  const hasResults =
    aggregatedResults.legislators.length > 0 ||
    aggregatedResults.documents.length > 0 ||
    aggregatedResults.votes.length > 0 ||
    aggregatedResults.hearings.length > 0;

  const totalResults =
    aggregatedResults.legislators.length +
    aggregatedResults.documents.length +
    aggregatedResults.votes.length +
    aggregatedResults.hearings.length;

  return {
    ...aggregatedResults,
    activeTab,
    setActiveTab,
    hasResults,
    totalResults,
  };
}
