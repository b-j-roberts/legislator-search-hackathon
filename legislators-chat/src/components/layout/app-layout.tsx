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
 * Mobile (< 768px): Stacked layout
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
      <main className="flex flex-1 flex-col lg:w-[60%] lg:flex-none overflow-hidden">
        {children}
      </main>

      {/* Results Panel - Desktop: side panel, Mobile: collapsed/hidden */}
      {resultsPanel && (
        <aside className="hidden lg:flex lg:w-[40%] flex-col border-l border-border overflow-hidden">
          {resultsPanel}
        </aside>
      )}
    </div>
  );
}
