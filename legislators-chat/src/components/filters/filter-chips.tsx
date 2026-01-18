"use client";

import * as React from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { Party, Chamber, Stance, StateAbbreviation } from "@/lib/types";
import {
  PARTY_OPTIONS,
  CHAMBER_OPTIONS,
  STANCE_OPTIONS,
  STATE_OPTIONS,
  type FilterState,
} from "@/hooks/use-filters";

// =============================================================================
// Types
// =============================================================================

export interface FilterChipsProps {
  filters: FilterState;
  onRemoveParty: (party: Party) => void;
  onRemoveChamber: (chamber: Chamber) => void;
  onRemoveState: (state: StateAbbreviation) => void;
  /** Optional stance removal - if undefined, stance chips are not shown */
  onRemoveStance?: (stance: Stance) => void;
  className?: string;
}

interface FilterChipProps {
  label: string;
  category: string;
  onRemove: () => void;
  variant?: "default" | "party-d" | "party-r" | "party-i" | "stance";
}

// =============================================================================
// Sub-components
// =============================================================================

function FilterChip({ label, category, onRemove, variant = "default" }: FilterChipProps) {
  const variantClasses: Record<string, string> = {
    default: "bg-muted hover:bg-muted/80",
    "party-d": "bg-blue-900/30 text-blue-400 hover:bg-blue-900/40",
    "party-r": "bg-red-900/30 text-red-400 hover:bg-red-900/40",
    "party-i": "bg-purple-900/30 text-purple-400 hover:bg-purple-900/40",
    stance: "bg-accent hover:bg-accent/80",
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ duration: 0.15 }}
      layout
    >
      <Badge
        variant="outline"
        className={cn(
          "gap-1 pr-1 cursor-default select-none text-xs font-normal",
          variantClasses[variant]
        )}
      >
        <span className="text-muted-foreground text-[10px] uppercase">{category}:</span>
        {label}
        <button
          onClick={onRemove}
          className="ml-0.5 rounded-full p-0.5 hover:bg-background/50 transition-colors"
          aria-label={`Remove ${label} filter`}
        >
          <X className="size-3" />
        </button>
      </Badge>
    </motion.div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function FilterChips({
  filters,
  onRemoveParty,
  onRemoveChamber,
  onRemoveState,
  onRemoveStance,
  className,
}: FilterChipsProps) {
  // Only count stance filters if the removal callback is provided
  const hasFilters =
    filters.parties.length > 0 ||
    filters.chambers.length > 0 ||
    filters.states.length > 0 ||
    (onRemoveStance && filters.stances.length > 0);

  if (!hasFilters) {
    return null;
  }

  // Get label helpers
  const getPartyLabel = (party: Party) =>
    PARTY_OPTIONS.find((p) => p.value === party)?.label || party;
  const getChamberLabel = (chamber: Chamber) =>
    CHAMBER_OPTIONS.find((c) => c.value === chamber)?.label || chamber;
  const getStateLabel = (state: StateAbbreviation) =>
    STATE_OPTIONS.find((s) => s.value === state)?.label || state;
  const getStanceLabel = (stance: Stance) =>
    STANCE_OPTIONS.find((s) => s.value === stance)?.label || stance;

  // Get party variant
  const getPartyVariant = (party: Party): "party-d" | "party-r" | "party-i" => {
    switch (party) {
      case "D":
        return "party-d";
      case "R":
        return "party-r";
      case "I":
        return "party-i";
    }
  };

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      <AnimatePresence mode="popLayout">
        {/* Party chips */}
        {filters.parties.map((party) => (
          <FilterChip
            key={`party-${party}`}
            category="Party"
            label={getPartyLabel(party)}
            variant={getPartyVariant(party)}
            onRemove={() => onRemoveParty(party)}
          />
        ))}

        {/* Chamber chips */}
        {filters.chambers.map((chamber) => (
          <FilterChip
            key={`chamber-${chamber}`}
            category="Chamber"
            label={getChamberLabel(chamber)}
            onRemove={() => onRemoveChamber(chamber)}
          />
        ))}

        {/* State chips */}
        {filters.states.map((state) => (
          <FilterChip
            key={`state-${state}`}
            category="State"
            label={getStateLabel(state)}
            onRemove={() => onRemoveState(state)}
          />
        ))}

        {/* Stance chips - only shown when callback is provided */}
        {onRemoveStance && filters.stances.map((stance) => (
          <FilterChip
            key={`stance-${stance}`}
            category="Stance"
            label={getStanceLabel(stance)}
            variant="stance"
            onRemove={() => onRemoveStance(stance)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
