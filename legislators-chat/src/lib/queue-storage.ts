/**
 * Contact Queue Storage
 *
 * Handles localStorage persistence for the contact queue, including
 * the order of legislators, which ones have been contacted, and the
 * currently active legislator.
 */

import type { Legislator } from "./types";

// =============================================================================
// Types
// =============================================================================

/** Contact status for a legislator in the queue */
export type ContactStatus = "pending" | "active" | "contacted" | "skipped";

/** A queue item wrapping a legislator with status */
export interface QueueItem {
  legislator: Legislator;
  status: ContactStatus;
  contactedAt?: string;
  notes?: string;
}

/** Storage format for the contact queue */
export interface QueueStorage {
  items: QueueItem[];
  activeIndex: number;
  researchContext: string | null;
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
  researchContext: string | null = null
): QueueStorage {
  return {
    items: legislators.map((legislator, index) => ({
      legislator,
      status: index === 0 ? "active" : "pending",
    })),
    activeIndex: legislators.length > 0 ? 0 : -1,
    researchContext,
    version: CURRENT_VERSION,
  };
}

/**
 * Migrate queue from older versions
 */
function migrateQueue(queue: QueueStorage): QueueStorage {
  // Future migrations can be handled here
  return {
    ...queue,
    version: CURRENT_VERSION,
  };
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
export function markContacted(queue: QueueStorage): QueueStorage {
  if (queue.activeIndex < 0 || queue.activeIndex >= queue.items.length) {
    return queue;
  }

  const newItems = [...queue.items];
  newItems[queue.activeIndex] = {
    ...newItems[queue.activeIndex],
    status: "contacted",
    contactedAt: new Date().toISOString(),
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
