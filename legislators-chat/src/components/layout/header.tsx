"use client";

import * as React from "react";
import { Moon, Sun, Landmark, PanelLeftOpen, MessageSquarePlus } from "lucide-react";
import { useTheme } from "next-themes";
import { useChat } from "@/hooks/use-chat";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4" />
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

export function Header() {
  const { toggleSidebar, isSidebarOpen, newConversation, conversations } = useChat();

  return (
    <TooltipProvider delayDuration={300}>
      <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
        <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
          {/* Left section - Menu and Branding */}
          <div className="flex items-center gap-2">
            {/* Sidebar Toggle - only show when sidebar is closed */}
            {!isSidebarOpen && (
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
            <div className="flex items-center gap-2">
              <Landmark className="h-6 w-6 text-primary" />
              <span className="text-lg font-semibold tracking-tight">
                Legislators Chat
              </span>
            </div>
          </div>

          {/* Right section - Actions */}
          <div className="flex items-center gap-2">
            {/* New Conversation Button - only show on larger screens when sidebar is closed */}
            {!isSidebarOpen && conversations.length > 0 && (
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
