"use client";

import * as React from "react";
import type {
  Legislator,
  Party,
  Chamber,
  Stance,
  StateAbbreviation,
  SortOption,
  Filter,
} from "@/lib/types";

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = "legislators-chat-filters";

export const PARTY_OPTIONS: { value: Party; label: string }[] = [
  { value: "D", label: "Democrat" },
  { value: "R", label: "Republican" },
  { value: "I", label: "Independent" },
];

export const CHAMBER_OPTIONS: { value: Chamber; label: string }[] = [
  { value: "House", label: "House" },
  { value: "Senate", label: "Senate" },
];

export const STANCE_OPTIONS: { value: Stance; label: string }[] = [
  { value: "for", label: "Supports" },
  { value: "against", label: "Opposes" },
  { value: "mixed", label: "Mixed" },
  { value: "unknown", label: "Unknown" },
];

export const STATE_OPTIONS: { value: StateAbbreviation; label: string }[] = [
  { value: "AL", label: "Alabama" },
  { value: "AK", label: "Alaska" },
  { value: "AZ", label: "Arizona" },
  { value: "AR", label: "Arkansas" },
  { value: "CA", label: "California" },
  { value: "CO", label: "Colorado" },
  { value: "CT", label: "Connecticut" },
  { value: "DE", label: "Delaware" },
  { value: "FL", label: "Florida" },
  { value: "GA", label: "Georgia" },
  { value: "HI", label: "Hawaii" },
  { value: "ID", label: "Idaho" },
  { value: "IL", label: "Illinois" },
  { value: "IN", label: "Indiana" },
  { value: "IA", label: "Iowa" },
  { value: "KS", label: "Kansas" },
  { value: "KY", label: "Kentucky" },
  { value: "LA", label: "Louisiana" },
  { value: "ME", label: "Maine" },
  { value: "MD", label: "Maryland" },
  { value: "MA", label: "Massachusetts" },
  { value: "MI", label: "Michigan" },
  { value: "MN", label: "Minnesota" },
  { value: "MS", label: "Mississippi" },
  { value: "MO", label: "Missouri" },
  { value: "MT", label: "Montana" },
  { value: "NE", label: "Nebraska" },
  { value: "NV", label: "Nevada" },
  { value: "NH", label: "New Hampshire" },
  { value: "NJ", label: "New Jersey" },
  { value: "NM", label: "New Mexico" },
  { value: "NY", label: "New York" },
  { value: "NC", label: "North Carolina" },
  { value: "ND", label: "North Dakota" },
  { value: "OH", label: "Ohio" },
  { value: "OK", label: "Oklahoma" },
  { value: "OR", label: "Oregon" },
  { value: "PA", label: "Pennsylvania" },
  { value: "RI", label: "Rhode Island" },
  { value: "SC", label: "South Carolina" },
  { value: "SD", label: "South Dakota" },
  { value: "TN", label: "Tennessee" },
  { value: "TX", label: "Texas" },
  { value: "UT", label: "Utah" },
  { value: "VT", label: "Vermont" },
  { value: "VA", label: "Virginia" },
  { value: "WA", label: "Washington" },
  { value: "WV", label: "West Virginia" },
  { value: "WI", label: "Wisconsin" },
  { value: "WY", label: "Wyoming" },
  { value: "DC", label: "Washington D.C." },
  { value: "PR", label: "Puerto Rico" },
  { value: "GU", label: "Guam" },
  { value: "VI", label: "Virgin Islands" },
  { value: "AS", label: "American Samoa" },
  { value: "MP", label: "Northern Mariana Islands" },
];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "relevance", label: "Relevance" },
  { value: "name", label: "Name (A-Z)" },
  { value: "state", label: "State" },
  { value: "party", label: "Party" },
];

// =============================================================================
// Types
// =============================================================================

export interface FilterState {
  parties: Party[];
  chambers: Chamber[];
  states: StateAbbreviation[];
  stances: Stance[];
  sortBy: SortOption;
}

export interface UseFiltersReturn {
  /** Current filter state */
  filters: FilterState;

  /** Set party filters */
  setParties: (parties: Party[]) => void;
  /** Toggle a single party */
  toggleParty: (party: Party) => void;

  /** Set chamber filters */
  setChambers: (chambers: Chamber[]) => void;
  /** Toggle a single chamber */
  toggleChamber: (chamber: Chamber) => void;

  /** Set state filters */
  setStates: (states: StateAbbreviation[]) => void;
  /** Toggle a single state */
  toggleState: (state: StateAbbreviation) => void;

  /** Set stance filters */
  setStances: (stances: Stance[]) => void;
  /** Toggle a single stance */
  toggleStance: (stance: Stance) => void;

  /** Set sort option */
  setSortBy: (sortBy: SortOption) => void;

  /** Clear all filters */
  clearFilters: () => void;

  /** Check if any filters are active */
  hasActiveFilters: boolean;

  /** Number of active filters */
  activeFilterCount: number;

  /** Get active filters as Filter array (for API) */
  getFiltersArray: () => Filter[];

  /** Apply filters and sorting to a legislators array */
  applyFilters: (legislators: Legislator[]) => Legislator[];
}

// =============================================================================
// Helper Functions
// =============================================================================

function getDefaultState(): FilterState {
  return {
    parties: [],
    chambers: [],
    states: [],
    stances: [],
    sortBy: "relevance",
  };
}

function loadFromStorage(): FilterState {
  if (typeof window === "undefined") {
    return getDefaultState();
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        ...getDefaultState(),
        ...parsed,
      };
    }
  } catch {
    // Ignore parse errors
  }

  return getDefaultState();
}

function saveToStorage(state: FilterState): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
}

function sortLegislators(legislators: Legislator[], sortBy: SortOption): Legislator[] {
  const sorted = [...legislators];

  switch (sortBy) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "state":
      return sorted.sort((a, b) => a.state.localeCompare(b.state));
    case "party":
      // Sort order: D, I, R
      const partyOrder: Record<Party, number> = { D: 0, I: 1, R: 2 };
      return sorted.sort((a, b) => partyOrder[a.party] - partyOrder[b.party]);
    case "relevance":
    default:
      // Keep original order (relevance from API)
      return sorted;
  }
}

// =============================================================================
// Hook
// =============================================================================

export function useFilters(): UseFiltersReturn {
  const [filters, setFilters] = React.useState<FilterState>(getDefaultState);
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Hydrate from localStorage on mount
  React.useEffect(() => {
    setFilters(loadFromStorage());
    setIsHydrated(true);
  }, []);

  // Persist to localStorage on changes (after hydration)
  React.useEffect(() => {
    if (isHydrated) {
      saveToStorage(filters);
    }
  }, [filters, isHydrated]);

  const setParties = React.useCallback((parties: Party[]) => {
    setFilters((prev) => ({ ...prev, parties }));
  }, []);

  const toggleParty = React.useCallback((party: Party) => {
    setFilters((prev) => ({
      ...prev,
      parties: prev.parties.includes(party)
        ? prev.parties.filter((p) => p !== party)
        : [...prev.parties, party],
    }));
  }, []);

  const setChambers = React.useCallback((chambers: Chamber[]) => {
    setFilters((prev) => ({ ...prev, chambers }));
  }, []);

  const toggleChamber = React.useCallback((chamber: Chamber) => {
    setFilters((prev) => ({
      ...prev,
      chambers: prev.chambers.includes(chamber)
        ? prev.chambers.filter((c) => c !== chamber)
        : [...prev.chambers, chamber],
    }));
  }, []);

  const setStates = React.useCallback((states: StateAbbreviation[]) => {
    setFilters((prev) => ({ ...prev, states }));
  }, []);

  const toggleState = React.useCallback((state: StateAbbreviation) => {
    setFilters((prev) => ({
      ...prev,
      states: prev.states.includes(state)
        ? prev.states.filter((s) => s !== state)
        : [...prev.states, state],
    }));
  }, []);

  const setStances = React.useCallback((stances: Stance[]) => {
    setFilters((prev) => ({ ...prev, stances }));
  }, []);

  const toggleStance = React.useCallback((stance: Stance) => {
    setFilters((prev) => ({
      ...prev,
      stances: prev.stances.includes(stance)
        ? prev.stances.filter((s) => s !== stance)
        : [...prev.stances, stance],
    }));
  }, []);

  const setSortBy = React.useCallback((sortBy: SortOption) => {
    setFilters((prev) => ({ ...prev, sortBy }));
  }, []);

  const clearFilters = React.useCallback(() => {
    setFilters(getDefaultState());
  }, []);

  const hasActiveFilters =
    filters.parties.length > 0 ||
    filters.chambers.length > 0 ||
    filters.states.length > 0 ||
    filters.stances.length > 0;

  const activeFilterCount =
    filters.parties.length +
    filters.chambers.length +
    filters.states.length +
    filters.stances.length;

  const getFiltersArray = React.useCallback((): Filter[] => {
    const result: Filter[] = [];

    for (const party of filters.parties) {
      result.push({ type: "party", value: party });
    }
    for (const chamber of filters.chambers) {
      result.push({ type: "chamber", value: chamber });
    }
    for (const state of filters.states) {
      result.push({ type: "state", value: state });
    }
    for (const stance of filters.stances) {
      result.push({ type: "stance", value: stance });
    }

    return result;
  }, [filters]);

  const applyFilters = React.useCallback(
    (legislators: Legislator[]): Legislator[] => {
      let filtered = legislators;

      // Apply party filter
      if (filters.parties.length > 0) {
        filtered = filtered.filter((l) => filters.parties.includes(l.party));
      }

      // Apply chamber filter
      if (filters.chambers.length > 0) {
        filtered = filtered.filter((l) => filters.chambers.includes(l.chamber));
      }

      // Apply state filter
      if (filters.states.length > 0) {
        filtered = filtered.filter((l) => filters.states.includes(l.state));
      }

      // Apply stance filter
      if (filters.stances.length > 0) {
        filtered = filtered.filter((l) => filters.stances.includes(l.stance));
      }

      // Apply sorting
      return sortLegislators(filtered, filters.sortBy);
    },
    [filters]
  );

  return {
    filters,
    setParties,
    toggleParty,
    setChambers,
    toggleChamber,
    setStates,
    toggleState,
    setStances,
    toggleStance,
    setSortBy,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    getFiltersArray,
    applyFilters,
  };
}
