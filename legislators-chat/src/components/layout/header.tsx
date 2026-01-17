"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Moon, Sun, Landmark, PanelLeftOpen, MessageSquarePlus, Users } from "lucide-react";
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

  // Avoid hydration mismatch by only rendering after mount
  React.useEffect(() => {
    setMounted(true);
  }, []);

  const toggleTheme = () => {
    setTheme(resolvedTheme === "dark" ? "light" : "dark");
  };

  // Render placeholder with same dimensions to avoid layout shift
  if (!mounted) {
    return (
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-input bg-background" />
    );
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          onClick={toggleTheme}
          aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
        >
          {resolvedTheme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>Toggle theme</p>
      </TooltipContent>
    </Tooltip>
  );
}

export function Header() {
  const pathname = usePathname();
  const { toggleSidebar, isSidebarOpen, newConversation, conversations } = useChat();
  const { hasSelections, selectionCount, currentStep } = useContact();

  // Determine if we're in the contact flow
  const isContactFlow = pathname?.startsWith("/contact") || currentStep === "contact";

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          {/* Left section - Menu and Branding */}
          <div className="flex items-center gap-2">
            {/* Sidebar Toggle - only show when sidebar is closed and not in contact flow */}
            {!isSidebarOpen && !isContactFlow && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
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
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <Landmark className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold tracking-tight">Legislators Chat</span>
            </Link>
          </div>

          {/* Center section - Progress Stepper (only on larger screens when in contact flow) */}
          {isContactFlow && (
            <div className="hidden md:flex absolute left-1/2 -translate-x-1/2">
              <ProgressStepper currentStep={currentStep} />
            </div>
          )}

          {/* Right section - Actions */}
          <div className="flex items-center gap-2">
            {/* Selection indicator - show when we have selections on main page */}
            {hasSelections && !isContactFlow && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="sm" asChild className="gap-1.5">
                    <Link href="/contact">
                      <Users className="h-4 w-4" />
                      <span className="hidden sm:inline">Contact</span>
                      <Badge variant="secondary" className="ml-1">
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

            {/* New Conversation Button - only show on larger screens when sidebar is closed */}
            {!isSidebarOpen && conversations.length > 0 && !isContactFlow && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={newConversation}
                    className="hidden sm:flex"
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
