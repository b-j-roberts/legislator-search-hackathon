/**
 * Legislator Lookup Utility
 *
 * Provides functions for looking up legislators by name, including alias matching.
 * Uses the static legislators.json data file as the source of truth for contact information.
 */

import type { Legislator, ContactInfo, StateAbbreviation, Party, Chamber } from "@/lib/types";
import legislatorsData from "@/lib/data/legislators.json";

/** Raw legislator data from JSON file */
interface RawLegislator {
  id: string;
  bioguideId: string;
  name: string;
  aliases: string[];
  party: string;
  chamber: string;
  state: string;
  district?: string;
  contact: {
    phone?: string;
    fax?: string;
    email?: string;
    office?: string;
    website?: string;
    contactPage?: {
      url: string;
      note?: string;
    };
    socialMedia?: {
      twitter?: string;
      facebook?: string;
      instagram?: string;
      youtube?: string;
    };
  };
}

/** Metadata about the legislators data */
export interface LegislatorsMetadata {
  version: string;
  lastUpdated: string;
  source: string;
  count: number;
}

/**
 * Get metadata about the legislators data
 */
export function getLegislatorsMetadata(): LegislatorsMetadata {
  return {
    version: legislatorsData.version,
    lastUpdated: legislatorsData.lastUpdated,
    source: legislatorsData.source,
    count: legislatorsData.legislators.length,
  };
}

/**
 * Normalize a name for comparison (lowercase, remove extra whitespace, common prefixes)
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^(senator|sen\.|sen|representative|rep\.|rep|congressman|congresswoman|mr\.|ms\.|mrs\.|dr\.)\s+/i, "")
    .replace(/[.,]/g, "");
}

/**
 * Convert raw legislator data to Legislator type
 */
function toClientLegislator(raw: RawLegislator): Legislator {
  const contact: ContactInfo = {
    phone: raw.contact.phone,
    fax: raw.contact.fax,
    email: raw.contact.email,
    website: raw.contact.website,
    office: raw.contact.office,
    contactPage: raw.contact.contactPage,
    socialMedia: raw.contact.socialMedia,
  };

  return {
    id: raw.id,
    name: raw.name,
    aliases: raw.aliases,
    party: raw.party as Party,
    chamber: raw.chamber as Chamber,
    state: raw.state as StateAbbreviation,
    district: raw.district,
    stance: "unknown",
    stanceSummary: "",
    contact,
  };
}

/**
 * Get all legislators from the static data
 */
export function getAllLegislators(): Legislator[] {
  return (legislatorsData.legislators as RawLegislator[]).map(toClientLegislator);
}

/**
 * Find a legislator by their ID
 */
export function findLegislatorById(id: string): Legislator | undefined {
  const raw = (legislatorsData.legislators as RawLegislator[]).find((l) => l.id === id);
  return raw ? toClientLegislator(raw) : undefined;
}

/**
 * Find a legislator by their bioguide ID
 */
export function findLegislatorByBioguideId(bioguideId: string): Legislator | undefined {
  const raw = (legislatorsData.legislators as RawLegislator[]).find(
    (l) => l.bioguideId.toLowerCase() === bioguideId.toLowerCase()
  );
  return raw ? toClientLegislator(raw) : undefined;
}

/**
 * Find legislators by name, including alias matching
 *
 * This function performs a fuzzy search across:
 * - Full name
 * - All aliases
 * - Last name only
 *
 * @param searchName - The name to search for
 * @returns Array of matching legislators, ordered by match quality
 */
export function findLegislatorsByName(searchName: string): Legislator[] {
  const normalizedSearch = normalizeName(searchName);

  if (!normalizedSearch) {
    return [];
  }

  const scored: { legislator: Legislator; score: number }[] = [];

  for (const raw of legislatorsData.legislators as RawLegislator[]) {
    let bestScore = 0;
    const normalizedFullName = normalizeName(raw.name);

    // Exact full name match
    if (normalizedFullName === normalizedSearch) {
      bestScore = 100;
    }
    // Full name contains search
    else if (normalizedFullName.includes(normalizedSearch)) {
      bestScore = Math.max(bestScore, 80);
    }
    // Search contains full name
    else if (normalizedSearch.includes(normalizedFullName)) {
      bestScore = Math.max(bestScore, 70);
    }

    // Check aliases
    for (const alias of raw.aliases) {
      const normalizedAlias = normalizeName(alias);

      // Exact alias match
      if (normalizedAlias === normalizedSearch) {
        bestScore = Math.max(bestScore, 95);
      }
      // Alias contains search
      else if (normalizedAlias.includes(normalizedSearch)) {
        bestScore = Math.max(bestScore, 75);
      }
      // Search contains alias
      else if (normalizedSearch.includes(normalizedAlias)) {
        bestScore = Math.max(bestScore, 65);
      }
    }

    // Last name match (extract from full name)
    const nameParts = normalizedFullName.split(" ");
    const lastName = nameParts[nameParts.length - 1];
    if (lastName === normalizedSearch) {
      bestScore = Math.max(bestScore, 85);
    } else if (lastName.includes(normalizedSearch) || normalizedSearch.includes(lastName)) {
      bestScore = Math.max(bestScore, 60);
    }

    // First name match
    const firstName = nameParts[0];
    if (firstName === normalizedSearch) {
      bestScore = Math.max(bestScore, 50);
    }

    if (bestScore > 0) {
      scored.push({
        legislator: toClientLegislator(raw),
        score: bestScore,
      });
    }
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.legislator);
}

/**
 * Find the best matching legislator for a given name
 *
 * @param searchName - The name to search for
 * @returns The best matching legislator, or undefined if no match found
 */
export function findBestMatchingLegislator(searchName: string): Legislator | undefined {
  const matches = findLegislatorsByName(searchName);
  return matches.length > 0 ? matches[0] : undefined;
}

/**
 * Filter legislators by state
 */
export function filterLegislatorsByState(state: StateAbbreviation): Legislator[] {
  return getAllLegislators().filter((l) => l.state === state);
}

/**
 * Filter legislators by party
 */
export function filterLegislatorsByParty(party: Party): Legislator[] {
  return getAllLegislators().filter((l) => l.party === party);
}

/**
 * Filter legislators by chamber
 */
export function filterLegislatorsByChamber(chamber: Chamber): Legislator[] {
  return getAllLegislators().filter((l) => l.chamber === chamber);
}

/**
 * Get all senators
 */
export function getSenators(): Legislator[] {
  return filterLegislatorsByChamber("Senate");
}

/**
 * Get all representatives
 */
export function getRepresentatives(): Legislator[] {
  return filterLegislatorsByChamber("House");
}

/**
 * Enrich a legislator with contact data from the static file
 *
 * This function takes a legislator object (possibly from an API response)
 * and enriches it with contact information from the static data file.
 *
 * @param legislator - The legislator to enrich
 * @returns The enriched legislator with contact data
 */
export function enrichLegislatorWithContactData(legislator: Legislator): Legislator {
  // Try to find by ID first
  let staticData = findLegislatorById(legislator.id);

  // If not found, try by name
  if (!staticData) {
    staticData = findBestMatchingLegislator(legislator.name);
  }

  // If still not found, return original
  if (!staticData) {
    return legislator;
  }

  // Merge contact data, preferring static data for contact info
  return {
    ...legislator,
    aliases: staticData.aliases,
    contact: {
      ...legislator.contact,
      ...staticData.contact,
      // Keep any existing social media and merge with static
      socialMedia: {
        ...legislator.contact.socialMedia,
        ...staticData.contact.socialMedia,
      },
    },
  };
}

/**
 * Enrich multiple legislators with contact data
 */
export function enrichLegislatorsWithContactData(legislators: Legislator[]): Legislator[] {
  return legislators.map(enrichLegislatorWithContactData);
}

/**
 * Check if a legislator has a contact page
 */
export function hasContactPage(legislator: Legislator): boolean {
  return !!legislator.contact.contactPage?.url;
}

/**
 * Get contact availability for a legislator
 */
export function getContactAvailability(legislator: Legislator): {
  hasPhone: boolean;
  hasFax: boolean;
  hasEmail: boolean;
  hasContactPage: boolean;
  hasWebsite: boolean;
  hasOffice: boolean;
} {
  return {
    hasPhone: !!legislator.contact.phone,
    hasFax: !!legislator.contact.fax,
    hasEmail: !!legislator.contact.email,
    hasContactPage: hasContactPage(legislator),
    hasWebsite: !!legislator.contact.website,
    hasOffice: !!legislator.contact.office,
  };
}
