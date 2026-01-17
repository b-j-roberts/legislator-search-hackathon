"use client";

import * as React from "react";
import { Moon, Sun, Landmark } from "lucide-react";
import { useTheme } from "next-themes";

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
      <div className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-input bg-background" />
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex h-11 w-11 items-center justify-center rounded-md border border-input bg-background hover:bg-accent hover:text-accent-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring touch-manipulation"
      aria-label={`Switch to ${resolvedTheme === "dark" ? "light" : "dark"} mode`}
    >
      {resolvedTheme === "dark" ? (
        <Sun className="h-5 w-5" />
      ) : (
        <Moon className="h-5 w-5" />
      )}
    </button>
  );
}

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex-shrink-0">
      <div className="flex h-14 md:h-16 items-center justify-between px-4 md:px-6">
        {/* Logo and Branding */}
        <div className="flex items-center gap-2">
          <Landmark className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">
            Legislators Chat
          </span>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />
      </div>
    </header>
  );
}
