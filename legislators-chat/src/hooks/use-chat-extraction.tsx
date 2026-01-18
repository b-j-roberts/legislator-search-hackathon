"use client";

import * as React from "react";
import type { ChatMessage, AdvocacyContext } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

interface ExtractionResult {
  /** Extracted advocacy context from chat */
  advocacyContext: AdvocacyContext | null;
  /** Whether extraction is in progress */
  isExtracting: boolean;
  /** Confidence score for the extraction (0-1) */
  confidence: number;
  /** Fields that were auto-populated */
  populatedFields: (keyof AdvocacyContext)[];
}

// =============================================================================
// Extraction Patterns
// =============================================================================

/** Common patterns for detecting topic/issues in user messages */
const TOPIC_PATTERNS = [
  // Direct mentions
  /(?:about|regarding|concerning|on the topic of|interested in|care about|worried about)\s+(.+?)(?:\.|$|,|\?)/gi,
  // Questions about topics
  /(?:what (?:is|are) (?:their|the) (?:stance|position|view)s? on)\s+(.+?)(?:\?|$)/gi,
  // Who supports/opposes patterns
  /(?:who (?:supports?|opposes?|is (?:for|against)))\s+(.+?)(?:\?|$)/gi,
  // Research requests
  /(?:research|look up|find information on|tell me about)\s+(.+?)(?:\.|$|,|\?)/gi,
];

/** Patterns for detecting user's position */
const POSITION_PATTERNS = {
  support: [
    /\bi (?:support|am for|want|need|believe in|am in favor of)\b/i,
    /\bwe (?:should|need to|must)\b/i,
    /\bplease (?:support|vote for|pass)\b/i,
  ],
  oppose: [
    /\bi (?:oppose|am against|don't want|don't support)\b/i,
    /\bwe (?:shouldn't|must not|need to stop)\b/i,
    /\bplease (?:vote against|oppose|block|stop)\b/i,
  ],
};

/** Patterns for detecting specific asks */
const ASK_PATTERNS = [
  /(?:vote (?:for|yes on|in favor of))\s+(.+?)(?:\.|$|,)/gi,
  /(?:vote (?:against|no on))\s+(.+?)(?:\.|$|,)/gi,
  /(?:co-?sponsor)\s+(.+?)(?:\.|$|,)/gi,
  /(?:support|pass)\s+(H\.?R\.?\s*\d+|S\.?\s*\d+|the .+? (?:act|bill))(?:\.|$|,)/gi,
  /(?:block|stop|defeat)\s+(H\.?R\.?\s*\d+|S\.?\s*\d+|the .+? (?:act|bill))(?:\.|$|,)/gi,
];

/** Patterns for detecting personal stories */
const PERSONAL_STORY_PATTERNS = [
  /\b(?:i have|i am|my (?:family|child|parent|spouse|friend)|personally|in my experience)\b/i,
  /\b(?:affects? me|impacts? my|my story|i experienced)\b/i,
  /\b(?:as a (?:parent|teacher|nurse|doctor|veteran|small business owner|farmer|worker))\b/i,
];

// =============================================================================
// Extraction Functions
// =============================================================================

/**
 * Extract the main topic/issue from chat messages
 */
function extractTopic(messages: ChatMessage[]): string | null {
  // Look at user messages to find what they're researching
  const userMessages = messages.filter((m) => m.role === "user");

  // Prioritize later messages as they're more specific
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const content = userMessages[i].content;

    for (const pattern of TOPIC_PATTERNS) {
      pattern.lastIndex = 0; // Reset regex state
      const match = pattern.exec(content);
      if (match && match[1]) {
        const topic = match[1].trim();
        // Filter out very short or generic matches
        if (topic.length > 5 && !topic.match(/^(it|this|that|them|they)$/i)) {
          return topic;
        }
      }
    }
  }

  // Fallback: Look for the most substantial user message about a topic
  for (let i = userMessages.length - 1; i >= 0; i--) {
    const content = userMessages[i].content;
    // Skip very short messages
    if (content.length < 20) continue;

    // If it looks like a research question, extract the core topic
    if (content.includes("?") || content.toLowerCase().includes("tell me")) {
      // Try to extract a meaningful phrase
      const words = content.split(/\s+/).slice(0, 15).join(" ");
      if (words.length > 10) {
        return words.replace(/\?$/, "").trim();
      }
    }
  }

  return null;
}

/**
 * Detect user's position (support/oppose) from messages
 */
function extractPosition(messages: ChatMessage[]): string | null {
  const userMessages = messages.filter((m) => m.role === "user");

  for (const message of userMessages) {
    const content = message.content;

    // Check for support patterns
    for (const pattern of POSITION_PATTERNS.support) {
      if (pattern.test(content)) {
        return "Support";
      }
    }

    // Check for oppose patterns
    for (const pattern of POSITION_PATTERNS.oppose) {
      if (pattern.test(content)) {
        return "Oppose";
      }
    }
  }

  return null;
}

/**
 * Extract specific asks (vote on bill, co-sponsor, etc.)
 */
function extractSpecificAsk(messages: ChatMessage[]): string | null {
  const userMessages = messages.filter((m) => m.role === "user");
  const asks: string[] = [];

  for (const message of userMessages) {
    const content = message.content;

    for (const pattern of ASK_PATTERNS) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(content)) !== null) {
        if (match[1]) {
          asks.push(match[1].trim());
        }
      }
    }
  }

  // Return the most recent/specific ask
  if (asks.length > 0) {
    return asks[asks.length - 1];
  }

  return null;
}

/**
 * Extract personal stories from messages
 */
function extractPersonalStory(messages: ChatMessage[]): string | null {
  const userMessages = messages.filter((m) => m.role === "user");

  for (const message of userMessages) {
    const content = message.content;

    // Check if message contains personal story indicators
    for (const pattern of PERSONAL_STORY_PATTERNS) {
      if (pattern.test(content)) {
        // If the message is substantial, it might be a personal story
        if (content.length > 50) {
          // Extract a portion for the personal story field
          return content.slice(0, 500);
        }
      }
    }
  }

  return null;
}

/**
 * Extract key findings from AI responses
 */
function extractKeyFindings(messages: ChatMessage[]): string[] {
  const assistantMessages = messages.filter((m) => m.role === "assistant" && m.status === "sent");
  const findings: string[] = [];

  for (const message of assistantMessages) {
    // Look for bullet points or numbered lists in AI responses
    const bulletPoints = message.content.match(/(?:^|\n)(?:[-•*]|\d+\.)\s+(.+?)(?:\n|$)/g);
    if (bulletPoints) {
      for (const point of bulletPoints.slice(0, 5)) { // Limit to 5 findings
        const cleaned = point.replace(/^[\n\s]*(?:[-•*]|\d+\.)\s*/, "").trim();
        if (cleaned.length > 20 && cleaned.length < 200) {
          findings.push(cleaned);
        }
      }
    }
  }

  return findings.slice(0, 5); // Return max 5 findings
}

// =============================================================================
// Main Extraction Function
// =============================================================================

/**
 * Extract advocacy context from a list of chat messages
 */
export function extractAdvocacyContext(messages: ChatMessage[]): ExtractionResult {
  if (!messages || messages.length === 0) {
    return {
      advocacyContext: null,
      isExtracting: false,
      confidence: 0,
      populatedFields: [],
    };
  }

  const topic = extractTopic(messages);
  const position = extractPosition(messages);
  const specificAsk = extractSpecificAsk(messages);
  const personalStory = extractPersonalStory(messages);
  const keyFindings = extractKeyFindings(messages);

  // Track which fields were populated
  const populatedFields: (keyof AdvocacyContext)[] = [];

  if (topic) populatedFields.push("topic");
  if (position) populatedFields.push("position");
  if (specificAsk) populatedFields.push("specificAsk");
  if (personalStory) populatedFields.push("personalStory");
  if (keyFindings.length > 0) populatedFields.push("keyFindings");

  // Calculate confidence based on how many fields were extracted
  const confidence = populatedFields.length / 5;

  // Only return context if we at least have a topic
  if (!topic) {
    return {
      advocacyContext: null,
      isExtracting: false,
      confidence: 0,
      populatedFields: [],
    };
  }

  return {
    advocacyContext: {
      topic,
      position: position ?? undefined,
      specificAsk: specificAsk ?? undefined,
      personalStory: personalStory ?? undefined,
      keyFindings: keyFindings.length > 0 ? keyFindings : undefined,
    },
    isExtracting: false,
    confidence,
    populatedFields,
  };
}

// =============================================================================
// Hook
// =============================================================================

/**
 * Hook to extract advocacy context from chat messages
 * Returns extracted context and metadata about the extraction
 */
export function useChatExtraction(messages: ChatMessage[]): ExtractionResult {
  const [result, setResult] = React.useState<ExtractionResult>({
    advocacyContext: null,
    isExtracting: true,
    confidence: 0,
    populatedFields: [],
  });

  React.useEffect(() => {
    // Small delay to not block initial render
    const timer = setTimeout(() => {
      const extracted = extractAdvocacyContext(messages);
      setResult(extracted);
    }, 0);

    return () => clearTimeout(timer);
  }, [messages]);

  return result;
}

/**
 * Hook to get a memoized extraction result
 * Only re-extracts when messages change significantly
 */
export function useMemoizedChatExtraction(messages: ChatMessage[]): ExtractionResult {
  return React.useMemo(() => extractAdvocacyContext(messages), [messages]);
}
