"use client";

import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface AppLayoutProps {
  children: ReactNode;
  resultsPanel?: ReactNode;
  className?: string;
}

/**
 * Main application layout with responsive split-view design.
 *
 * Desktop (>= 1024px): Chat on left (60%), Results on right (40%) - side by side
 * Tablet (768px - 1023px): Chat takes more space, Results below collapsible
 * Mobile (< 768px): Full-width chat with Results in collapsible drawer below
 */
export function AppLayout({ children, resultsPanel, className }: AppLayoutProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col lg:flex-row min-h-0 overflow-hidden",
        className
      )}
    >
      {/* Main Content / Chat Area */}
      <main className="flex flex-1 flex-col min-h-0 overflow-hidden lg:w-[60%] lg:flex-none">
        {children}
      </main>

      {/* Results Panel - Desktop: side panel, Tablet/Mobile: collapsible below chat */}
      {resultsPanel && (
        <aside
          className={cn(
            "flex flex-col overflow-hidden border-border",
            // Mobile: flexible height, collapsible
            "flex-shrink-0 max-h-[40vh] md:max-h-[45vh]",
            "border-t",
            // Desktop: fixed width side panel
            "lg:max-h-none lg:w-[40%] lg:flex-none",
            "lg:border-t-0 lg:border-l"
          )}
        >
          {resultsPanel}
        </aside>
      )}
    </div>
  );
}
