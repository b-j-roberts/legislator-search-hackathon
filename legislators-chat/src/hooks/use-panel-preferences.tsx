"use client";

import * as React from "react";

const STORAGE_KEY = "legislators-chat-panel-preferences";

export interface PanelPreferences {
  /** Panel width as percentage (20-80) */
  panelWidth: number;
  /** Whether panel is collapsed on desktop */
  isCollapsed: boolean;
}

const DEFAULT_PREFERENCES: PanelPreferences = {
  panelWidth: 40,
  isCollapsed: false,
};

function loadPreferences(): PanelPreferences {
  if (typeof window === "undefined") {
    return DEFAULT_PREFERENCES;
  }

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return {
        panelWidth: Math.min(80, Math.max(20, parsed.panelWidth ?? DEFAULT_PREFERENCES.panelWidth)),
        isCollapsed: parsed.isCollapsed ?? DEFAULT_PREFERENCES.isCollapsed,
      };
    }
  } catch (error) {
    console.error("Failed to load panel preferences:", error);
  }

  return DEFAULT_PREFERENCES;
}

function savePreferences(preferences: PanelPreferences): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch (error) {
    console.error("Failed to save panel preferences:", error);
  }
}

export function usePanelPreferences() {
  const [preferences, setPreferencesState] = React.useState<PanelPreferences>(DEFAULT_PREFERENCES);
  const [isHydrated, setIsHydrated] = React.useState(false);

  // Load preferences from localStorage after hydration
  React.useEffect(() => {
    setPreferencesState(loadPreferences());
    setIsHydrated(true);
  }, []);

  // Save preferences when they change (after hydration)
  React.useEffect(() => {
    if (isHydrated) {
      savePreferences(preferences);
    }
  }, [preferences, isHydrated]);

  const setPanelWidth = React.useCallback((width: number) => {
    const clampedWidth = Math.min(80, Math.max(20, width));
    setPreferencesState((prev) => ({ ...prev, panelWidth: clampedWidth }));
  }, []);

  const setIsCollapsed = React.useCallback((collapsed: boolean) => {
    setPreferencesState((prev) => ({ ...prev, isCollapsed: collapsed }));
  }, []);

  const toggleCollapsed = React.useCallback(() => {
    setPreferencesState((prev) => ({ ...prev, isCollapsed: !prev.isCollapsed }));
  }, []);

  const resetPreferences = React.useCallback(() => {
    setPreferencesState(DEFAULT_PREFERENCES);
  }, []);

  return {
    ...preferences,
    isHydrated,
    setPanelWidth,
    setIsCollapsed,
    toggleCollapsed,
    resetPreferences,
  };
}
