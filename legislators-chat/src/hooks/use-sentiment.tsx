"use client";

/**
 * Sentiment Analysis Hook
 *
 * Fetches sentiment scores for speakers based on search results.
 * Only triggers for sentiment-related queries.
 */

import * as React from "react";
import type { SearchResultData, Speaker, SpeakerSentimentMap } from "@/lib/types";
import { isSentimentRelatedQuery } from "@/lib/sentiment";

// =============================================================================
// Types
// =============================================================================

export interface UseSentimentReturn {
  /** Map of speaker ID to sentiment score (0-100) */
  sentimentScores: SpeakerSentimentMap;
  /** Whether sentiment analysis is currently loading */
  isLoading: boolean;
  /** Whether the current query is sentiment-related */
  isSentimentQuery: boolean;
  /** Trigger sentiment analysis for speakers */
  analyzeSentiment: (
    query: string,
    speakers: Speaker[],
    searchResults: SearchResultData[]
  ) => Promise<void>;
  /** Reset sentiment state (e.g., when starting a new query) */
  reset: () => void;
}

// =============================================================================
// Hook
// =============================================================================

export function useSentiment(): UseSentimentReturn {
  const [sentimentScores, setSentimentScores] = React.useState<SpeakerSentimentMap>({});
  const [isLoading, setIsLoading] = React.useState(false);
  const [isSentimentQuery, setIsSentimentQuery] = React.useState(false);

  // Track the last analyzed query to prevent duplicate requests
  const lastAnalyzedRef = React.useRef<string>("");

  const analyzeSentiment = React.useCallback(
    async (query: string, speakers: Speaker[], searchResults: SearchResultData[]) => {
      // Check if this query is sentiment-related
      const isSentiment = isSentimentRelatedQuery(query);
      setIsSentimentQuery(isSentiment);

      if (!isSentiment) {
        // Not a sentiment query, clear any existing scores
        setSentimentScores({});
        return;
      }

      // No speakers to analyze
      if (speakers.length === 0) {
        return;
      }

      // No search results to analyze
      if (searchResults.length === 0) {
        return;
      }

      // Create a unique key for this analysis request
      const analysisKey = `${query}-${speakers.map((s) => s.id).join(",")}`;

      // Avoid duplicate requests
      if (lastAnalyzedRef.current === analysisKey) {
        return;
      }

      lastAnalyzedRef.current = analysisKey;
      setIsLoading(true);

      try {
        const response = await fetch("/api/sentiment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            topic: query,
            speakerIds: speakers.map((s) => s.id),
            searchResults,
          }),
        });

        if (!response.ok) {
          const error = await response.json().catch(() => ({}));
          console.error("Sentiment analysis failed:", error);
          // On error, set scores to empty (will show as null in UI)
          setSentimentScores({});
          return;
        }

        const data = await response.json();
        setSentimentScores(data.sentiments || {});
      } catch (error) {
        console.error("Sentiment analysis error:", error);
        setSentimentScores({});
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  const reset = React.useCallback(() => {
    setSentimentScores({});
    setIsLoading(false);
    setIsSentimentQuery(false);
    lastAnalyzedRef.current = "";
  }, []);

  return {
    sentimentScores,
    isLoading,
    isSentimentQuery,
    analyzeSentiment,
    reset,
  };
}
