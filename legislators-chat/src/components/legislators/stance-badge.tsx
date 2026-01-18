"use client";

import { cn } from "@/lib/utils";
import type { Stance } from "@/lib/types";

export interface StanceBadgeProps {
  stance: Stance;
  className?: string;
}

const stanceConfig: Record<Stance, { label: string; className: string }> = {
  for: {
    label: "Supports",
    className: "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/50 dark:text-green-400 dark:border-green-700",
  },
  against: {
    label: "Opposes",
    className: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/50 dark:text-red-400 dark:border-red-700",
  },
  mixed: {
    label: "Mixed",
    className: "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/50 dark:text-yellow-400 dark:border-yellow-700",
  },
  unknown: {
    label: "Unknown",
    className: "bg-slate-200 text-slate-600 border-slate-300 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
  },
};

export function StanceBadge({ stance, className }: StanceBadgeProps) {
  const config = stanceConfig[stance];

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-3 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}
