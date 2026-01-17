"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Users, FileText, Vote, ChevronUp, Send, CheckSquare, Square } from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  Legislator,
  Document,
  VoteRecord,
  Hearing,
  Party,
  Chamber,
  Stance,
  StateAbbreviation,
  SortOption,
} from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { LegislatorList } from "./legislator-list";
import { FilterBar, FilterChips } from "@/components/filters";
import { useFilters, type FilterState } from "@/hooks/use-filters";
import { useContact } from "@/hooks/use-contact";

export type ResultsTab = "people" | "documents" | "votes";

export interface ResultsPanelProps {
  legislators?: Legislator[];
  documents?: Document[];
  votes?: VoteRecord[];
  hearings?: Hearing[];
  isLoading?: boolean;
  activeTab?: ResultsTab;
  onTabChange?: (tab: ResultsTab) => void;
  className?: string;
}

interface TabConfig {
  id: ResultsTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  count: number;
}

function EmptyDocumentsState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <FileText className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        No documents found
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Relevant documents, hearings, and transcripts will appear here.
      </p>
    </div>
  );
}

function EmptyVotesState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Vote className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        No votes found
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Voting records related to your query will appear here.
      </p>
    </div>
  );
}

export function ResultsPanel({
  legislators = [],
  documents = [],
  votes = [],
  hearings = [],
  isLoading = false,
  activeTab = "people",
  onTabChange,
  className,
}: ResultsPanelProps) {
  const router = useRouter();
  const [currentTab, setCurrentTab] = React.useState<ResultsTab>(activeTab);
  const [isMobileExpanded, setIsMobileExpanded] = React.useState(false);
  const [isSelectionMode, setIsSelectionMode] = React.useState(false);

  // Contact context for selection management
  const {
    selectedLegislators,
    toggleLegislator,
    clearSelections,
    setSelectedLegislators,
    setCurrentStep,
    selectionCount,
    hasSelections,
  } = useContact();

  // Filter and sort state
  const {
    filters,
    toggleParty,
    toggleChamber,
    toggleState,
    toggleStance,
    setSortBy,
    clearFilters,
    hasActiveFilters,
    activeFilterCount,
    applyFilters,
  } = useFilters();

  // Apply filters to legislators
  const filteredLegislators = React.useMemo(
    () => applyFilters(legislators),
    [legislators, applyFilters]
  );

  // Get selected IDs for the list
  const selectedIds = React.useMemo(
    () => selectedLegislators.map((l) => l.id),
    [selectedLegislators]
  );

  // Calculate counts for tabs (filtered for legislators)
  const tabs: TabConfig[] = [
    { id: "people", label: "People", icon: Users, count: filteredLegislators.length },
    { id: "documents", label: "Documents", icon: FileText, count: documents.length + hearings.length },
    { id: "votes", label: "Votes", icon: Vote, count: votes.length },
  ];

  const totalResults = filteredLegislators.length + documents.length + votes.length + hearings.length;

  const handleTabChange = (value: string) => {
    const tab = value as ResultsTab;
    setCurrentTab(tab);
    onTabChange?.(tab);
  };

  const toggleMobileExpand = () => {
    setIsMobileExpanded(!isMobileExpanded);
  };

  const handleToggleSelectionMode = () => {
    if (isSelectionMode) {
      // Exiting selection mode - clear selections
      clearSelections();
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const handleSelectAll = () => {
    setSelectedLegislators(filteredLegislators);
  };

  const handleContactRepresentatives = () => {
    setCurrentStep("contact");
    router.push("/contact");
  };

  return (
    <div className={cn("flex flex-col flex-1 min-h-0 bg-background", className)}>
      {/* Mobile/Tablet toggle bar - only visible below desktop */}
      <div className="lg:hidden border-b border-border">
        <Button
          variant="ghost"
          onClick={toggleMobileExpand}
          className="w-full flex items-center justify-between min-h-[48px] py-3 px-4 h-auto rounded-none touch-manipulation"
          aria-expanded={isMobileExpanded}
          aria-controls="results-panel-content"
        >
          <span className="flex items-center gap-2 text-sm font-medium">
            <Users className="size-5" />
            Results
            {totalResults > 0 && (
              <span className="bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full min-w-[24px] text-center">
                {totalResults}
              </span>
            )}
          </span>
          <motion.div
            animate={{ rotate: isMobileExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronUp className="size-5" />
          </motion.div>
        </Button>
      </div>

      {/* Panel content - single Tabs instance with responsive visibility */}
      <div
        id="results-panel-content"
        className={cn(
          "flex-col flex-1 min-h-0 overflow-hidden transition-all duration-200",
          // Mobile/Tablet: hidden by default, shown when expanded
          isMobileExpanded ? "flex" : "hidden",
          // Desktop: always visible
          "lg:flex"
        )}
      >
        <Tabs
          value={currentTab}
          onValueChange={handleTabChange}
          className="flex flex-col flex-1 overflow-hidden"
        >
          {/* Tab navigation */}
          <div className="flex-shrink-0 border-b border-border p-2 md:p-3">
            <TabsList className="w-full grid grid-cols-3 h-auto">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center justify-center gap-1.5 min-h-[44px] px-2 md:px-3 touch-manipulation"
                >
                  <tab.icon className="size-4 md:size-5 flex-shrink-0" />
                  <span className="hidden md:inline text-sm">{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="text-xs bg-muted-foreground/20 px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Filter bar - only visible on People tab when there are legislators */}
          {currentTab === "people" && legislators.length > 0 && (
            <div className="flex-shrink-0 border-b border-border px-3 py-2 space-y-2">
              <FilterBar
                filters={filters}
                onToggleParty={toggleParty}
                onToggleChamber={toggleChamber}
                onToggleState={toggleState}
                onToggleStance={toggleStance}
                onSetSortBy={setSortBy}
                onClearFilters={clearFilters}
                hasActiveFilters={hasActiveFilters}
                activeFilterCount={activeFilterCount}
              />
              <FilterChips
                filters={filters}
                onRemoveParty={toggleParty}
                onRemoveChamber={toggleChamber}
                onRemoveState={toggleState}
                onRemoveStance={toggleStance}
              />
              {/* Selection mode controls */}
              <div className="flex items-center justify-between pt-1">
                <Button
                  variant={isSelectionMode ? "secondary" : "outline"}
                  size="sm"
                  onClick={handleToggleSelectionMode}
                  className="gap-1.5"
                >
                  {isSelectionMode ? (
                    <>
                      <CheckSquare className="size-4" />
                      <span className="hidden sm:inline">Done selecting</span>
                      <span className="sm:hidden">Done</span>
                    </>
                  ) : (
                    <>
                      <Square className="size-4" />
                      <span className="hidden sm:inline">Select to contact</span>
                      <span className="sm:hidden">Select</span>
                    </>
                  )}
                </Button>
                {isSelectionMode && (
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleSelectAll}
                      disabled={selectedIds.length === filteredLegislators.length}
                    >
                      Select all
                    </Button>
                    {hasSelections && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={clearSelections}
                      >
                        Clear
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <TabsContent value="people" className="h-full overflow-auto m-0">
              <LegislatorList
                legislators={filteredLegislators}
                isLoading={isLoading}
                emptyMessage={
                  hasActiveFilters && legislators.length > 0
                    ? "No legislators match your filters. Try adjusting or clearing filters."
                    : undefined
                }
                selectable={isSelectionMode}
                selectedIds={selectedIds}
                onToggleSelect={toggleLegislator}
              />
            </TabsContent>

            <TabsContent value="documents" className="h-full overflow-auto m-0">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-5 w-3/4 bg-accent animate-pulse rounded" />
                      <div className="h-4 w-full bg-accent animate-pulse rounded" />
                      <div className="h-4 w-2/3 bg-accent animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              ) : documents.length === 0 && hearings.length === 0 ? (
                <EmptyDocumentsState />
              ) : (
                <div className="p-4 space-y-3">
                  {documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <h4 className="font-medium text-sm text-foreground">
                        {doc.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {doc.date} - {doc.type}
                      </p>
                      {doc.summary && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {doc.summary}
                        </p>
                      )}
                    </div>
                  ))}
                  {hearings.map((hearing) => (
                    <div
                      key={hearing.id}
                      className="p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <h4 className="font-medium text-sm text-foreground">
                        {hearing.title}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1">
                        {hearing.date} - {hearing.committee}
                      </p>
                      {hearing.summary && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                          {hearing.summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="votes" className="h-full overflow-auto m-0">
              {isLoading ? (
                <div className="p-4 space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="space-y-2">
                      <div className="h-5 w-3/4 bg-accent animate-pulse rounded" />
                      <div className="h-4 w-full bg-accent animate-pulse rounded" />
                    </div>
                  ))}
                </div>
              ) : votes.length === 0 ? (
                <EmptyVotesState />
              ) : (
                <div className="p-4 space-y-3">
                  {votes.map((vote) => (
                    <div
                      key={vote.id}
                      className="p-3 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm text-foreground truncate">
                          {vote.billTitle}
                        </h4>
                        <span
                          className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            vote.result === "passed"
                              ? "bg-green-900/50 text-green-400"
                              : "bg-red-900/50 text-red-400"
                          )}
                        >
                          {vote.result}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {vote.date} - {vote.chamber}
                      </p>
                      <div className="flex gap-3 mt-2 text-xs">
                        <span className="text-green-400">Yeas: {vote.yeas}</span>
                        <span className="text-red-400">Nays: {vote.nays}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Contact Representatives CTA - fixed at bottom, outside Tabs */}
        {currentTab === "people" && hasSelections && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="flex-shrink-0 p-3 border-t border-border bg-background"
          >
            <Button
              onClick={handleContactRepresentatives}
              className="w-full gap-2"
              size="lg"
            >
              <Send className="size-4" />
              Contact {selectionCount} Representative{selectionCount !== 1 ? "s" : ""}
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
