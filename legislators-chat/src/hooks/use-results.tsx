"use client";

import * as React from "react";
import type { ChatMessage, Legislator, Document, VoteRecord, Hearing, SearchResultData, Speaker, SpeakerType, Chamber } from "@/lib/types";
import type { ResultsTab } from "@/components/results";
import { mockLegislators, useMockData } from "@/lib/fixtures/mock-legislators";
import { enrichLegislatorsWithContactData, findBestMatchingLegislator } from "@/lib/legislator-lookup";

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
  /** Speakers extracted from search results */
  speakers: Speaker[];
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
// Helper Functions
// =============================================================================

/**
 * Normalize a speaker name for use as an ID
 * Converts to lowercase and removes common prefixes like "Sen.", "Rep.", etc.
 */
function normalizeSpeakerName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^(sen\.|senator|rep\.|representative|mr\.|mrs\.|ms\.|dr\.)\s*/i, "")
    .trim()
    .replace(/\s+/g, "-");
}

/**
 * Extract chamber from speaker name prefix or search result
 */
function extractChamber(name: string, resultChamber?: string): Chamber | undefined {
  const lowerName = name.toLowerCase();
  if (lowerName.startsWith("sen.") || lowerName.startsWith("senator")) {
    return "Senate";
  }
  if (lowerName.startsWith("rep.") || lowerName.startsWith("representative")) {
    return "House";
  }
  // Fall back to result chamber if available
  if (resultChamber) {
    const lowerChamber = resultChamber.toLowerCase();
    if (lowerChamber === "senate") return "Senate";
    if (lowerChamber === "house") return "House";
  }
  return undefined;
}

/** Speaker types that represent legislators (not witnesses, experts, etc.) */
const LEGISLATOR_SPEAKER_TYPES: Set<string> = new Set([
  "representative",
  "senator",
  "presiding_officer",
]);

/**
 * Check if a speaker type represents a legislator
 */
function isLegislatorSpeakerType(speakerType?: string): boolean {
  if (!speakerType) return false;
  return LEGISLATOR_SPEAKER_TYPES.has(speakerType.toLowerCase());
}

/**
 * Infer if a speaker is a legislator from their name prefix
 * Used as fallback when speaker_type is not available
 */
function inferIsLegislatorFromName(name: string): boolean {
  const lowerName = name.toLowerCase();
  const legislatorPrefixes = [
    "sen.", "senator",
    "rep.", "representative",
    "mr. speaker", "madam speaker",
    "the speaker", "mr. president", "madam president",
  ];
  return legislatorPrefixes.some(prefix => lowerName.startsWith(prefix));
}

/**
 * Extract unique speakers from search results and aggregate their metadata.
 * Only includes speakers who match CURRENT legislators in our database.
 * This filters out former legislators (like retired senators) and non-legislators (witnesses, experts).
 *
 * @param searchResults - Array of search result data
 * @param currentLegislatorsOnly - Whether to require match to current legislators (default: true)
 */
function extractSpeakersFromResults(
  searchResults: SearchResultData[],
  currentLegislatorsOnly: boolean = true
): Speaker[] {
  const speakerMap = new Map<string, {
    name: string;
    speakerType?: SpeakerType;
    chamber?: Chamber;
    contentTypes: Set<string>;
    committees: Set<string>;
    dates: string[];
    sourceUrls: string[];
    count: number;
    matchedLegislator: Legislator | undefined;
  }>();

  for (const result of searchResults) {
    if (!result.speaker_name) continue;

    // Check if speaker type indicates a legislator (not a witness/expert)
    const hasLegislatorType = result.speaker_type
      ? isLegislatorSpeakerType(result.speaker_type)
      : inferIsLegislatorFromName(result.speaker_name);

    // Skip non-legislators (witnesses, experts, etc.)
    if (!hasLegislatorType) continue;

    const id = normalizeSpeakerName(result.speaker_name);
    const existing = speakerMap.get(id);

    if (existing) {
      existing.count++;
      if (result.content_type) {
        existing.contentTypes.add(result.content_type);
      }
      if (result.committee) {
        existing.committees.add(result.committee);
      }
      if (result.date) {
        existing.dates.push(result.date);
      }
      if (result.source_url && existing.sourceUrls.length < 3) {
        existing.sourceUrls.push(result.source_url);
      }
      // Update chamber if not set
      if (!existing.chamber) {
        existing.chamber = extractChamber(result.speaker_name, result.chamber);
      }
      // Update speaker type if not set
      if (!existing.speakerType && result.speaker_type) {
        existing.speakerType = result.speaker_type;
      }
    } else {
      // Try to match this speaker to a current legislator in our database
      const matchedLegislator = findBestMatchingLegislator(result.speaker_name);

      speakerMap.set(id, {
        name: result.speaker_name,
        speakerType: result.speaker_type,
        chamber: extractChamber(result.speaker_name, result.chamber),
        contentTypes: new Set(result.content_type ? [result.content_type] : []),
        committees: new Set(result.committee ? [result.committee] : []),
        dates: result.date ? [result.date] : [],
        sourceUrls: result.source_url ? [result.source_url] : [],
        count: 1,
        matchedLegislator,
      });
    }
  }

  // Convert map to Speaker array
  // Filter to only include speakers matched to current legislators when flag is set
  const speakersArray = Array.from(speakerMap.entries())
    .filter(([, data]) => {
      // When currentLegislatorsOnly is true, only include speakers who match a current legislator
      if (currentLegislatorsOnly) {
        return data.matchedLegislator !== undefined;
      }
      return true;
    })
    .map(([id, data]) => {
      // Calculate date range
      const sortedDates = data.dates.sort();
      const dateRange = sortedDates.length > 0
        ? {
            earliest: sortedDates[0],
            latest: sortedDates[sortedDates.length - 1],
          }
        : undefined;

      // Use the pre-matched legislator for enrichment
      const matchedLegislator = data.matchedLegislator;

      return {
        id,
        name: data.name,
        speakerType: data.speakerType,
        // Prefer matched legislator's chamber data (more accurate)
        chamber: matchedLegislator?.chamber || data.chamber,
        resultCount: data.count,
        contentTypes: Array.from(data.contentTypes),
        committees: Array.from(data.committees).slice(0, 3), // Limit to 3 committees
        dateRange,
        sampleSourceUrls: data.sourceUrls,
        imageUrl: matchedLegislator?.imageUrl,
        // Store matched legislator data for filtering
        _matchedLegislator: matchedLegislator,
      } as Speaker & { _matchedLegislator?: Legislator };
    });

  // Sort by result count (most active speakers first)
  return speakersArray.sort((a, b) => b.resultCount - a.resultCount);
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
 *
 * IMPORTANT: This hook preserves existing results while new searches are in progress.
 * Messages with status "sending" are skipped to prevent results from disappearing
 * during loading states. This ensures users always see either existing results or
 * newly loaded results, never an empty/skeleton state when data exists.
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

      // Only process completed assistant messages
      // Skip messages that are still loading (status: "sending") to preserve existing results
      // This prevents the results panel from showing skeletons while a new search is in progress
      if (message.role !== "assistant" || message.status === "error" || message.status === "sending") {
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

    const legislators = Array.from(legislatorMap.values());
    const searchResults = Array.from(searchResultMap.values());

    // Extract speakers from search results
    const speakers = extractSpeakersFromResults(searchResults);

    // Show mock legislators if feature flag enabled and no real results
    const finalLegislators = useMockData() && legislators.length === 0
      ? mockLegislators
      : legislators;

    // Enrich legislators with contact data and profile images from static data
    const enrichedLegislators = enrichLegislatorsWithContactData(finalLegislators);

    return {
      legislators: enrichedLegislators,
      documents: Array.from(documentMap.values()),
      votes: Array.from(voteMap.values()),
      hearings: Array.from(hearingMap.values()),
      searchResults,
      speakers,
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

  // For people count: use speakers from search results, or legislators from AI extraction
  const effectivePeopleCount = hasSearchResults
    ? aggregatedResults.speakers.length
    : aggregatedResults.legislators.length;

  const hasResults =
    effectivePeopleCount > 0 ||
    effectiveDocCount > 0 ||
    effectiveVoteCount > 0;

  const totalResults =
    effectivePeopleCount +
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
