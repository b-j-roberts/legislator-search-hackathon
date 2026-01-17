"use client";

import { cn } from "@/lib/utils";
import type { Stance } from "@/lib/types";

export interface StanceBadgeProps {
  stance: Stance;
  className?: string;
}

const stanceConfig: Record<
  Stance,
  { label: string; className: string }
> = {
  for: {
    label: "Supports",
    className: "bg-green-900/50 text-green-400 border-green-700",
  },
  against: {
    label: "Opposes",
    className: "bg-red-900/50 text-red-400 border-red-700",
  },
  mixed: {
    label: "Mixed",
    className: "bg-yellow-900/50 text-yellow-400 border-yellow-700",
  },
  unknown: {
    label: "Unknown",
    className: "bg-slate-800 text-slate-400 border-slate-700",
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
