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
 * Desktop (>= 1024px): Chat on left (60%), Results on right (40%)
 * Mobile (< 1024px): Chat on top, Results panel collapsible below
 */
export function AppLayout({ children, resultsPanel, className }: AppLayoutProps) {
  return (
    <div
      className={cn(
        "flex flex-1 flex-col lg:flex-row overflow-hidden",
        className
      )}
    >
      {/* Main Content / Chat Area */}
      <main className="flex flex-1 flex-col lg:w-[60%] lg:flex-none overflow-hidden min-h-0">
        {children}
      </main>

      {/* Results Panel - Desktop: side panel, Mobile: collapsible below chat */}
      {resultsPanel && (
        <aside className="flex lg:w-[40%] flex-col border-t lg:border-t-0 lg:border-l border-border overflow-hidden">
          {resultsPanel}
        </aside>
      )}
    </div>
  );
}
