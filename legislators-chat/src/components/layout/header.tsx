"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, PanelLeftOpen, MessageSquarePlus, Users } from "lucide-react";
import { useTheme } from "next-themes";
import { useChat } from "@/hooks/use-chat";
import { useContact } from "@/hooks/use-contact";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressStepper } from "./progress-stepper";

function ThemeToggle() {
  const [mounted, setMounted] = React.useState(false);
  const { resolvedTheme, setTheme } = useTheme();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  if (!mounted) {
    return (
      <div className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border/50 bg-background/50" />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          className="h-9 w-9 rounded-full hover:bg-accent/20 transition-colors"
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4 text-accent" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Toggle theme</p>
      </TooltipContent>
    </Tooltip>
  );
}

// Custom Capitol dome icon for branding
function CapitolIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Dome */}
      <path d="M12 2C8 2 5 5 5 8v1h14V8c0-3-3-6-7-6z" />
      {/* Dome top */}
      <circle cx="12" cy="4" r="1" fill="currentColor" />
      {/* Building base */}
      <rect x="3" y="9" width="18" height="2" rx="0.5" />
      {/* Columns */}
      <line x1="6" y1="11" x2="6" y2="19" />
      <line x1="10" y1="11" x2="10" y2="19" />
      <line x1="14" y1="11" x2="14" y2="19" />
      <line x1="18" y1="11" x2="18" y2="19" />
      {/* Foundation */}
      <rect x="2" y="19" width="20" height="3" rx="0.5" />
    </svg>
  );
}

export function Header() {
  const pathname = usePathname();
  const { toggleSidebar, isSidebarOpen, newConversation, conversations } = useChat();
  const { hasSelections, selectionCount, currentStep } = useContact();

  const isContactFlow = pathname?.startsWith("/contact") || currentStep === "contact";

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-40 w-full border-b border-border/50 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
        <div className="flex h-16 md:h-[72px] items-center justify-between px-4 md:px-8">
          {/* Left section - Menu and Branding */}
          <div className="flex items-center gap-3">
            {/* Sidebar Toggle */}
            {!isSidebarOpen && !isContactFlow && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    className="h-9 w-9 rounded-full hover:bg-accent/20"
                    aria-label="Open chat history"
                  >
                    <PanelLeftOpen className="h-5 w-5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  <p>Chat history</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Logo and Branding */}
            <Link
              href="/"
              className="flex items-center gap-3 group transition-all duration-300"
            >
              <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/80 dark:from-accent dark:to-accent/80 shadow-sm group-hover:shadow-md transition-shadow">
                <CapitolIcon className="h-5 w-5 text-primary-foreground dark:text-accent-foreground" />
              </div>
              <div className="flex flex-col">
                <span className="font-display text-lg md:text-xl font-bold tracking-tight leading-none">
                  Legislators
                </span>
                <span className="text-[10px] md:text-xs text-muted-foreground font-medium tracking-widest uppercase">
                  Research & Connect
                </span>
              </div>
            </Link>
          </div>

          {/* Center section - Progress Stepper */}
          {isContactFlow && (
            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2">
              <ProgressStepper currentStep={currentStep} />
            </div>
          )}

          {/* Right section - Actions */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Selection indicator */}
            {hasSelections && !isContactFlow && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="default"
                    size="sm"
                    asChild
                    className="gap-2 rounded-full bg-accent text-accent-foreground hover:bg-accent/90 shadow-sm px-4"
                  >
                    <Link href="/contact">
                      <Users className="h-4 w-4" />
                      <span className="hidden sm:inline font-medium">Contact</span>
                      <Badge
                        variant="secondary"
                        className="ml-0.5 bg-accent-foreground/20 text-accent-foreground border-0 h-5 min-w-5 rounded-full"
                      >
                        {selectionCount}
                      </Badge>
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Contact {selectionCount} selected representative
                    {selectionCount !== 1 ? "s" : ""}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* New Conversation Button */}
            {!isSidebarOpen && conversations.length > 0 && !isContactFlow && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={newConversation}
                    className="hidden sm:flex h-9 w-9 rounded-full hover:bg-accent/20"
                    aria-label="New conversation"
                  >
                    <MessageSquarePlus className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>New conversation</p>
                </TooltipContent>
              </Tooltip>
            )}

            {/* Theme Toggle */}
            <ThemeToggle />
          </div>
        </div>
      </header>
    </TooltipProvider>
  );
}
