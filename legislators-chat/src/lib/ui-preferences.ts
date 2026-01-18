/**
 * UI Preferences Storage
 *
 * Handles localStorage persistence for UI preferences like panel sizes,
 * collapsed states, and other user interface preferences.
 */

// =============================================================================
// Types
// =============================================================================

export interface UIPreferences {
  /** Contact queue sidebar width in pixels */
  contactQueueWidth: number;
  /** Whether queue items are collapsed by default */
  queueItemsCollapsed: boolean;
  /** Version for migrations */
  version: number;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = "legislators-chat-ui-preferences";
const CURRENT_VERSION = 1;

/** Default preferences */
const DEFAULT_PREFERENCES: UIPreferences = {
  contactQueueWidth: 384, // max-w-sm = 24rem = 384px
  queueItemsCollapsed: false,
  version: CURRENT_VERSION,
};

/** Min/max constraints for queue width */
export const QUEUE_WIDTH_MIN = 280;
export const QUEUE_WIDTH_MAX = 500;

// =============================================================================
// Storage Functions
// =============================================================================

/**
 * Load UI preferences from localStorage
 */
export function loadUIPreferences(): UIPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return DEFAULT_PREFERENCES;
    }

    const parsed = JSON.parse(stored) as Partial<UIPreferences>;

    // Merge with defaults and validate
    return {
      ...DEFAULT_PREFERENCES,
      ...parsed,
      // Ensure width is within bounds
      contactQueueWidth: Math.max(
        QUEUE_WIDTH_MIN,
        Math.min(QUEUE_WIDTH_MAX, parsed.contactQueueWidth ?? DEFAULT_PREFERENCES.contactQueueWidth)
      ),
      version: CURRENT_VERSION,
    };
  } catch (error) {
    console.error("Failed to load UI preferences:", error);
    return DEFAULT_PREFERENCES;
  }
}

/**
 * Save UI preferences to localStorage
 */
export function saveUIPreferences(preferences: Partial<UIPreferences>): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    const current = loadUIPreferences();
    const updated: UIPreferences = {
      ...current,
      ...preferences,
      version: CURRENT_VERSION,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error("Failed to save UI preferences:", error);
  }
}

/**
 * Update a single preference value
 */
export function updateUIPreference<K extends keyof UIPreferences>(
  key: K,
  value: UIPreferences[K]
): void {
  saveUIPreferences({ [key]: value });
}

/**
 * Reset all UI preferences to defaults
 */
export function resetUIPreferences(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to reset UI preferences:", error);
  }
}
