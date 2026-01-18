"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { GripVertical, PanelRightClose, PanelRightOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePanelPreferences } from "@/hooks/use-panel-preferences";
import type { ReactNode, CSSProperties } from "react";

interface AppLayoutProps {
  children: ReactNode;
  resultsPanel?: ReactNode;
  className?: string;
}

const MIN_PANEL_WIDTH = 20;
const MAX_PANEL_WIDTH = 80;

/**
 * Main application layout with responsive split-view design.
 *
 * Desktop (>= 1024px): Chat on left, Results on right - side by side with draggable resizer
 * Tablet (768px - 1023px): Chat takes more space, Results below collapsible
 * Mobile (< 768px): Full-width chat with Results in collapsible drawer below
 */
export function AppLayout({ children, resultsPanel, className }: AppLayoutProps) {
  const { panelWidth, isCollapsed, isHydrated, setPanelWidth, toggleCollapsed } =
    usePanelPreferences();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isDesktop, setIsDesktop] = React.useState(false);

  // Track if we're on desktop
  React.useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.innerWidth >= 1024);
    };

    checkDesktop();
    window.addEventListener("resize", checkDesktop);
    return () => window.removeEventListener("resize", checkDesktop);
  }, []);

  // Handle resize drag
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  React.useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      // Calculate panel width as percentage (panel is on the right)
      const newPanelWidth = ((containerWidth - mouseX) / containerWidth) * 100;
      const clampedWidth = Math.min(MAX_PANEL_WIDTH, Math.max(MIN_PANEL_WIDTH, newPanelWidth));

      setPanelWidth(clampedWidth);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDragging, setPanelWidth]);

  // Use default width before hydration to avoid layout shift
  const effectivePanelWidth = isHydrated ? panelWidth : 40;
  const effectiveIsCollapsed = isHydrated ? isCollapsed : false;

  // Calculate styles for desktop only
  const mainStyle: CSSProperties =
    isDesktop && !effectiveIsCollapsed ? { width: `${100 - effectivePanelWidth}%` } : {};

  const asideStyle: CSSProperties = isDesktop ? { width: `${effectivePanelWidth}%` } : {};

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex flex-1 flex-col lg:flex-row min-h-0 overflow-hidden relative",
        isDragging && "select-none cursor-col-resize",
        className
      )}
    >
      {/* Main Content / Chat Area */}
      <main
        className={cn(
          "flex flex-1 flex-col min-h-0 overflow-hidden",
          isDesktop && !effectiveIsCollapsed && "flex-none"
        )}
        style={mainStyle}
      >
        {children}
      </main>

      {/* Desktop collapse/expand toggle - visible when panel is collapsed */}
      {resultsPanel && effectiveIsCollapsed && (
        <div className="hidden lg:flex items-start pt-3 pr-2 absolute right-0 top-0 z-10">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="h-8 w-8"
            title="Expand results panel"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Results Panel - Desktop: side panel, Tablet/Mobile: collapsible below chat */}
      {resultsPanel && (
        <>
          {/* Resize handle - desktop only, visible when not collapsed */}
          <div
            className={cn(
              "hidden lg:flex items-center justify-center w-1 hover:w-1.5 bg-border hover:bg-primary/50 cursor-col-resize transition-all group",
              effectiveIsCollapsed && "lg:hidden",
              isDragging && "w-1.5 bg-primary/50"
            )}
            onMouseDown={handleMouseDown}
          >
            <GripVertical
              className={cn(
                "h-6 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors",
                isDragging && "text-primary"
              )}
            />
          </div>

          <aside
            className={cn(
              "flex flex-col overflow-hidden border-border",
              // Mobile/Tablet: flexible height, collapsible
              "flex-shrink-0 max-h-[40vh] md:max-h-[45vh]",
              "border-t",
              // Desktop: dynamic width side panel with collapse support
              "lg:max-h-none lg:h-full lg:flex-none",
              "lg:border-t-0 lg:border-l",
              effectiveIsCollapsed && "lg:hidden"
            )}
            style={asideStyle}
          >
            {/* Desktop collapse button header */}
            <div className="hidden lg:flex items-center justify-between px-3 py-2.5 border-b border-border bg-secondary/30">
              <span className="text-sm font-medium text-muted-foreground font-display">Results</span>
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleCollapsed}
                className="h-7 w-7"
                title="Collapse results panel"
              >
                <PanelRightClose className="h-4 w-4" />
              </Button>
            </div>
            {resultsPanel}
          </aside>
        </>
      )}

      {/* Drag overlay to prevent iframe/selection issues during drag */}
      {isDragging && <div className="fixed inset-0 z-50 cursor-col-resize" />}
    </div>
  );
}
