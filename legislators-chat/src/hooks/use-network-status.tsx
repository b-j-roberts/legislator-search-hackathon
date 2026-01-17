"use client";

import * as React from "react";

export interface NetworkStatus {
  /** Whether the browser is online */
  isOnline: boolean;
  /** Whether we've recovered from being offline */
  wasOffline: boolean;
  /** Reset the wasOffline flag */
  resetWasOffline: () => void;
}

/**
 * Hook to track network connectivity status
 *
 * Returns the current online/offline status and whether the user
 * has recently recovered from being offline.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return navigator.onLine;
  });

  const [wasOffline, setWasOffline] = React.useState(false);

  React.useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
      // Mark that we recovered from offline
      setWasOffline(true);
    }

    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    // Set initial state
    setIsOnline(navigator.onLine);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const resetWasOffline = React.useCallback(() => {
    setWasOffline(false);
  }, []);

  return {
    isOnline,
    wasOffline,
    resetWasOffline,
  };
}
