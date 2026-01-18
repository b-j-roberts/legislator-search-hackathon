/**
 * Sentiment Analysis Utilities
 *
 * Handles detection of sentiment-related queries and building prompts
 * for analyzing speaker sentiment from congressional records.
 */

import type { SearchResultData, SpeakerSentimentMap } from "./types";

// =============================================================================
// Sentiment Query Detection
// =============================================================================

/**
 * Keywords that indicate the user is asking about opinions, stances, or positions
 * on a topic (sentiment-related queries).
 */
const SENTIMENT_KEYWORDS = [
  // Stance indicators
  "support",
  "supports",
  "supporting",
  "supported",
  "oppose",
  "opposes",
  "opposing",
  "opposed",
  "against",
  "favor",
  "favors",
  "favoring",
  "favored",
  // Opinion indicators
  "opinion",
  "opinions",
  "view",
  "views",
  "think",
  "thinks",
  "believe",
  "believes",
  "feel",
  "feels",
  "stance",
  "stances",
  "position",
  "positions",
  // Sentiment indicators
  "positive",
  "negative",
  "sentiment",
  "attitude",
  "attitudes",
  // Neutral/Mixed stance indicators
  "mixed",
  "neutral",
  "undecided",
  "uncommitted",
  "on the fence",
  "on the border",
  "leaning",
  "uncertain",
  "swing",
  "moderate",
  "centrist",
  // Action indicators
  "advocate",
  "advocates",
  "advocating",
  "criticized",
  "criticize",
  "criticizes",
  "praise",
  "praises",
  "praising",
  "condemned",
  "condemn",
  "condemns",
  "endorsed",
  "endorse",
  "endorses",
  "voted for",
  "voted against",
  // Question patterns
  "pro",
  "anti",
  "for or against",
  "in favor",
];

/**
 * Political/social topics that typically warrant sentiment analysis
 * when mentioned alongside legislators/representatives.
 */
const SENTIMENT_TOPICS = [
  "abortion",
  "reproductive",
  "pro-life",
  "pro-choice",
  "women's rights",
  "womens rights",
  "gun control",
  "second amendment",
  "2nd amendment",
  "immigration",
  "border",
  "climate",
  "environment",
  "healthcare",
  "health care",
  "medicare",
  "medicaid",
  "taxes",
  "tax cuts",
  "minimum wage",
  "lgbtq",
  "gay marriage",
  "same-sex",
  "transgender",
  "civil rights",
  "voting rights",
  "police",
  "criminal justice",
  "death penalty",
  "marijuana",
  "cannabis",
  "education",
  "student loans",
  "social security",
  "welfare",
  "military",
  "defense spending",
  "foreign policy",
  "israel",
  "ukraine",
  "china",
  "trade",
  "tariffs",
];

/**
 * Patterns that indicate the query is NOT sentiment-related
 * (factual, procedural, or informational queries).
 */
const NON_SENTIMENT_PATTERNS = [
  /^(who|what|when|where|how many|how much|list|show me|find)\s+/i,
  /\b(schedule|agenda|calendar|date|time|meeting|committee)\b/i,
  /\b(bill number|hr\s*\d+|s\.\s*\d+|resolution)\b/i,
  /\b(biography|background|history|career)\b/i,
];

/**
 * Check if a user query is sentiment-related and would benefit from
 * sentiment analysis of speakers.
 *
 * @param query - The user's original question/query
 * @returns true if the query is about opinions, stances, or sentiment
 */
export function isSentimentRelatedQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();

  // Check if query matches non-sentiment patterns (unless it also has sentiment indicators)
  let matchesNonSentiment = false;
  for (const pattern of NON_SENTIMENT_PATTERNS) {
    if (pattern.test(query)) {
      matchesNonSentiment = true;
      break;
    }
  }

  // Check for sentiment keywords
  for (const keyword of SENTIMENT_KEYWORDS) {
    // Match whole words only (escape special regex chars for multi-word phrases)
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "i");
    if (regex.test(lowerQuery)) {
      return true;
    }
  }

  // Check for comparison patterns (often sentiment-related)
  if (/\b(compare|comparison|versus|vs\.?|differ|difference)\b/i.test(query)) {
    return true;
  }

  // If query mentions a political topic AND legislators/contact, it's sentiment-related
  const mentionsLegislators = /\b(legislator|representative|senator|congress|contact|reach out)\b/i.test(query);
  if (mentionsLegislators) {
    for (const topic of SENTIMENT_TOPICS) {
      const escaped = topic.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const regex = new RegExp(`\\b${escaped}\\b`, "i");
      if (regex.test(lowerQuery)) {
        return true;
      }
    }
  }

  // If it only matches non-sentiment patterns and no positive indicators, return false
  if (matchesNonSentiment) {
    return false;
  }

  return false;
}

// =============================================================================
// Sentiment Analysis Prompt
// =============================================================================

/**
 * Aggregated speaker data for sentiment analysis
 */
export interface SpeakerStatements {
  speakerId: string;
  speakerName: string;
  statements: string[];
}

/**
 * Extract speaker statements from search results for sentiment analysis
 */
export function aggregateSpeakerStatements(
  searchResults: SearchResultData[],
  speakerIds: string[]
): SpeakerStatements[] {
  const speakerMap = new Map<string, SpeakerStatements>();

  for (const result of searchResults) {
    if (!result.speaker_name) continue;

    const normalizedId = result.speaker_name
      .toLowerCase()
      .replace(/^(sen\.|senator|rep\.|representative|mr\.|mrs\.|ms\.|dr\.)\s*/i, "")
      .trim()
      .replace(/\s+/g, "-");

    if (!speakerIds.includes(normalizedId)) continue;

    const existing = speakerMap.get(normalizedId);
    if (existing) {
      // Limit to 5 statements per speaker to keep prompt size reasonable
      if (existing.statements.length < 5) {
        existing.statements.push(result.text);
      }
    } else {
      speakerMap.set(normalizedId, {
        speakerId: normalizedId,
        speakerName: result.speaker_name,
        statements: [result.text],
      });
    }
  }

  return Array.from(speakerMap.values());
}

/**
 * Build the prompt for sentiment analysis of speakers
 *
 * @param topic - The topic being discussed (from user's original query)
 * @param speakers - Aggregated speaker statements
 * @returns Prompt string for Maple AI
 */
export function buildSentimentAnalysisPrompt(
  topic: string,
  speakers: SpeakerStatements[]
): string {
  const speakerData = speakers
    .map((s) => {
      const statements = s.statements
        .map((stmt, i) => `  ${i + 1}. "${stmt.slice(0, 500)}${stmt.length > 500 ? "..." : ""}"`)
        .join("\n");
      return `### ${s.speakerName} (ID: ${s.speakerId})\n${statements}`;
    })
    .join("\n\n");

  return `You are analyzing congressional statements to determine speaker sentiment about a specific topic.

## TOPIC
${topic}

## TASK
Analyze each speaker's statements below and estimate their sentiment score from 0 to 100:
- 0-20: Strongly negative / Strongly opposes the topic
- 21-40: Negative / Generally opposes
- 41-60: Neutral / Mixed feelings
- 61-80: Positive / Generally supports
- 81-100: Strongly positive / Strongly supports the topic

## SPEAKERS AND THEIR STATEMENTS
${speakerData}

## RESPONSE FORMAT
Respond ONLY with a valid JSON object mapping speaker IDs to their sentiment scores.
Do not include any explanation or additional text.

Example response format:
\`\`\`json
{
  "john-doe": 75,
  "jane-smith": 32
}
\`\`\`

Now analyze the speakers above and provide the JSON response:`;
}

// =============================================================================
// Response Parsing
// =============================================================================

/**
 * Parse the sentiment analysis response from AI
 *
 * @param response - Raw AI response text
 * @returns Parsed sentiment map or null if parsing failed
 */
export function parseSentimentResponse(response: string): SpeakerSentimentMap | null {
  try {
    // Extract JSON from response (may be wrapped in markdown code block)
    let jsonStr = response;

    // Try to extract from code block
    const codeBlockMatch = response.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim();
    }

    // Try to find raw JSON object
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate the structure
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return null;
    }

    // Validate each entry is a number between 0 and 100
    const result: SpeakerSentimentMap = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "number" && value >= 0 && value <= 100) {
        result[key] = Math.round(value);
      } else if (typeof value === "string") {
        const num = parseInt(value, 10);
        if (!isNaN(num) && num >= 0 && num <= 100) {
          result[key] = num;
        }
      }
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch {
    return null;
  }
}
