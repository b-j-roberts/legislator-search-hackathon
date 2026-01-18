/**
 * Tests for Sensitive Topic Detection
 *
 * Verifies that the controversy handling works correctly for
 * politically charged queries.
 */

import {
  SENSITIVE_TOPICS,
  containsSensitiveTopic,
  detectSensitiveTopics,
} from "../search-system";

describe("SENSITIVE_TOPICS constant", () => {
  it("should contain major controversial topic keywords", () => {
    expect(SENSITIVE_TOPICS).toContain("abortion");
    expect(SENSITIVE_TOPICS).toContain("gun control");
    expect(SENSITIVE_TOPICS).toContain("immigration");
    expect(SENSITIVE_TOPICS).toContain("climate change");
    expect(SENSITIVE_TOPICS).toContain("lgbtq");
    expect(SENSITIVE_TOPICS).toContain("police reform");
  });

  it("should have at least 50 keywords", () => {
    expect(SENSITIVE_TOPICS.length).toBeGreaterThanOrEqual(50);
  });
});

describe("containsSensitiveTopic", () => {
  // ==========================================================================
  // Test Case Group 1: Abortion/Reproductive Rights
  // ==========================================================================
  describe("abortion and reproductive rights", () => {
    it("detects direct abortion query", () => {
      expect(containsSensitiveTopic("What has Congress said about abortion?")).toBe(true);
    });

    it("detects Roe v Wade references", () => {
      expect(containsSensitiveTopic("How did legislators react to Roe v Wade being overturned?")).toBe(true);
    });

    it("detects reproductive rights phrasing", () => {
      expect(containsSensitiveTopic("Hearings on reproductive rights in 2023")).toBe(true);
    });

    it("detects pro-life/pro-choice framing", () => {
      expect(containsSensitiveTopic("Which senators are pro-life?")).toBe(true);
      expect(containsSensitiveTopic("pro-choice legislators in California")).toBe(true);
    });
  });

  // ==========================================================================
  // Test Case Group 2: Gun Control/Firearms
  // ==========================================================================
  describe("gun control and firearms", () => {
    it("detects gun control query", () => {
      expect(containsSensitiveTopic("What gun control bills have been proposed?")).toBe(true);
    });

    it("detects Second Amendment references", () => {
      expect(containsSensitiveTopic("Second Amendment hearings in the House")).toBe(true);
      expect(containsSensitiveTopic("2nd Amendment rights legislation")).toBe(true);
    });

    it("detects assault weapons mentions", () => {
      expect(containsSensitiveTopic("Assault weapons ban debate")).toBe(true);
    });

    it("detects mass shooting context", () => {
      expect(containsSensitiveTopic("Congressional response to mass shootings")).toBe(true);
    });
  });

  // ==========================================================================
  // Test Case Group 3: Immigration
  // ==========================================================================
  describe("immigration", () => {
    it("detects general immigration query", () => {
      expect(containsSensitiveTopic("Immigration policy hearings")).toBe(true);
    });

    it("detects border security context", () => {
      expect(containsSensitiveTopic("Border security funding votes")).toBe(true);
    });

    it("detects DACA/Dreamers context", () => {
      expect(containsSensitiveTopic("DACA legislation updates")).toBe(true);
      expect(containsSensitiveTopic("Dreamers pathway to citizenship")).toBe(true);
    });

    it("detects asylum policy discussions", () => {
      expect(containsSensitiveTopic("Asylum policy changes under discussion")).toBe(true);
    });
  });

  // ==========================================================================
  // Test Case Group 4: LGBTQ+ Rights
  // ==========================================================================
  describe("LGBTQ+ rights", () => {
    it("detects LGBTQ general query", () => {
      expect(containsSensitiveTopic("LGBTQ rights legislation")).toBe(true);
    });

    it("detects transgender policy discussions", () => {
      expect(containsSensitiveTopic("Transgender athletes policy debate")).toBe(true);
    });

    it("detects same-sex marriage context", () => {
      expect(containsSensitiveTopic("Same-sex marriage protection act")).toBe(true);
    });

    it("detects gender identity discussions", () => {
      expect(containsSensitiveTopic("Gender identity in schools")).toBe(true);
    });
  });

  // ==========================================================================
  // Test Case Group 5: Police/Criminal Justice
  // ==========================================================================
  describe("police and criminal justice", () => {
    it("detects police reform query", () => {
      expect(containsSensitiveTopic("Police reform legislation")).toBe(true);
    });

    it("detects defund the police context", () => {
      expect(containsSensitiveTopic("What legislators support defund the police?")).toBe(true);
    });

    it("detects qualified immunity discussions", () => {
      expect(containsSensitiveTopic("Qualified immunity reform bills")).toBe(true);
    });

    it("detects BLM context", () => {
      expect(containsSensitiveTopic("Congressional response to Black Lives Matter protests")).toBe(true);
      expect(containsSensitiveTopic("BLM hearings in 2020")).toBe(true);
    });
  });

  // ==========================================================================
  // Test Case Group 6: Climate
  // ==========================================================================
  describe("climate", () => {
    it("detects climate change query", () => {
      expect(containsSensitiveTopic("Climate change hearings")).toBe(true);
    });

    it("detects Green New Deal references", () => {
      expect(containsSensitiveTopic("Green New Deal debate")).toBe(true);
    });

    it("detects climate denial context", () => {
      expect(containsSensitiveTopic("Legislators who question climate denial")).toBe(true);
    });
  });

  // ==========================================================================
  // Test Case Group 7: Elections
  // ==========================================================================
  describe("elections", () => {
    it("detects election integrity query", () => {
      expect(containsSensitiveTopic("Election integrity legislation")).toBe(true);
    });

    it("detects voter fraud context", () => {
      expect(containsSensitiveTopic("Claims of voter fraud in hearings")).toBe(true);
    });

    it("detects January 6 references", () => {
      expect(containsSensitiveTopic("January 6 committee hearings")).toBe(true);
      expect(containsSensitiveTopic("Jan 6 investigation")).toBe(true);
    });

    it("detects voter ID discussions", () => {
      expect(containsSensitiveTopic("Voter ID requirements debate")).toBe(true);
    });
  });

  // ==========================================================================
  // Test Case Group 8: Education
  // ==========================================================================
  describe("education", () => {
    it("detects CRT context", () => {
      expect(containsSensitiveTopic("Critical race theory in schools debate")).toBe(true);
      expect(containsSensitiveTopic("CRT curriculum hearings")).toBe(true);
    });

    it("detects book bans context", () => {
      expect(containsSensitiveTopic("Book bans in public schools")).toBe(true);
    });
  });

  // ==========================================================================
  // Test Case Group 9: Healthcare
  // ==========================================================================
  describe("healthcare", () => {
    it("detects vaccine mandate context", () => {
      expect(containsSensitiveTopic("Vaccine mandate legislation")).toBe(true);
    });

    it("detects Obamacare/ACA context", () => {
      expect(containsSensitiveTopic("Obamacare repeal attempts")).toBe(true);
    });

    it("detects Medicare for All context", () => {
      expect(containsSensitiveTopic("Medicare for All hearings")).toBe(true);
    });
  });

  // ==========================================================================
  // Test Case Group 10: Non-sensitive queries (should NOT match)
  // ==========================================================================
  describe("non-sensitive queries", () => {
    it("does not flag infrastructure queries", () => {
      expect(containsSensitiveTopic("Infrastructure spending bill")).toBe(false);
    });

    it("does not flag general budget queries", () => {
      expect(containsSensitiveTopic("Federal budget hearings 2024")).toBe(false);
    });

    it("does not flag trade policy queries", () => {
      expect(containsSensitiveTopic("Trade policy with China")).toBe(false);
    });

    it("does not flag space exploration queries", () => {
      expect(containsSensitiveTopic("NASA funding and space exploration")).toBe(false);
    });

    it("does not flag veterans affairs queries", () => {
      expect(containsSensitiveTopic("Veterans healthcare improvements")).toBe(false);
    });
  });
});

describe("detectSensitiveTopics", () => {
  it("returns empty array for neutral queries", () => {
    expect(detectSensitiveTopics("Infrastructure bill progress")).toEqual([]);
  });

  it("returns all matching topics in a query", () => {
    const result = detectSensitiveTopics(
      "How do legislators compare immigration and abortion policies?"
    );
    expect(result).toContain("immigration");
    expect(result).toContain("abortion");
    expect(result.length).toBe(2);
  });

  it("is case insensitive", () => {
    expect(detectSensitiveTopics("CLIMATE CHANGE debate")).toContain("climate change");
    expect(detectSensitiveTopics("Gun Control")).toContain("gun control");
  });

  it("detects multiple related topics", () => {
    const result = detectSensitiveTopics(
      "What did legislators say about gun control and firearms regulation after the mass shooting?"
    );
    expect(result).toContain("gun control");
    expect(result).toContain("firearms");
    expect(result).toContain("mass shooting");
  });
});

// ==========================================================================
// Edge Cases Documentation
// ==========================================================================
describe("edge cases", () => {
  /**
   * EDGE CASE 1: Partial matches
   * "immigrant" should not match if only "immigration" is in the list
   */
  it("handles partial word boundaries", () => {
    // This is a known limitation - substring matching may catch related words
    // "immigration" matches "immigration" but we include "undocumented" separately
    expect(containsSensitiveTopic("immigrant communities")).toBe(true); // matches "immigration"
  });

  /**
   * EDGE CASE 2: Historical context
   * Queries about historical events should still be flagged for careful handling
   */
  it("flags historical sensitive events", () => {
    expect(containsSensitiveTopic("Roe v Wade history before 2022")).toBe(true);
  });

  /**
   * EDGE CASE 3: Academic/neutral framing
   * Even academic discussions of these topics should be handled carefully
   */
  it("flags academically framed queries", () => {
    expect(containsSensitiveTopic("Research on gun violence statistics")).toBe(false);
    expect(containsSensitiveTopic("Research on gun control effectiveness")).toBe(true);
  });

  /**
   * EDGE CASE 4: Compound queries
   * Multiple topics in one query
   */
  it("handles compound controversial queries", () => {
    const topics = detectSensitiveTopics(
      "Compare Republican and Democrat positions on abortion, immigration, and gun control"
    );
    expect(topics.length).toBeGreaterThanOrEqual(3);
  });

  /**
   * EDGE CASE 5: Abbreviations
   * Some topics have common abbreviations
   */
  it("handles abbreviations", () => {
    expect(containsSensitiveTopic("CRT in schools")).toBe(true);
    expect(containsSensitiveTopic("BLM protests")).toBe(true);
    expect(containsSensitiveTopic("Jan 6")).toBe(true);
  });

  /**
   * EDGE CASE 6: Euphemisms and alternative phrases
   * Some users may use softer language
   */
  it("handles common euphemisms", () => {
    expect(containsSensitiveTopic("reproductive health legislation")).toBe(true); // matches "reproductive rights"
    expect(containsSensitiveTopic("undocumented workers")).toBe(true); // matches "undocumented"
  });

  /**
   * EDGE CASE 7: Single word queries
   * Very short queries that are just the topic
   */
  it("handles single word queries", () => {
    expect(containsSensitiveTopic("abortion")).toBe(true);
    expect(containsSensitiveTopic("immigration")).toBe(true);
    expect(containsSensitiveTopic("taxes")).toBe(false);
  });
});
