/**
 * Tests for Query Clarification Prompt System
 *
 * These tests validate the ambiguity detection patterns and clarification
 * question generation for various query types.
 */

import { describe, it, expect } from "vitest";
import {
  detectAmbiguity,
  analyzeQueryForClarification,
  generateClarificationQuestion,
  isClarificationResponse,
  refineQueryFromClarification,
  type AmbiguityType,
} from "../clarification";

describe("detectAmbiguity", () => {
  describe("vague topic detection", () => {
    const vagueTopicQueries = [
      "taxes",
      "Taxes",
      "healthcare",
      "immigration",
      "climate",
      "economy",
      "guns",
      "abortion",
      "spending",
      "education",
      "what about taxes?",
      "tell me about healthcare",
    ];

    it.each(vagueTopicQueries)(
      "should detect vague topic: '%s'",
      (query) => {
        const result = detectAmbiguity(query, 0);
        expect(result.isAmbiguous).toBe(true);
        expect(result.ambiguityTypes).toContain("vague_topic");
      }
    );

    const specificQueries = [
      "What did Senator Warren say about student loan forgiveness?",
      "How did representatives vote on the infrastructure bill?",
      "Show me hearings on AI regulation from 2024",
      "Elizabeth Warren's position on banking regulation",
    ];

    it.each(specificQueries)(
      "should NOT flag specific query: '%s'",
      (query) => {
        const result = detectAmbiguity(query, 0);
        expect(result.ambiguityTypes).not.toContain("vague_topic");
      }
    );
  });

  describe("missing referent detection", () => {
    const missingReferentQueries = [
      "What does the bill say?",
      "Tell me about that senator",
      "How did he vote?",
      "What's her position on it?",
      "What did she say about it?",
      "their stance on climate",
    ];

    it.each(missingReferentQueries)(
      "should detect missing referent in first message: '%s'",
      (query) => {
        const result = detectAmbiguity(query, 0);
        expect(result.isAmbiguous).toBe(true);
        expect(result.ambiguityTypes).toContain("missing_referent");
      }
    );

    it("should not flag missing referent in follow-up messages", () => {
      // In a conversation, "the bill" could refer to something discussed earlier
      const result = detectAmbiguity("What does the bill say?", 2);
      expect(result.ambiguityTypes).not.toContain("missing_referent");
    });
  });

  describe("scope unclear detection", () => {
    const scopeUnclearQueries = [
      "What do they think about climate?",
      "What do legislators believe about immigration?",
      "opinions on gun control",
    ];

    it.each(scopeUnclearQueries)(
      "should detect unclear scope: '%s'",
      (query) => {
        const result = detectAmbiguity(query, 0);
        expect(result.ambiguityTypes).toContain("scope_unclear");
      }
    );
  });

  describe("time ambiguity detection", () => {
    const timeAmbiguousQueries = [
      "What has happened recently on healthcare?",
      "Lately, what's been said about immigration?",
      "the latest on climate legislation",
    ];

    it.each(timeAmbiguousQueries)(
      "should detect time ambiguity: '%s'",
      (query) => {
        const result = detectAmbiguity(query, 0);
        expect(result.ambiguityTypes).toContain("time_ambiguous");
      }
    );
  });

  describe("confidence scoring", () => {
    it("should have higher confidence for shorter vague queries", () => {
      const shortResult = detectAmbiguity("taxes", 0);
      const longerResult = detectAmbiguity("what about taxes and their impact", 0);

      expect(shortResult.confidence).toBeGreaterThan(0);
      // Short queries get bonus confidence
      expect(shortResult.confidence).toBeGreaterThanOrEqual(longerResult.confidence);
    });

    it("should cap confidence at 1.0", () => {
      // A query that matches multiple patterns should still cap at 1.0
      const result = detectAmbiguity("what do they think about taxes recently?", 0);
      expect(result.confidence).toBeLessThanOrEqual(1.0);
    });
  });
});

describe("generateClarificationQuestion", () => {
  it("should generate question for vague tax query", () => {
    const detection = detectAmbiguity("taxes", 0);
    const question = generateClarificationQuestion("taxes", detection);

    expect(question).not.toBeNull();
    expect(question?.ambiguityType).toBe("vague_topic");
    expect(question?.options.length).toBeGreaterThan(0);
    expect(question?.question).toContain("taxes");
  });

  it("should generate question for healthcare", () => {
    const detection = detectAmbiguity("healthcare", 0);
    const question = generateClarificationQuestion("healthcare", detection);

    expect(question).not.toBeNull();
    expect(question?.options.some((o) => o.label.toLowerCase().includes("medicare"))).toBe(true);
  });

  it("should generate scope question for unclear audience", () => {
    const detection = detectAmbiguity("What do they think about guns?", 0);
    const question = generateClarificationQuestion("What do they think about guns?", detection);

    expect(question).not.toBeNull();
    expect(question?.ambiguityType).toBe("vague_topic"); // guns is also vague
  });

  it("should return null for specific queries", () => {
    const detection = detectAmbiguity("Senator Warren's stance on student loans", 0);
    const question = generateClarificationQuestion("Senator Warren's stance on student loans", detection);

    expect(question).toBeNull();
  });
});

describe("analyzeQueryForClarification", () => {
  it("should return needsClarification true for vague queries", () => {
    const result = analyzeQueryForClarification("immigration", 0);

    expect(result.needsClarification).toBe(true);
    expect(result.suggestedQuestion).not.toBeNull();
  });

  it("should return needsClarification false for specific queries", () => {
    const result = analyzeQueryForClarification(
      "What did Senator Sanders say about Medicare for All in the 2024 hearings?",
      0
    );

    expect(result.needsClarification).toBe(false);
  });

  it("should handle greetings gracefully", () => {
    const result = analyzeQueryForClarification("Hello!", 0);
    expect(result.needsClarification).toBe(false);
  });
});

describe("isClarificationResponse", () => {
  const mockClarification = {
    question: "Are you interested in a specific aspect of taxes?",
    options: [
      { label: "income taxes", refinedQuery: "income taxes in Congress" },
      { label: "corporate taxes", refinedQuery: "corporate taxes in Congress" },
      { label: "capital gains taxes", refinedQuery: "capital gains taxes in Congress" },
    ],
    ambiguityType: "vague_topic" as AmbiguityType,
  };

  it("should detect option label matches", () => {
    expect(isClarificationResponse("income taxes", mockClarification)).toBe(true);
    expect(isClarificationResponse("corporate taxes please", mockClarification)).toBe(true);
  });

  it("should detect selection phrases", () => {
    expect(isClarificationResponse("the first one", mockClarification)).toBe(true);
    expect(isClarificationResponse("I want the second option", mockClarification)).toBe(true);
    expect(isClarificationResponse("yes, that one", mockClarification)).toBe(true);
  });

  it("should return false for new topics", () => {
    expect(isClarificationResponse("Actually, tell me about healthcare instead", mockClarification)).toBe(false);
  });
});

describe("refineQueryFromClarification", () => {
  const mockClarification = {
    question: "Are you interested in a specific aspect of taxes?",
    options: [
      { label: "income taxes", refinedQuery: "income taxes in Congress" },
      { label: "corporate taxes", refinedQuery: "corporate taxes legislation" },
    ],
    ambiguityType: "vague_topic" as AmbiguityType,
  };

  it("should use refined query when option matched", () => {
    const result = refineQueryFromClarification("taxes", "income taxes", mockClarification);
    expect(result).toBe("income taxes in Congress");
  });

  it("should use user response directly for detailed responses", () => {
    const detailedResponse = "I want to know about income tax rates for high earners";
    const result = refineQueryFromClarification("taxes", detailedResponse, mockClarification);
    expect(result).toBe(detailedResponse);
  });

  it("should combine original and short response when no match", () => {
    const result = refineQueryFromClarification("taxes", "sales tax", mockClarification);
    expect(result).toContain("taxes");
    expect(result).toContain("sales tax");
  });
});

describe("edge cases", () => {
  it("should handle empty query", () => {
    const result = detectAmbiguity("", 0);
    expect(result.isAmbiguous).toBe(false);
  });

  it("should handle very long specific query", () => {
    const longQuery = `I want to know what Senator Elizabeth Warren has said about
      student loan forgiveness in the last two years, specifically in Senate
      Banking Committee hearings, and how her position compares to Senator Bernie Sanders.`;
    const result = detectAmbiguity(longQuery, 0);
    expect(result.isAmbiguous).toBe(false);
  });

  it("should handle query with only punctuation", () => {
    const result = detectAmbiguity("???", 0);
    expect(result.isAmbiguous).toBe(false);
  });

  it("should handle mixed case", () => {
    const result = detectAmbiguity("HEALTHCARE", 0);
    expect(result.isAmbiguous).toBe(true);
    expect(result.ambiguityTypes).toContain("vague_topic");
  });

  it("should handle query with bill number (specific)", () => {
    const result = analyzeQueryForClarification("What's in HR 1234?", 0);
    // Bill numbers make queries specific
    expect(result.detection.confidence).toBeLessThan(0.5);
  });

  it("should handle 'the bill' with context (about/on)", () => {
    // "the bill on climate" is less ambiguous than just "the bill"
    const result = detectAmbiguity("the bill on climate change", 0);
    // Should still work but may not flag as missing_referent since it has context
    expect(result.isAmbiguous).toBe(true);
  });
});

describe("sample ambiguous queries from requirements", () => {
  // These are the 15+ examples from the requirements

  const testCases: Array<{
    query: string;
    shouldNeedClarification: boolean;
    expectedTypes?: AmbiguityType[];
  }> = [
    // Vague topics
    { query: "taxes", shouldNeedClarification: true, expectedTypes: ["vague_topic"] },
    { query: "healthcare", shouldNeedClarification: true, expectedTypes: ["vague_topic"] },
    { query: "immigration", shouldNeedClarification: true, expectedTypes: ["vague_topic"] },
    { query: "climate", shouldNeedClarification: true, expectedTypes: ["vague_topic"] },
    { query: "economy", shouldNeedClarification: true, expectedTypes: ["vague_topic"] },

    // Missing referent
    { query: "what about the bill?", shouldNeedClarification: true, expectedTypes: ["missing_referent"] },
    { query: "that senator's votes", shouldNeedClarification: true, expectedTypes: ["missing_referent"] },
    { query: "what did she say?", shouldNeedClarification: true, expectedTypes: ["missing_referent"] },

    // Scope unclear
    { query: "what do they think about guns?", shouldNeedClarification: true },
    { query: "opinions on immigration", shouldNeedClarification: true },

    // Time ambiguous
    { query: "what's happening recently?", shouldNeedClarification: true, expectedTypes: ["time_ambiguous"] },
    { query: "the latest news", shouldNeedClarification: true, expectedTypes: ["time_ambiguous"] },

    // Specific (should NOT need clarification)
    { query: "Senator Warren on student loans", shouldNeedClarification: false },
    { query: "How did the Senate vote on the infrastructure bill?", shouldNeedClarification: false },
    { query: "Judiciary Committee hearings on immigration in 2024", shouldNeedClarification: false },
  ];

  testCases.forEach(({ query, shouldNeedClarification, expectedTypes }) => {
    it(`${shouldNeedClarification ? "should" : "should NOT"} need clarification: "${query}"`, () => {
      const result = analyzeQueryForClarification(query, 0);

      if (shouldNeedClarification) {
        expect(result.needsClarification).toBe(true);
        if (expectedTypes) {
          expectedTypes.forEach((type) => {
            expect(result.detection.ambiguityTypes).toContain(type);
          });
        }
      } else {
        expect(result.needsClarification).toBe(false);
      }
    });
  });
});
