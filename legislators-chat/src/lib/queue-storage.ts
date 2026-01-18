/**
 * Contact Queue Storage
 *
 * Handles localStorage persistence for the contact queue, including
 * the order of legislators, which ones have been contacted, and the
 * currently active legislator.
 */

import type { Legislator, ContactMethod, CallScript, EmailDraft } from "./types";

// =============================================================================
// Types
// =============================================================================

/** Contact status for a legislator in the queue */
export type ContactStatus = "pending" | "active" | "contacted" | "skipped";

/** Outcome of a contact attempt */
export type ContactOutcome = "successful" | "voicemail" | "no_answer" | "busy" | "sent";

/** Saved draft for a legislator */
export interface SavedDraft {
  contentType: "call" | "email";
  callScript?: CallScript;
  emailDraft?: EmailDraft;
  selectedSubjectIndex?: number;
  savedAt: string;
}

/** A queue item wrapping a legislator with status */
export interface QueueItem {
  legislator: Legislator;
  status: ContactStatus;
  contactedAt?: string;
  notes?: string;
  /** Preferred contact method for this legislator */
  contactMethod?: ContactMethod;
  /** Outcome of the contact (when status is 'contacted') */
  contactOutcome?: ContactOutcome;
  /** Saved draft for this legislator */
  savedDraft?: SavedDraft;
}

/** Storage format for the contact queue */
export interface QueueStorage {
  items: QueueItem[];
  activeIndex: number;
  researchContext: string | null;
  /** User's default contact method preference */
  defaultContactMethod: ContactMethod;
  version: number;
}

// =============================================================================
// Constants
// =============================================================================

const STORAGE_KEY = "legislators-chat-contact-queue";
const CURRENT_VERSION = 1;

// =============================================================================
// Storage Functions
// =============================================================================

/**
 * Load the contact queue from localStorage
 */
export function loadQueue(): QueueStorage | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return null;
    }

    const parsed = JSON.parse(stored) as QueueStorage;

    // Version check and migration if needed
    if (parsed.version !== CURRENT_VERSION) {
      return migrateQueue(parsed);
    }

    return parsed;
  } catch (error) {
    console.error("Failed to load contact queue:", error);
    return null;
  }
}

/**
 * Save the contact queue to localStorage
 */
export function saveQueue(queue: QueueStorage): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.error("Failed to save contact queue:", error);
  }
}

/**
 * Clear the contact queue from localStorage
 */
export function clearQueue(): void {
  if (typeof window === "undefined") {
    return;
  }

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Failed to clear contact queue:", error);
  }
}

/**
 * Create a new queue from selected legislators
 */
export function createQueue(
  legislators: Legislator[],
  researchContext: string | null = null,
  defaultContactMethod: ContactMethod = "email"
): QueueStorage {
  return {
    items: legislators.map((legislator, index) => ({
      legislator,
      status: index === 0 ? "active" : "pending",
      // Default to email if no phone, otherwise use default preference
      contactMethod: !legislator.contact.phone ? "email" : defaultContactMethod,
    })),
    activeIndex: legislators.length > 0 ? 0 : -1,
    researchContext,
    defaultContactMethod,
    version: CURRENT_VERSION,
  };
}

/**
 * Migrate queue from older versions
 */
function migrateQueue(queue: QueueStorage): QueueStorage {
  // Add defaultContactMethod if missing (from v1 to v2)
  const migrated: QueueStorage = {
    ...queue,
    defaultContactMethod: queue.defaultContactMethod ?? "email",
    version: CURRENT_VERSION,
  };

  // Ensure all items have contactMethod set
  migrated.items = migrated.items.map((item) => ({
    ...item,
    contactMethod:
      item.contactMethod ?? (!item.legislator.contact.phone ? "email" : migrated.defaultContactMethod),
  }));

  return migrated;
}

// =============================================================================
// Queue Operations
// =============================================================================

/**
 * Reorder items in the queue
 */
export function reorderQueue(
  queue: QueueStorage,
  fromIndex: number,
  toIndex: number
): QueueStorage {
  const newItems = [...queue.items];
  const [movedItem] = newItems.splice(fromIndex, 1);
  newItems.splice(toIndex, 0, movedItem);

  // Recalculate active index if needed
  let newActiveIndex = queue.activeIndex;
  if (fromIndex === queue.activeIndex) {
    newActiveIndex = toIndex;
  } else if (fromIndex < queue.activeIndex && toIndex >= queue.activeIndex) {
    newActiveIndex--;
  } else if (fromIndex > queue.activeIndex && toIndex <= queue.activeIndex) {
    newActiveIndex++;
  }

  return {
    ...queue,
    items: newItems,
    activeIndex: newActiveIndex,
  };
}

/**
 * Mark the current active legislator as contacted and move to next
 */
export function markContacted(
  queue: QueueStorage,
  outcome?: ContactOutcome,
  notes?: string
): QueueStorage {
  if (queue.activeIndex < 0 || queue.activeIndex >= queue.items.length) {
    return queue;
  }

  const newItems = [...queue.items];
  newItems[queue.activeIndex] = {
    ...newItems[queue.activeIndex],
    status: "contacted",
    contactedAt: new Date().toISOString(),
    contactOutcome: outcome,
    notes: notes || newItems[queue.activeIndex].notes,
  };

  // Find next pending item
  let nextActiveIndex = -1;
  for (let i = queue.activeIndex + 1; i < newItems.length; i++) {
    if (newItems[i].status === "pending") {
      nextActiveIndex = i;
      newItems[i] = { ...newItems[i], status: "active" };
      break;
    }
  }

  return {
    ...queue,
    items: newItems,
    activeIndex: nextActiveIndex,
  };
}

/**
 * Skip the current legislator (move to end of queue)
 */
export function skipCurrent(queue: QueueStorage): QueueStorage {
  if (queue.activeIndex < 0 || queue.activeIndex >= queue.items.length) {
    return queue;
  }

  const newItems = [...queue.items];
  const [skippedItem] = newItems.splice(queue.activeIndex, 1);

  // Add back to end as pending
  newItems.push({
    ...skippedItem,
    status: "pending",
  });

  // Find next pending item (which should now be at current index)
  let nextActiveIndex = -1;
  for (let i = 0; i < newItems.length; i++) {
    if (newItems[i].status === "pending") {
      nextActiveIndex = i;
      newItems[i] = { ...newItems[i], status: "active" };
      break;
    }
  }

  return {
    ...queue,
    items: newItems,
    activeIndex: nextActiveIndex,
  };
}

/**
 * Remove a legislator from the queue
 */
export function removeFromQueue(queue: QueueStorage, legislatorId: string): QueueStorage {
  const removeIndex = queue.items.findIndex((item) => item.legislator.id === legislatorId);

  if (removeIndex === -1) {
    return queue;
  }

  const newItems = queue.items.filter((item) => item.legislator.id !== legislatorId);

  // Adjust active index
  let newActiveIndex = queue.activeIndex;
  const wasActive = removeIndex === queue.activeIndex;

  if (removeIndex < queue.activeIndex) {
    newActiveIndex--;
  } else if (wasActive) {
    // Find next pending item
    newActiveIndex = -1;
    for (let i = removeIndex; i < newItems.length; i++) {
      if (newItems[i].status === "pending") {
        newActiveIndex = i;
        newItems[i] = { ...newItems[i], status: "active" };
        break;
      }
    }
    // If no pending after, check before
    if (newActiveIndex === -1) {
      for (let i = removeIndex - 1; i >= 0; i--) {
        if (newItems[i].status === "pending") {
          newActiveIndex = i;
          newItems[i] = { ...newItems[i], status: "active" };
          break;
        }
      }
    }
  }

  return {
    ...queue,
    items: newItems,
    activeIndex: newActiveIndex,
  };
}

/**
 * Set a specific legislator as active
 */
export function setActive(queue: QueueStorage, legislatorId: string): QueueStorage {
  const newIndex = queue.items.findIndex((item) => item.legislator.id === legislatorId);

  if (newIndex === -1) {
    return queue;
  }

  const newItems = queue.items.map((item, index) => {
    if (index === queue.activeIndex && item.status === "active") {
      return { ...item, status: "pending" as ContactStatus };
    }
    if (index === newIndex) {
      return { ...item, status: "active" as ContactStatus };
    }
    return item;
  });

  return {
    ...queue,
    items: newItems,
    activeIndex: newIndex,
  };
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Get count of contacted legislators
 */
export function getContactedCount(queue: QueueStorage): number {
  return queue.items.filter((item) => item.status === "contacted").length;
}

/**
 * Get count of remaining (pending + active) legislators
 */
export function getRemainingCount(queue: QueueStorage): number {
  return queue.items.filter((item) => item.status === "pending" || item.status === "active").length;
}

/**
 * Check if all legislators have been contacted
 */
export function isQueueComplete(queue: QueueStorage): boolean {
  return queue.items.every((item) => item.status === "contacted");
}

// =============================================================================
// Contact Method Functions
// =============================================================================

/**
 * Set the contact method for a specific legislator in the queue
 */
export function setContactMethod(
  queue: QueueStorage,
  legislatorId: string,
  method: ContactMethod
): QueueStorage {
  const itemIndex = queue.items.findIndex((item) => item.legislator.id === legislatorId);

  if (itemIndex === -1) {
    return queue;
  }

  const legislator = queue.items[itemIndex].legislator;

  // If trying to set call but no phone, keep email
  if (method === "call" && !legislator.contact.phone) {
    return queue;
  }

  // If trying to set email but no email, keep call
  if (method === "email" && !legislator.contact.email) {
    return queue;
  }

  const newItems = [...queue.items];
  newItems[itemIndex] = {
    ...newItems[itemIndex],
    contactMethod: method,
  };

  return {
    ...queue,
    items: newItems,
  };
}

/**
 * Set the default contact method and optionally apply to all pending items
 */
export function setDefaultContactMethod(
  queue: QueueStorage,
  method: ContactMethod,
  applyToAll: boolean = false
): QueueStorage {
  const newQueue: QueueStorage = {
    ...queue,
    defaultContactMethod: method,
  };

  if (applyToAll) {
    newQueue.items = queue.items.map((item) => {
      // Only update pending/active items, not contacted ones
      if (item.status === "contacted") {
        return item;
      }

      // Respect availability - can't set call if no phone
      if (method === "call" && !item.legislator.contact.phone) {
        return item;
      }
      // Can't set email if no email
      if (method === "email" && !item.legislator.contact.email) {
        return item;
      }

      return {
        ...item,
        contactMethod: method,
      };
    });
  }

  return newQueue;
}

/**
 * Get the effective contact method for a legislator (respecting availability)
 */
export function getEffectiveContactMethod(item: QueueItem): ContactMethod {
  const { legislator, contactMethod } = item;
  const preferred = contactMethod ?? "email";

  // If preferred is call but no phone, fall back to email
  if (preferred === "call" && !legislator.contact.phone) {
    return "email";
  }

  // If preferred is email but no email, fall back to call
  if (preferred === "email" && !legislator.contact.email) {
    return "call";
  }

  return preferred;
}

/**
 * Check what contact methods are available for a legislator
 */
export function getContactAvailability(legislator: Legislator): {
  hasPhone: boolean;
  hasEmail: boolean;
  hasBoth: boolean;
} {
  const hasPhone = Boolean(legislator.contact.phone);
  const hasEmail = Boolean(legislator.contact.email);

  return {
    hasPhone,
    hasEmail,
    hasBoth: hasPhone && hasEmail,
  };
}

// =============================================================================
// Draft Management Functions
// =============================================================================

/**
 * Save a draft for a legislator in the queue
 */
export function saveDraft(
  queue: QueueStorage,
  legislatorId: string,
  draft: Omit<SavedDraft, "savedAt">
): QueueStorage {
  const itemIndex = queue.items.findIndex((item) => item.legislator.id === legislatorId);

  if (itemIndex === -1) {
    return queue;
  }

  const newItems = [...queue.items];
  newItems[itemIndex] = {
    ...newItems[itemIndex],
    savedDraft: {
      ...draft,
      savedAt: new Date().toISOString(),
    },
  };

  return {
    ...queue,
    items: newItems,
  };
}

/**
 * Get a saved draft for a legislator
 */
export function getSavedDraft(queue: QueueStorage, legislatorId: string): SavedDraft | undefined {
  const item = queue.items.find((item) => item.legislator.id === legislatorId);
  return item?.savedDraft;
}

/**
 * Clear a saved draft for a legislator
 */
export function clearDraft(queue: QueueStorage, legislatorId: string): QueueStorage {
  const itemIndex = queue.items.findIndex((item) => item.legislator.id === legislatorId);

  if (itemIndex === -1) {
    return queue;
  }

  const newItems = [...queue.items];
  newItems[itemIndex] = {
    ...newItems[itemIndex],
    savedDraft: undefined,
  };

  return {
    ...queue,
    items: newItems,
  };
}
