/**
 * Mock legislator data for development and testing.
 *
 * This file contains realistic mock data that covers various scenarios:
 * - Different parties (D, R, I)
 * - Both chambers (House, Senate)
 * - Various stances (for, against, mixed, unknown)
 * - Different contact availability (phone only, email only, both)
 * - With and without optional fields (votes, statements, etc.)
 *
 * Usage:
 *   import { mockLegislators, mockAdvocacyContext } from '@/lib/fixtures/mock-legislators';
 */

import type { Legislator, AdvocacyContext, ContactMethod } from "@/lib/types";
import { createQueue, saveQueue, loadQueue, clearQueue } from "@/lib/queue-storage";

export const mockLegislators: Legislator[] = [
  // Senator - Democrat - Strongly supports
  {
    id: "sen-warren-ma",
    name: "Elizabeth Warren",
    aliases: [
      "Senator Warren",
      "Sen. Warren",
      "Senator Elizabeth Warren",
      "Ms. Warren",
      "Warren",
    ],
    party: "D",
    chamber: "Senate",
    state: "MA",
    stance: "for",
    stanceSummary:
      "Senator Warren has been a vocal advocate for consumer financial protection and has sponsored multiple bills addressing housing affordability.",
    leaningScore: 85,
    contact: {
      phone: "(202) 224-4543",
      email: "senator@warren.senate.gov",
      website: "https://www.warren.senate.gov",
      office: "309 Hart Senate Office Building, Washington, DC 20510",
      contactPage: {
        url: "https://www.warren.senate.gov/contact",
        note: "Requires name, email, address, and topic selection. Massachusetts residents only.",
      },
      socialMedia: {
        twitter: "@SenWarren",
        facebook: "senatorelizabethwarren",
      },
    },
    relevantVotes: [
      {
        id: "vote-1",
        billId: "S.2155",
        billTitle: "Economic Growth, Regulatory Relief, and Consumer Protection Act",
        vote: "nay",
        date: "2024-03-15",
        description: "Voted against deregulation that could harm consumers",
      },
    ],
    relevantStatements: [
      {
        id: "stmt-1",
        date: "2024-06-10",
        source: "Senate Floor Speech",
        text: "We need to protect working families from predatory lending practices and ensure everyone has access to affordable housing.",
        url: "https://www.c-span.org/video/...",
      },
    ],
    imageUrl: "https://www.congress.gov/img/member/w000817_200.jpg",
    termStart: "2019-01-03",
    nextElection: "2024-11-05",
  },

  // Representative - Republican - Against
  {
    id: "rep-jordan-oh-4",
    name: "Jim Jordan",
    aliases: [
      "Representative Jordan",
      "Rep. Jordan",
      "Congressman Jordan",
      "Rep. Jim Jordan",
      "James Jordan",
      "Jordan",
      "Chairman Jordan",
    ],
    party: "R",
    chamber: "House",
    state: "OH",
    district: "4",
    stance: "against",
    stanceSummary:
      "Representative Jordan has consistently opposed federal intervention in housing markets and voted against recent consumer protection legislation.",
    leaningScore: -72,
    contact: {
      phone: "(202) 225-2676",
      email: "oh04.rep@mail.house.gov",
      website: "https://jordan.house.gov",
      office: "2056 Rayburn House Office Building, Washington, DC 20515",
      contactPage: {
        url: "https://jordan.house.gov/contact",
        note: "Requires name, email, address, and topic selection. OH-4 constituents prioritized.",
      },
      socialMedia: {
        twitter: "@Jim_Jordan",
        facebook: "repjimjordan",
      },
    },
    relevantVotes: [
      {
        id: "vote-2",
        billId: "H.R.4173",
        billTitle: "Dodd-Frank Wall Street Reform Act",
        vote: "nay",
        date: "2023-09-20",
        description: "Voted against financial regulation expansion",
      },
    ],
    imageUrl: "https://www.congress.gov/img/member/j000289_200.jpg",
    termStart: "2007-01-03",
    nextElection: "2024-11-05",
  },

  // Senator - Independent - Mixed stance
  {
    id: "sen-sanders-vt",
    name: "Bernie Sanders",
    aliases: [
      "Senator Sanders",
      "Sen. Sanders",
      "Senator Bernie Sanders",
      "Bernard Sanders",
      "Mr. Sanders",
      "Sanders",
    ],
    party: "I",
    chamber: "Senate",
    state: "VT",
    stance: "mixed",
    stanceSummary:
      "Senator Sanders supports strong consumer protections but has expressed concerns about specific implementation details in recent legislation.",
    leaningScore: 45,
    contact: {
      phone: "(202) 224-5141",
      email: "senator@sanders.senate.gov",
      website: "https://www.sanders.senate.gov",
      office: "332 Dirksen Senate Office Building, Washington, DC 20510",
      contactPage: {
        url: "https://www.sanders.senate.gov/contact/",
        note: "Requires name, email, address, and message. Vermont residents prioritized.",
      },
      socialMedia: {
        twitter: "@SenSanders",
        facebook: "senatorsanders",
        youtube: "seabornie",
      },
    },
    imageUrl: "https://www.congress.gov/img/member/s000033_200.jpg",
    termStart: "2007-01-03",
    nextElection: "2024-11-05",
  },

  // Representative - Democrat - Phone only (no email)
  {
    id: "rep-ocasio-cortez-ny-14",
    name: "Alexandria Ocasio-Cortez",
    aliases: [
      "Representative Ocasio-Cortez",
      "Rep. Ocasio-Cortez",
      "Congresswoman Ocasio-Cortez",
      "AOC",
      "Representative AOC",
      "Alexandria Ocasio Cortez",
      "Ms. Ocasio-Cortez",
      "Ocasio-Cortez",
    ],
    party: "D",
    chamber: "House",
    state: "NY",
    district: "14",
    stance: "for",
    stanceSummary:
      "Representative Ocasio-Cortez has championed affordable housing initiatives and has co-sponsored the Green New Deal for Public Housing Act.",
    leaningScore: 95,
    contact: {
      phone: "(202) 225-3965",
      website: "https://ocasio-cortez.house.gov",
      office: "229 Cannon House Office Building, Washington, DC 20515",
      contactPage: {
        url: "https://ocasio-cortez.house.gov/contact",
        note: "Requires name, email, address, and topic selection. NY-14 constituents only.",
      },
      socialMedia: {
        twitter: "@AOC",
        instagram: "aoc",
      },
    },
    relevantStatements: [
      {
        id: "stmt-2",
        date: "2024-05-22",
        source: "Twitter",
        text: "Housing is a human right. We need to invest in public housing and protect tenants from corporate landlords.",
      },
    ],
    imageUrl: "https://www.congress.gov/img/member/o000172_200.jpg",
    termStart: "2019-01-03",
    nextElection: "2024-11-05",
  },

  // Senator - Republican - Email only (no phone)
  {
    id: "sen-cruz-tx",
    name: "Ted Cruz",
    aliases: [
      "Senator Cruz",
      "Sen. Cruz",
      "Senator Ted Cruz",
      "Rafael Cruz",
      "Rafael Edward Cruz",
      "Mr. Cruz",
      "Cruz",
    ],
    party: "R",
    chamber: "Senate",
    state: "TX",
    stance: "against",
    stanceSummary:
      "Senator Cruz has opposed federal housing assistance programs, arguing for market-based solutions and reduced government involvement.",
    leaningScore: -65,
    contact: {
      email: "senator@cruz.senate.gov",
      website: "https://www.cruz.senate.gov",
      office: "127A Russell Senate Office Building, Washington, DC 20510",
      contactPage: {
        url: "https://www.cruz.senate.gov/contact",
        note: "Requires name, email, address, and topic selection. Texas residents only.",
      },
      socialMedia: {
        twitter: "@SenTedCruz",
        facebook: "SenatorTedCruz",
      },
    },
    imageUrl: "https://www.congress.gov/img/member/c001098_200.jpg",
    termStart: "2013-01-03",
    nextElection: "2024-11-05",
  },

  // Representative - Democrat - Unknown stance (new to issue)
  {
    id: "rep-garcia-ca-42",
    name: "Robert Garcia",
    party: "D",
    chamber: "House",
    state: "CA",
    district: "42",
    stance: "unknown",
    stanceSummary:
      "Representative Garcia has not yet taken a public position on this specific issue but has generally supported consumer protection measures.",
    contact: {
      phone: "(202) 225-7924",
      email: "ca42.rep@mail.house.gov",
      website: "https://robertgarcia.house.gov",
      office: "1305 Longworth House Office Building, Washington, DC 20515",
      socialMedia: {
        twitter: "@RepRobertGarcia",
      },
    },
    imageUrl: "https://www.congress.gov/img/member/g000598_200.jpg",
    termStart: "2023-01-03",
    nextElection: "2024-11-05",
  },

  // Senator - Democrat - Both contact methods
  {
    id: "sen-warnock-ga",
    name: "Raphael Warnock",
    party: "D",
    chamber: "Senate",
    state: "GA",
    stance: "for",
    stanceSummary:
      "Senator Warnock has been a strong advocate for housing equity and has introduced legislation to address housing discrimination.",
    leaningScore: 78,
    contact: {
      phone: "(202) 224-3643",
      email: "senator@warnock.senate.gov",
      website: "https://www.warnock.senate.gov",
      office: "388 Russell Senate Office Building, Washington, DC 20510",
      socialMedia: {
        twitter: "@SenatorWarnock",
        facebook: "SenatorWarnock",
      },
    },
    relevantVotes: [
      {
        id: "vote-3",
        billId: "S.987",
        billTitle: "Fair Housing Improvement Act",
        vote: "yea",
        date: "2024-02-28",
        description: "Voted to strengthen fair housing protections",
      },
    ],
    imageUrl: "https://www.congress.gov/img/member/w000790_200.jpg",
    termStart: "2021-01-20",
    nextElection: "2026-11-03",
  },

  // Representative - Republican - Minimal contact info
  {
    id: "rep-boebert-co-3",
    name: "Lauren Boebert",
    party: "R",
    chamber: "House",
    state: "CO",
    district: "3",
    stance: "against",
    stanceSummary:
      "Representative Boebert has opposed federal housing programs, advocating for reduced government spending and local control.",
    leaningScore: -88,
    contact: {
      phone: "(202) 225-4761",
      office: "1713 Longworth House Office Building, Washington, DC 20515",
    },
    imageUrl: "https://www.congress.gov/img/member/b000825_200.jpg",
    termStart: "2021-01-03",
    nextElection: "2024-11-05",
  },
];

/**
 * Sample advocacy context for testing content generation
 */
export const mockAdvocacyContext: AdvocacyContext = {
  topic: "Consumer Financial Protection and Housing Affordability",
  position: "Support stronger consumer protections and affordable housing initiatives",
  personalStory:
    "As a first-time homebuyer, I've experienced firsthand how difficult it is to navigate predatory lending practices and rising housing costs.",
  specificAsk:
    "Please support the Consumer Financial Protection Enhancement Act and vote for increased funding for affordable housing programs.",
  keyFindings: [
    "Housing costs have increased 45% over the past 5 years",
    "Predatory lending complaints have risen 30% since 2022",
    "The CFPB has recovered $18.7 billion for consumers since its creation",
  ],
};

/**
 * Get a subset of mock legislators for specific test scenarios
 */
export const getMockLegislatorsByScenario = {
  /** Legislators with full contact info (phone + email) */
  withFullContact: () => mockLegislators.filter((l) => l.contact.phone && l.contact.email),

  /** Legislators with phone only */
  phoneOnly: () => mockLegislators.filter((l) => l.contact.phone && !l.contact.email),

  /** Legislators with email only */
  emailOnly: () => mockLegislators.filter((l) => !l.contact.phone && l.contact.email),

  /** Legislators who support the issue */
  supporters: () => mockLegislators.filter((l) => l.stance === "for"),

  /** Legislators who oppose the issue */
  opponents: () => mockLegislators.filter((l) => l.stance === "against"),

  /** Senate only */
  senators: () => mockLegislators.filter((l) => l.chamber === "Senate"),

  /** House only */
  representatives: () => mockLegislators.filter((l) => l.chamber === "House"),

  /** By party */
  byParty: (party: "D" | "R" | "I") => mockLegislators.filter((l) => l.party === party),
};

// =============================================================================
// Dev Helpers
// =============================================================================

/**
 * Check if we're in development mode
 */
export function isDevMode(): boolean {
  return process.env.NODE_ENV === "development";
}

/**
 * Check if mock data feature flag is enabled.
 * Requires NEXT_PUBLIC_USE_MOCK_DATA=true to enable.
 * Disabled by default even in development mode.
 */
export function useMockData(): boolean {
  return process.env.NEXT_PUBLIC_USE_MOCK_DATA === "true";
}

/**
 * Load mock legislators into the contact queue for development testing.
 * This saves directly to localStorage and returns the created queue.
 *
 * Usage in browser console:
 *   import { loadDevFixtures } from '@/lib/fixtures/mock-legislators';
 *   loadDevFixtures();
 *   // Then refresh the /contact page
 *
 * @param legislators - Optional custom list of legislators (defaults to all mock legislators)
 * @param defaultMethod - Default contact method (defaults to "email")
 * @returns The created queue storage object
 */
export function loadDevFixtures(
  legislators: Legislator[] = mockLegislators,
  defaultMethod: ContactMethod = "email"
) {
  const queue = createQueue(
    legislators,
    mockAdvocacyContext.topic,
    defaultMethod,
    mockAdvocacyContext,
    ["topic", "position", "specificAsk", "keyFindings"]
  );

  saveQueue(queue);
  console.log(`[Dev] Loaded ${legislators.length} mock legislators into contact queue`);
  console.log("[Dev] Refresh the page or navigate to /contact to see them");

  return queue;
}

/**
 * Clear the dev fixtures from localStorage
 */
export function clearDevFixtures() {
  clearQueue();
  console.log("[Dev] Cleared contact queue from localStorage");
}

/**
 * Check if dev fixtures should be auto-loaded.
 * Returns true if mock data flag is enabled AND no existing queue data.
 */
export function shouldAutoLoadFixtures(): boolean {
  if (!useMockData()) return false;
  if (typeof window === "undefined") return false;

  const existingQueue = loadQueue();
  return existingQueue === null || existingQueue.items.length === 0;
}

/**
 * Auto-load fixtures if appropriate (mock data flag enabled + no existing data).
 * Call this from the contact page's useEffect.
 *
 * @returns true if fixtures were loaded, false otherwise
 */
export function autoLoadFixturesIfNeeded(): boolean {
  if (!shouldAutoLoadFixtures()) {
    return false;
  }

  loadDevFixtures();
  return true;
}

// Expose to window for easy browser console access in dev mode
if (typeof window !== "undefined" && isDevMode()) {
  (window as unknown as Record<string, unknown>).devFixtures = {
    load: loadDevFixtures,
    clear: clearDevFixtures,
    legislators: mockLegislators,
    advocacyContext: mockAdvocacyContext,
    scenarios: getMockLegislatorsByScenario,
  };
  console.log("[Dev] Mock fixtures available: window.devFixtures.load(), window.devFixtures.clear()");
  console.log("[Dev] To enable auto-loading mock data, set NEXT_PUBLIC_USE_MOCK_DATA=true");
}
