"use client";

import * as React from "react";

/**
 * Hook to show a browser warning when leaving the page with unsaved changes
 *
 * @param shouldWarn - Whether to show the warning (typically tied to dirty state)
 * @param message - Optional custom message (note: most browsers ignore this for security)
 */
export function useBeforeUnload(
  shouldWarn: boolean,
  message = "You have unsaved changes. Are you sure you want to leave?"
): void {
  React.useEffect(() => {
    if (!shouldWarn) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Modern browsers require returnValue to be set
      event.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handleBeforeUnload);

    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [shouldWarn, message]);
}

/**
 * Hook to intercept Next.js navigation when there are unsaved changes
 *
 * Shows a confirm dialog before allowing navigation away from the current page.
 * Works with Next.js App Router.
 *
 * @param shouldWarn - Whether to show the warning
 * @param message - Message to show in the confirm dialog
 * @returns Object with navigation blocking utilities
 */
export function useNavigationWarning(
  shouldWarn: boolean,
  message = "You have unsaved changes. Are you sure you want to leave?"
): {
  /** Whether navigation is currently blocked */
  isBlocking: boolean;
  /** Temporarily allow navigation (e.g., for form submit) */
  allowNavigation: () => void;
  /** Re-enable navigation blocking */
  blockNavigation: () => void;
} {
  const [isBlocking, setIsBlocking] = React.useState(shouldWarn);

  // Sync with shouldWarn prop
  React.useEffect(() => {
    setIsBlocking(shouldWarn);
  }, [shouldWarn]);

  // Handle beforeunload for browser back/refresh
  useBeforeUnload(isBlocking, message);

  // Handle link clicks (intercept navigation)
  React.useEffect(() => {
    if (!isBlocking) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const link = target.closest("a");

      // Only intercept internal links
      if (!link) return;
      const href = link.getAttribute("href");
      if (!href || href.startsWith("#") || href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return;
      }

      // Show confirmation
      const shouldLeave = window.confirm(message);
      if (!shouldLeave) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    document.addEventListener("click", handleClick, true);

    return () => {
      document.removeEventListener("click", handleClick, true);
    };
  }, [isBlocking, message]);

  const allowNavigation = React.useCallback(() => {
    setIsBlocking(false);
  }, []);

  const blockNavigation = React.useCallback(() => {
    setIsBlocking(true);
  }, []);

  return {
    isBlocking,
    allowNavigation,
    blockNavigation,
  };
}
