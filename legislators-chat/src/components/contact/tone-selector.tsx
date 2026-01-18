"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { TonePreference } from "@/lib/types";

interface ToneSelectorProps {
  value: TonePreference;
  onChange: (tone: TonePreference) => void;
  disabled?: boolean;
  className?: string;
}

interface ToneOption {
  value: TonePreference;
  label: string;
  description: string;
}

const TONE_OPTIONS: ToneOption[] = [
  {
    value: "formal",
    label: "Formal",
    description: "Professional and respectful",
  },
  {
    value: "passionate",
    label: "Passionate",
    description: "Urgent and conviction-driven",
  },
  {
    value: "personal",
    label: "Personal",
    description: "Story-based and relatable",
  },
  {
    value: "concise",
    label: "Concise",
    description: "Brief and to the point",
  },
];

export function ToneSelector({ value, onChange, disabled, className }: ToneSelectorProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {TONE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled}
          className={cn(
            "inline-flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-all",
            "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:border-border",
            value === option.value
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-background text-muted-foreground"
          )}
        >
          <span className="text-sm font-medium">{option.label}</span>
          <span className="text-xs opacity-80">{option.description}</span>
        </button>
      ))}
    </div>
  );
}

export function ToneSelectorCompact({
  value,
  onChange,
  disabled,
  className,
}: ToneSelectorProps) {
  return (
    <div className={cn("flex gap-1", className)}>
      {TONE_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          disabled={disabled}
          title={option.description}
          className={cn(
            "px-2.5 py-1 text-xs rounded-md border transition-colors",
            "hover:border-primary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            value === option.value
              ? "border-primary bg-primary/10 text-foreground font-medium"
              : "border-transparent bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
