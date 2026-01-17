"use client";

import * as React from "react";
import { Filter, SlidersHorizontal, X, ChevronDown, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import type { Party, Chamber, Stance, StateAbbreviation, SortOption } from "@/lib/types";
import {
  PARTY_OPTIONS,
  CHAMBER_OPTIONS,
  STANCE_OPTIONS,
  STATE_OPTIONS,
  SORT_OPTIONS,
  type FilterState,
} from "@/hooks/use-filters";

// =============================================================================
// Types
// =============================================================================

export interface FilterBarProps {
  filters: FilterState;
  onToggleParty: (party: Party) => void;
  onToggleChamber: (chamber: Chamber) => void;
  onToggleState: (state: StateAbbreviation) => void;
  onToggleStance: (stance: Stance) => void;
  onSetSortBy: (sortBy: SortOption) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
  activeFilterCount: number;
  className?: string;
}

// =============================================================================
// Sub-components
// =============================================================================

interface MultiSelectFilterProps {
  label: string;
  icon?: React.ReactNode;
  options: { value: string; label: string }[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}

function MultiSelectFilter({
  label,
  icon,
  options,
  selectedValues,
  onToggle,
}: MultiSelectFilterProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 gap-1.5 text-xs border-border/50 hover:border-border",
            selectedValues.length > 0 && "border-primary/50 bg-primary/5"
          )}
        >
          {icon}
          {label}
          {selectedValues.length > 0 && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-medium">
              {selectedValues.length}
            </span>
          )}
          <ChevronDown className="ml-1 size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0" align="start">
        <div className="max-h-[200px] overflow-auto p-2 space-y-1">
          {options.map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-accent cursor-pointer text-sm"
            >
              <Checkbox
                checked={selectedValues.includes(option.value)}
                onCheckedChange={() => onToggle(option.value)}
              />
              {option.label}
            </label>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface StateSelectFilterProps {
  selectedStates: StateAbbreviation[];
  onToggle: (state: StateAbbreviation) => void;
}

function StateSelectFilter({ selectedStates, onToggle }: StateSelectFilterProps) {
  const [open, setOpen] = React.useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-8 gap-1.5 text-xs border-border/50 hover:border-border",
            selectedStates.length > 0 && "border-primary/50 bg-primary/5"
          )}
        >
          State
          {selectedStates.length > 0 && (
            <span className="ml-1 rounded-full bg-primary text-primary-foreground px-1.5 py-0.5 text-[10px] font-medium">
              {selectedStates.length}
            </span>
          )}
          <ChevronDown className="ml-1 size-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-0" align="start">
        <Command>
          <CommandInput placeholder="Search states..." />
          <CommandList>
            <CommandEmpty>No state found.</CommandEmpty>
            <CommandGroup className="max-h-[200px] overflow-auto">
              {STATE_OPTIONS.map((state) => (
                <CommandItem
                  key={state.value}
                  value={state.label}
                  onSelect={() => onToggle(state.value)}
                >
                  <Check
                    className={cn(
                      "mr-2 size-4",
                      selectedStates.includes(state.value) ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground text-xs mr-1.5">{state.value}</span>
                  {state.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function FilterBar({
  filters,
  onToggleParty,
  onToggleChamber,
  onToggleState,
  onToggleStance,
  onSetSortBy,
  onClearFilters,
  hasActiveFilters,
  activeFilterCount,
  className,
}: FilterBarProps) {
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Filter controls row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Filter icon/label */}
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Filter className="size-3.5" />
          <span className="text-xs font-medium hidden sm:inline">Filters</span>
        </div>

        {/* Party filter */}
        <MultiSelectFilter
          label="Party"
          options={PARTY_OPTIONS}
          selectedValues={filters.parties}
          onToggle={(value) => onToggleParty(value as Party)}
        />

        {/* Chamber filter */}
        <MultiSelectFilter
          label="Chamber"
          options={CHAMBER_OPTIONS}
          selectedValues={filters.chambers}
          onToggle={(value) => onToggleChamber(value as Chamber)}
        />

        {/* State filter */}
        <StateSelectFilter selectedStates={filters.states} onToggle={onToggleState} />

        {/* Stance filter */}
        <MultiSelectFilter
          label="Stance"
          options={STANCE_OPTIONS}
          selectedValues={filters.stances}
          onToggle={(value) => onToggleStance(value as Stance)}
        />

        {/* Separator */}
        <div className="w-px h-5 bg-border/50 mx-1 hidden sm:block" />

        {/* Sort control */}
        <div className="flex items-center gap-1.5">
          <SlidersHorizontal className="size-3.5 text-muted-foreground" />
          <Select value={filters.sortBy} onValueChange={(v) => onSetSortBy(v as SortOption)}>
            <SelectTrigger className="h-8 text-xs w-[110px] border-border/50">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Clear filters button */}
        <AnimatePresence>
          {hasActiveFilters && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.15 }}
            >
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="h-8 text-xs text-muted-foreground hover:text-foreground gap-1"
              >
                <X className="size-3" />
                Clear ({activeFilterCount})
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
