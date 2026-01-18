/**
 * Tests for No Results Retry Strategy
 *
 * Verifies that the retry strategy correctly handles failed searches
 * with synonym expansion, filter removal priority, and user transparency.
 */

import {
  SEARCH_SYNONYMS,
  FILTER_REMOVAL_PRIORITY,
  getSynonymsForQuery,
  getFirstSynonymQuery,
  getNextFilterToRemove,
  getFilterRemovalDescription,
  analyzeRetryStrategy,
  buildNoResultsRetryPrompt,
  buildUserTransparencyMessage,
} from "../search-system";

describe("SEARCH_SYNONYMS constant", () => {
  it("should contain firearm-related synonyms", () => {
    expect(SEARCH_SYNONYMS["gun control"]).toContain("firearms regulation");
    expect(SEARCH_SYNONYMS["gun control"]).toContain("second amendment");
  });

  it("should contain climate-related synonyms", () => {
    expect(SEARCH_SYNONYMS["climate change"]).toContain("global warming");
    expect(SEARCH_SYNONYMS["climate change"]).toContain("environmental policy");
  });

  it("should contain immigration-related synonyms", () => {
    expect(SEARCH_SYNONYMS["immigration"]).toContain("border");
    expect(SEARCH_SYNONYMS["immigration"]).toContain("asylum");
  });

  it("should have multiple synonyms for each term", () => {
    Object.values(SEARCH_SYNONYMS).forEach((synonyms) => {
      expect(synonyms.length).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("FILTER_REMOVAL_PRIORITY", () => {
  it("should prioritize date filters first", () => {
    expect(FILTER_REMOVAL_PRIORITY[0]).toBe("from");
    expect(FILTER_REMOVAL_PRIORITY[1]).toBe("to");
  });

  it("should have type filter last", () => {
    expect(FILTER_REMOVAL_PRIORITY[FILTER_REMOVAL_PRIORITY.length - 1]).toBe("type");
  });

  it("should have speaker before committee", () => {
    const speakerIndex = FILTER_REMOVAL_PRIORITY.indexOf("speaker");
    const committeeIndex = FILTER_REMOVAL_PRIORITY.indexOf("committee");
    expect(speakerIndex).toBeLessThan(committeeIndex);
  });
});

describe("getSynonymsForQuery", () => {
  it("returns synonyms for matching terms", () => {
    const result = getSynonymsForQuery("What about gun control legislation?");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].term).toBe("gun control");
    expect(result[0].synonyms).toContain("firearms regulation");
  });

  it("returns multiple matches for compound queries", () => {
    const result = getSynonymsForQuery("How does immigration affect climate change?");
    expect(result.length).toBe(2);
    const terms = result.map((r) => r.term);
    expect(terms).toContain("immigration");
    expect(terms).toContain("climate change");
  });

  it("is case insensitive", () => {
    const result = getSynonymsForQuery("GUN CONTROL laws");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].term).toBe("gun control");
  });

  it("returns empty array for queries without synonyms", () => {
    const result = getSynonymsForQuery("infrastructure spending bill");
    expect(result).toEqual([]);
  });
});

describe("getFirstSynonymQuery", () => {
  it("replaces the first matching term with its first synonym", () => {
    const result = getFirstSynonymQuery("gun control legislation");
    expect(result).toBe("firearms regulation legislation");
  });

  it("is case insensitive when replacing", () => {
    const result = getFirstSynonymQuery("Gun Control laws");
    expect(result).toBe("firearms regulation laws");
  });

  it("returns null for queries without synonyms", () => {
    const result = getFirstSynonymQuery("infrastructure bill");
    expect(result).toBeNull();
  });
});

describe("getNextFilterToRemove", () => {
  it("returns date filters first when present", () => {
    const filters = { speaker: "Warren", from: "2023-01-01", committee: "Banking" };
    expect(getNextFilterToRemove(filters)).toBe("from");
  });

  it("returns speaker after date filters are removed", () => {
    const filters = { speaker: "Warren", committee: "Banking", type: "hearing" };
    expect(getNextFilterToRemove(filters)).toBe("speaker");
  });

  it("returns null when no filters present", () => {
    expect(getNextFilterToRemove({})).toBeNull();
  });

  it("ignores undefined and null values", () => {
    const filters = { from: undefined, speaker: null, committee: "Judiciary" };
    expect(getNextFilterToRemove(filters)).toBe("committee");
  });
});

describe("getFilterRemovalDescription", () => {
  it("returns human-readable descriptions", () => {
    expect(getFilterRemovalDescription("from")).toBe("date range start");
    expect(getFilterRemovalDescription("to")).toBe("date range end");
    expect(getFilterRemovalDescription("speaker")).toBe("specific speaker");
    expect(getFilterRemovalDescription("chamber")).toBe("chamber (House/Senate)");
  });

  it("returns the key itself for unknown filters", () => {
    expect(getFilterRemovalDescription("unknown")).toBe("unknown");
  });
});

describe("analyzeRetryStrategy", () => {
  it("identifies synonyms in query", () => {
    const result = analyzeRetryStrategy({ q: "gun control hearings" });
    expect(result.synonymSuggestions.length).toBeGreaterThan(0);
    expect(result.synonymSuggestions[0].term).toBe("gun control");
  });

  it("identifies filter to remove", () => {
    const result = analyzeRetryStrategy({
      q: "healthcare",
      speaker: "Pelosi",
      from: "2023-01",
    });
    expect(result.hasFiltersToRemove).toBe(true);
    expect(result.filterToRemove).toBe("from");
    expect(result.filterRemovalDescription).toBe("date range start");
  });

  it("generates simplified query when quotes present", () => {
    const result = analyzeRetryStrategy({ q: '"exact phrase" search' });
    expect(result.simplifiedQuery).toBe("exact phrase search");
  });

  it("returns hasFiltersToRemove: false when no filters", () => {
    const result = analyzeRetryStrategy({ q: "simple query" });
    expect(result.hasFiltersToRemove).toBe(false);
    expect(result.filterToRemove).toBeNull();
  });
});

describe("buildNoResultsRetryPrompt", () => {
  const baseParams = {
    params: {
      q: "gun control hearings",
      speaker: "Warren",
      from: "2023-01",
      to: "2023-12",
    },
  };

  it("includes original parameters in output", () => {
    const result = buildNoResultsRetryPrompt(baseParams);
    expect(result).toContain("gun control hearings");
    expect(result).toContain("Warren");
    expect(result).toContain("2023-01");
  });

  it("includes synonym suggestions when available", () => {
    const result = buildNoResultsRetryPrompt(baseParams);
    expect(result).toContain("Synonym Suggestions");
    expect(result).toContain("firearms regulation");
  });

  it("includes filter removal priority guidance", () => {
    const result = buildNoResultsRetryPrompt(baseParams);
    expect(result).toContain("Filter Removal Priority");
    expect(result).toContain("Date range");
  });

  it("skips synonyms on second attempt when synonymsTried is true", () => {
    const result = buildNoResultsRetryPrompt(baseParams, { synonymsTried: true });
    expect(result).not.toContain("Synonym Suggestions");
  });

  it("includes web search fallback after multiple attempts", () => {
    const result = buildNoResultsRetryPrompt(baseParams, { retryAttempt: 3 });
    expect(result).toContain("Final Fallback");
    expect(result).toContain("web search");
  });

  it("tracks retry attempt number", () => {
    const result = buildNoResultsRetryPrompt(baseParams, { retryAttempt: 2 });
    expect(result).toContain("Attempt 2");
  });

  it("shows already removed filters", () => {
    const result = buildNoResultsRetryPrompt(baseParams, {
      retryAttempt: 2,
      removedFilters: ["from", "to"],
    });
    expect(result).toContain("Already tried removing: from, to");
  });
});

describe("buildUserTransparencyMessage", () => {
  it("generates message for first retry with synonyms", () => {
    const strategy = {
      synonymSuggestions: [{ term: "gun control", synonyms: ["firearms regulation"] }],
      filterToRemove: "from" as const,
      filterRemovalDescription: "date range start",
      simplifiedQuery: null,
      hasFiltersToRemove: true,
      suggestWebSearch: false,
      retryAttempt: 1,
    };
    const message = buildUserTransparencyMessage(strategy, 1, []);
    expect(message).toContain("firearms regulation");
    expect(message).toContain("gun control");
  });

  it("generates message for second retry mentioning removed filters", () => {
    const strategy = {
      synonymSuggestions: [],
      filterToRemove: "speaker" as const,
      filterRemovalDescription: "specific speaker",
      simplifiedQuery: null,
      hasFiltersToRemove: true,
      suggestWebSearch: false,
      retryAttempt: 2,
    };
    const message = buildUserTransparencyMessage(strategy, 2, ["from", "to"]);
    expect(message).toContain("broadening");
    expect(message).toContain("from");
    expect(message).toContain("to");
  });

  it("generates fallback message when no actions available", () => {
    const strategy = {
      synonymSuggestions: [],
      filterToRemove: null,
      filterRemovalDescription: null,
      simplifiedQuery: null,
      hasFiltersToRemove: false,
      suggestWebSearch: false,
      retryAttempt: 1,
    };
    const message = buildUserTransparencyMessage(strategy, 1, []);
    expect(message).toContain("broadening");
  });
});

// =============================================================================
// Edge Cases and Sample Query Testing
// =============================================================================

describe("sample query edge cases", () => {
  /**
   * EDGE CASE 1: Very specific query with all filters
   * Tests that the strategy correctly prioritizes filter removal
   */
  it("handles highly filtered query", () => {
    const params = {
      params: {
        q: "climate change testimony",
        speaker: "Sanders",
        committee: "Budget",
        chamber: "senate" as const,
        from: "2023-06-01",
        to: "2023-06-30",
        type: "hearing",
      },
    };
    const result = buildNoResultsRetryPrompt(params);
    // Should suggest removing date first
    expect(result).toContain("date range start");
  });

  /**
   * EDGE CASE 2: Query with no matching synonyms
   * Tests that the strategy still provides useful guidance
   */
  it("handles query without synonym matches", () => {
    const params = {
      params: {
        q: "NASA funding appropriations",
        speaker: "Nelson",
      },
    };
    const result = buildNoResultsRetryPrompt(params);
    expect(result).not.toContain("Synonym Suggestions");
    expect(result).toContain("speaker");
  });

  /**
   * EDGE CASE 3: Query with only q parameter
   * Tests retry strategy when there are no filters to remove
   */
  it("handles query-only search", () => {
    const params = {
      params: {
        q: "infrastructure bill",
      },
    };
    const strategy = analyzeRetryStrategy(params.params);
    expect(strategy.hasFiltersToRemove).toBe(false);
  });

  /**
   * EDGE CASE 4: Query with special characters
   * Tests that quotes and special chars are handled
   */
  it("handles quoted exact phrase search", () => {
    const params = {
      params: {
        q: '"Build Back Better" plan',
      },
    };
    const strategy = analyzeRetryStrategy(params.params);
    expect(strategy.simplifiedQuery).toBe("Build Back Better plan");
  });

  /**
   * EDGE CASE 5: Multiple synonym-matchable terms
   * Tests compound political queries
   */
  it("handles multiple controversial topics", () => {
    const result = getSynonymsForQuery("How does immigration policy relate to gun control?");
    expect(result.length).toBeGreaterThanOrEqual(2);
  });

  /**
   * EDGE CASE 6: Case sensitivity in synonyms
   * Ensures case-insensitive matching works
   */
  it("matches synonyms regardless of case", () => {
    const result1 = getSynonymsForQuery("CLIMATE CHANGE hearing");
    const result2 = getSynonymsForQuery("Climate Change hearing");
    expect(result1.length).toBe(result2.length);
  });

  /**
   * EDGE CASE 7: Very restrictive date range
   * Common case where user specifies too narrow a window
   */
  it("prioritizes date removal for narrow windows", () => {
    const params = {
      params: {
        q: "healthcare reform",
        from: "2023-06-15",
        to: "2023-06-16",
        speaker: "Pelosi",
      },
    };
    const strategy = analyzeRetryStrategy(params.params);
    expect(strategy.filterToRemove).toBe("from");
  });

  /**
   * EDGE CASE 8: Already exhausted filters
   * Tests behavior when most filters have been removed
   */
  it("suggests final fallback when filters exhausted", () => {
    const params = {
      params: {
        q: "obscure topic query",
        type: "hearing",
      },
    };
    const result = buildNoResultsRetryPrompt(params, {
      retryAttempt: 3,
      removedFilters: ["from", "to", "speaker", "committee"],
      synonymsTried: true,
    });
    expect(result).toContain("Final Fallback");
  });

  /**
   * EDGE CASE 9: Healthcare synonyms
   * Tests healthcare-related term expansion
   */
  it("expands healthcare terminology", () => {
    const result = getSynonymsForQuery("obamacare repeal");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].synonyms).toContain("affordable care act");
  });

  /**
   * EDGE CASE 10: Technology/privacy terms
   * Tests newer policy area synonyms
   */
  it("handles technology policy terms", () => {
    const result = getSynonymsForQuery("big tech antitrust");
    expect(result.length).toBeGreaterThan(0);
    expect(result[0].synonyms).toContain("technology companies");
  });
});
