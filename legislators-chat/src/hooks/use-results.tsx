"use client";

import * as React from "react";
import type { ChatMessage, Legislator, Document, VoteRecord, Hearing, SearchResultData } from "@/lib/types";
import type { ResultsTab } from "@/components/results";

// =============================================================================
// Types
// =============================================================================

export interface ResultsState {
  legislators: Legislator[];
  documents: Document[];
  votes: VoteRecord[];
  hearings: Hearing[];
  /** Search results from PolSearch API */
  searchResults: SearchResultData[];
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
 * (legislators, documents, votes, hearings, searchResults). The hook deduplicates
 * results by ID and returns the aggregated state.
 *
 * When searchResults are present, they take precedence over legacy document/vote types.
 */
export function useResults(messages: ChatMessage[]): UseResultsReturn {
  const [activeTab, setActiveTab] = React.useState<ResultsTab>("people");

  // Extract and deduplicate results from all assistant messages
  const aggregatedResults = React.useMemo(() => {
    const legislatorMap = new Map<string, Legislator>();
    const documentMap = new Map<string, Document>();
    const voteMap = new Map<string, VoteRecord>();
    const hearingMap = new Map<string, Hearing>();
    const searchResultMap = new Map<string, SearchResultData>();

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

      // Aggregate search results from PolSearch API
      if (message.searchResults) {
        for (const result of message.searchResults) {
          // Use content_id + segment_index as unique key
          const key = `${result.content_id}-${result.segment_index}`;
          if (!searchResultMap.has(key)) {
            searchResultMap.set(key, result);
          }
        }
      }
    }

    return {
      legislators: Array.from(legislatorMap.values()),
      documents: Array.from(documentMap.values()),
      votes: Array.from(voteMap.values()),
      hearings: Array.from(hearingMap.values()),
      searchResults: Array.from(searchResultMap.values()),
    };
  }, [messages]);

  // Calculate result counts - searchResults take precedence if present
  const searchDocCount = aggregatedResults.searchResults.filter(
    (r) => r.content_type === "hearing" || r.content_type === "floor_speech"
  ).length;
  const searchVoteCount = aggregatedResults.searchResults.filter(
    (r) => r.content_type === "vote"
  ).length;

  const hasSearchResults = aggregatedResults.searchResults.length > 0;
  const effectiveDocCount = hasSearchResults ? searchDocCount : aggregatedResults.documents.length + aggregatedResults.hearings.length;
  const effectiveVoteCount = hasSearchResults ? searchVoteCount : aggregatedResults.votes.length;

  const hasResults =
    aggregatedResults.legislators.length > 0 ||
    effectiveDocCount > 0 ||
    effectiveVoteCount > 0;

  const totalResults =
    aggregatedResults.legislators.length +
    effectiveDocCount +
    effectiveVoteCount;

  return {
    ...aggregatedResults,
    activeTab,
    setActiveTab,
    hasResults,
    totalResults,
  };
}
