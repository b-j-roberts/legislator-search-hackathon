/**
 * Legislator Lookup Utility
 *
 * Provides functions for looking up legislators by name, including alias matching.
 * Uses the static legislators.json data files as the source of truth for contact information.
 * Supports multiple congresses (117, 118, 119) for historical data.
 */

import type { Legislator, ContactInfo, StateAbbreviation, Party, Chamber, CongressNumber, LegislatorStatus } from "@/lib/types";
import legislators117Data from "@/lib/data/legislators-117.json";
import legislators118Data from "@/lib/data/legislators-118.json";
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
  congress?: number;
  status?: string;
  termEnd?: string;
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

/** Raw data file structure */
interface RawLegislatorsFile {
  congress: number;
  version: string;
  lastUpdated: string;
  source: string;
  dateRange?: {
    start: string;
    end: string;
  };
  legislators: RawLegislator[];
}

/** All congress data files */
const congressDataFiles: Record<CongressNumber, RawLegislatorsFile> = {
  117: legislators117Data as RawLegislatorsFile,
  118: legislators118Data as RawLegislatorsFile,
  119: legislatorsData as RawLegislatorsFile,
};

/** Available congress numbers */
export const AVAILABLE_CONGRESSES: CongressNumber[] = [117, 118, 119];

/** Current congress number */
export const CURRENT_CONGRESS: CongressNumber = 119;

/** Metadata about the legislators data */
export interface LegislatorsMetadata {
  version: string;
  lastUpdated: string;
  source: string;
  count: number;
  congress: CongressNumber;
  dateRange?: {
    start: string;
    end: string;
  };
}

/**
 * Get metadata about the legislators data for a specific congress
 */
export function getLegislatorsMetadata(congress: CongressNumber = CURRENT_CONGRESS): LegislatorsMetadata {
  const data = congressDataFiles[congress];
  return {
    version: data.version,
    lastUpdated: data.lastUpdated,
    source: data.source,
    count: data.legislators.length,
    congress: data.congress as CongressNumber,
    dateRange: data.dateRange,
  };
}

/**
 * Get metadata for all available congresses
 */
export function getAllCongressesMetadata(): LegislatorsMetadata[] {
  return AVAILABLE_CONGRESSES.map(getLegislatorsMetadata);
}

/**
 * Generate the official Congress.gov profile image URL for a legislator
 * @param bioguideId - The bioguide ID (e.g., "W000817")
 * @returns URL to the official 200px member photo
 */
export function getCongressImageUrl(bioguideId: string): string {
  return `https://www.congress.gov/img/member/${bioguideId.toLowerCase()}_200.jpg`;
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
    congress: raw.congress as CongressNumber | undefined,
    status: raw.status as LegislatorStatus | undefined,
    termEnd: raw.termEnd,
    stance: "unknown",
    stanceSummary: "",
    contact,
    // Generate official Congress.gov profile image from bioguide ID
    imageUrl: getCongressImageUrl(raw.bioguideId),
  };
}

/**
 * Get all legislators from a specific congress
 */
export function getLegislatorsByCongress(congress: CongressNumber): Legislator[] {
  const data = congressDataFiles[congress];
  return (data.legislators as RawLegislator[]).map(toClientLegislator);
}

/**
 * Get all legislators from all congresses (combined)
 * Note: This may include duplicates of the same person across different congresses
 */
export function getAllLegislatorsAllCongresses(): Legislator[] {
  return AVAILABLE_CONGRESSES.flatMap(getLegislatorsByCongress);
}

/**
 * Get all legislators from the current congress (default behavior)
 * For backwards compatibility, this returns current congress legislators only.
 * Use getAllLegislatorsAllCongresses() to get all or getLegislatorsByCongress() for specific.
 */
export function getAllLegislators(): Legislator[] {
  return getLegislatorsByCongress(CURRENT_CONGRESS);
}

/**
 * Find a legislator by their ID (searches all congresses)
 */
export function findLegislatorById(id: string): Legislator | undefined {
  for (const congress of AVAILABLE_CONGRESSES) {
    const data = congressDataFiles[congress];
    const raw = (data.legislators as RawLegislator[]).find((l) => l.id === id);
    if (raw) return toClientLegislator(raw);
  }
  return undefined;
}

/**
 * Find a legislator by their bioguide ID (searches all congresses, returns most recent)
 */
export function findLegislatorByBioguideId(bioguideId: string): Legislator | undefined {
  // Search from most recent congress first
  for (const congress of [...AVAILABLE_CONGRESSES].reverse()) {
    const data = congressDataFiles[congress];
    const raw = (data.legislators as RawLegislator[]).find(
      (l) => l.bioguideId.toLowerCase() === bioguideId.toLowerCase()
    );
    if (raw) return toClientLegislator(raw);
  }
  return undefined;
}

/** Options for searching legislators by name */
export interface FindLegislatorsOptions {
  /** Which congresses to search (default: current congress only) */
  congresses?: CongressNumber[];
  /** Search all congresses (overrides congresses option) */
  allCongresses?: boolean;
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
 * @param options - Search options
 * @returns Array of matching legislators, ordered by match quality
 */
export function findLegislatorsByName(searchName: string, options?: FindLegislatorsOptions): Legislator[] {
  const normalizedSearch = normalizeName(searchName);

  if (!normalizedSearch) {
    return [];
  }

  const congressesToSearch = options?.allCongresses
    ? AVAILABLE_CONGRESSES
    : options?.congresses ?? [CURRENT_CONGRESS];

  const scored: { legislator: Legislator; score: number }[] = [];

  for (const congress of congressesToSearch) {
    const data = congressDataFiles[congress];
    for (const raw of data.legislators as RawLegislator[]) {
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
  }

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  return scored.map((s) => s.legislator);
}

/**
 * Find the best matching legislator for a given name
 * By default, searches all congresses to find the best match.
 *
 * @param searchName - The name to search for
 * @param options - Search options
 * @returns The best matching legislator, or undefined if no match found
 */
export function findBestMatchingLegislator(searchName: string, options?: FindLegislatorsOptions): Legislator | undefined {
  // Default to searching all congresses for best matching
  const searchOptions = options ?? { allCongresses: true };
  const matches = findLegislatorsByName(searchName, searchOptions);
  return matches.length > 0 ? matches[0] : undefined;
}

/** Options for filtering legislators */
export interface FilterOptions {
  /** Which congresses to include */
  congresses?: CongressNumber[];
  /** Include all congresses */
  allCongresses?: boolean;
}

/**
 * Get legislators based on filter options
 */
function getLegislatorsForFilter(options?: FilterOptions): Legislator[] {
  if (options?.allCongresses) {
    return getAllLegislatorsAllCongresses();
  }
  if (options?.congresses) {
    return options.congresses.flatMap(getLegislatorsByCongress);
  }
  return getAllLegislators();
}

/**
 * Filter legislators by state
 */
export function filterLegislatorsByState(state: StateAbbreviation, options?: FilterOptions): Legislator[] {
  return getLegislatorsForFilter(options).filter((l) => l.state === state);
}

/**
 * Filter legislators by party
 */
export function filterLegislatorsByParty(party: Party, options?: FilterOptions): Legislator[] {
  return getLegislatorsForFilter(options).filter((l) => l.party === party);
}

/**
 * Filter legislators by chamber
 */
export function filterLegislatorsByChamber(chamber: Chamber, options?: FilterOptions): Legislator[] {
  return getLegislatorsForFilter(options).filter((l) => l.chamber === chamber);
}

/**
 * Get all senators
 */
export function getSenators(options?: FilterOptions): Legislator[] {
  return filterLegislatorsByChamber("Senate", options);
}

/**
 * Get all representatives
 */
export function getRepresentatives(options?: FilterOptions): Legislator[] {
  return filterLegislatorsByChamber("House", options);
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
    // Use static data imageUrl if available, otherwise keep existing
    imageUrl: staticData.imageUrl || legislator.imageUrl,
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
