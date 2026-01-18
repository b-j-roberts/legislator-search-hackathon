"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  FileText,
  Vote,
  ChevronUp,
  Send,
  CheckSquare,
  Square,
  Calendar,
  ExternalLink,
  Building2,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  Legislator,
  Document,
  VoteRecord,
  Hearing,
} from "@/lib/types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LegislatorList } from "./legislator-list";
import { FilterBar, FilterChips } from "@/components/filters";
import { useFilters } from "@/hooks/use-filters";
import { useContact } from "@/hooks/use-contact";
import { useChat } from "@/components/providers";
import { extractAdvocacyContext } from "@/hooks/use-chat-extraction";

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

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-2xl bg-muted/50 mb-4">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <h3 className="font-display text-lg font-semibold text-foreground mb-2">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-[280px]">{description}</p>
    </motion.div>
  );
}

function DocumentCard({
  title,
  date,
  type,
  summary,
  committee,
}: {
  title: string;
  date: string;
  type?: string;
  summary?: string;
  committee?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="group p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-border hover:shadow-md transition-all duration-200 cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium text-sm text-foreground group-hover:text-accent transition-colors line-clamp-2">
            {title}
          </h4>
          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            <Calendar className="size-3" />
            <span>{date}</span>
            {(type || committee) && (
              <>
                <span className="text-border">|</span>
                <Building2 className="size-3" />
                <span className="truncate">{committee || type}</span>
              </>
            )}
          </div>
          {summary && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
              {summary}
            </p>
          )}
        </div>
        <ExternalLink className="size-4 text-muted-foreground/0 group-hover:text-accent shrink-0 transition-colors" />
      </div>
    </motion.div>
  );
}

function VoteCard({ vote }: { vote: VoteRecord }) {
  const passed = vote.result === "passed";
  const total = vote.yeas + vote.nays;
  const yeasPercent = total > 0 ? (vote.yeas / total) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="group p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-border hover:shadow-md transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <h4 className="font-medium text-sm text-foreground group-hover:text-accent transition-colors line-clamp-2 flex-1">
          {vote.billTitle}
        </h4>
        <Badge
          variant="secondary"
          className={cn(
            "shrink-0 text-[10px] font-semibold uppercase tracking-wide",
            passed
              ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
              : "bg-red-500/10 text-red-500 border-red-500/20"
          )}
        >
          {vote.result}
        </Badge>
      </div>

      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-3">
        <Calendar className="size-3" />
        <span>{vote.date}</span>
        <span className="text-border">|</span>
        <span className="capitalize">{vote.chamber}</span>
      </div>

      {/* Vote bar */}
      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${yeasPercent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
        />
      </div>

      <div className="flex justify-between mt-2 text-xs font-medium">
        <span className="text-emerald-500">Yeas: {vote.yeas}</span>
        <span className="text-red-500">Nays: {vote.nays}</span>
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-4 rounded-xl border border-border/30 bg-muted/20 animate-pulse"
        >
          <div className="h-4 w-3/4 bg-muted rounded mb-3" />
          <div className="h-3 w-1/2 bg-muted/70 rounded mb-3" />
          <div className="h-3 w-full bg-muted/50 rounded" />
        </div>
      ))}
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

  const { messages } = useChat();

  const {
    selectedLegislators,
    toggleLegislator,
    clearSelections,
    setSelectedLegislators,
    setCurrentStep,
    selectionCount,
    hasSelections,
    setAdvocacyContext,
  } = useContact();

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

  const filteredLegislators = React.useMemo(
    () => applyFilters(legislators),
    [legislators, applyFilters]
  );

  const selectedIds = React.useMemo(
    () => selectedLegislators.map((l) => l.id),
    [selectedLegislators]
  );

  const tabs: TabConfig[] = [
    { id: "people", label: "People", icon: Users, count: filteredLegislators.length },
    {
      id: "documents",
      label: "Documents",
      icon: FileText,
      count: documents.length + hearings.length,
    },
    { id: "votes", label: "Votes", icon: Vote, count: votes.length },
  ];

  const totalResults =
    filteredLegislators.length + documents.length + votes.length + hearings.length;

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
      clearSelections();
    }
    setIsSelectionMode(!isSelectionMode);
  };

  const handleSelectAll = () => {
    setSelectedLegislators(filteredLegislators);
  };

  const handleContactRepresentatives = () => {
    const extraction = extractAdvocacyContext(messages);
    if (extraction.advocacyContext) {
      setAdvocacyContext(extraction.advocacyContext, extraction.populatedFields);
    }

    setCurrentStep("contact");
    router.push("/contact");
  };

  return (
    <div className={cn("flex flex-col flex-1 min-h-0 bg-background/50", className)}>
      {/* Mobile toggle bar */}
      <div className="lg:hidden border-b border-border/50">
        <Button
          variant="ghost"
          onClick={toggleMobileExpand}
          className="w-full flex items-center justify-between min-h-[52px] py-3 px-4 h-auto rounded-none touch-manipulation"
          aria-expanded={isMobileExpanded}
          aria-controls="results-panel-content"
        >
          <span className="flex items-center gap-2.5 text-sm font-medium">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-accent/10">
              <Users className="size-4 text-accent" />
            </div>
            <span className="font-display">Results</span>
            {totalResults > 0 && (
              <Badge
                variant="secondary"
                className="bg-accent text-accent-foreground border-0 font-semibold"
              >
                {totalResults}
              </Badge>
            )}
          </span>
          <motion.div
            animate={{ rotate: isMobileExpanded ? 180 : 0 }}
            transition={{ duration: 0.2 }}
          >
            <ChevronUp className="size-5 text-muted-foreground" />
          </motion.div>
        </Button>
      </div>

      {/* Panel content */}
      <div
        id="results-panel-content"
        className={cn(
          "flex-col flex-1 min-h-0 overflow-hidden transition-all duration-200",
          isMobileExpanded ? "flex" : "hidden",
          "lg:flex"
        )}
      >
        <Tabs
          value={currentTab}
          onValueChange={handleTabChange}
          className="flex flex-col flex-1 overflow-hidden"
        >
          {/* Tab navigation */}
          <div className="flex-shrink-0 border-b border-border/50 p-3">
            <TabsList className="w-full grid grid-cols-3 h-auto bg-muted/30 p-1 rounded-xl">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center justify-center gap-2 min-h-[42px] px-3 rounded-lg data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all touch-manipulation"
                >
                  <tab.icon className="size-4 flex-shrink-0" />
                  <span className="hidden md:inline text-sm font-medium">{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="text-[11px] bg-accent text-accent-foreground px-2 py-0.5 rounded-full min-w-[22px] text-center font-semibold">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Filter bar */}
          {currentTab === "people" && legislators.length > 0 && (
            <div className="flex-shrink-0 border-b border-border/50 px-3 py-3 space-y-2.5 bg-muted/20">
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
                  variant={isSelectionMode ? "default" : "outline"}
                  size="sm"
                  onClick={handleToggleSelectionMode}
                  className={cn(
                    "gap-2 rounded-lg",
                    isSelectionMode && "bg-accent text-accent-foreground hover:bg-accent/90"
                  )}
                >
                  {isSelectionMode ? (
                    <>
                      <CheckSquare className="size-4" />
                      <span className="hidden sm:inline">Done</span>
                    </>
                  ) : (
                    <>
                      <Square className="size-4" />
                      <span className="hidden sm:inline">Select</span>
                    </>
                  )}
                </Button>
                <AnimatePresence>
                  {isSelectionMode && (
                    <motion.div
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 10 }}
                      className="flex items-center gap-2"
                    >
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleSelectAll}
                        disabled={selectedIds.length === filteredLegislators.length}
                        className="text-xs"
                      >
                        Select all
                      </Button>
                      {hasSelections && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={clearSelections}
                          className="text-xs text-muted-foreground"
                        >
                          Clear
                        </Button>
                      )}
                    </motion.div>
                  )}
                </AnimatePresence>
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
                <LoadingSkeleton />
              ) : documents.length === 0 && hearings.length === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents found"
                  description="Relevant documents, hearings, and transcripts will appear here."
                />
              ) : (
                <div className="p-4 space-y-3">
                  {documents.map((doc) => (
                    <DocumentCard
                      key={doc.id}
                      title={doc.title}
                      date={doc.date}
                      type={doc.type}
                      summary={doc.summary}
                    />
                  ))}
                  {hearings.map((hearing) => (
                    <DocumentCard
                      key={hearing.id}
                      title={hearing.title}
                      date={hearing.date}
                      committee={hearing.committee}
                      summary={hearing.summary}
                    />
                  ))}
                </div>
              )}
            </TabsContent>

            <TabsContent value="votes" className="h-full overflow-auto m-0">
              {isLoading ? (
                <LoadingSkeleton />
              ) : votes.length === 0 ? (
                <EmptyState
                  icon={Vote}
                  title="No votes found"
                  description="Voting records related to your query will appear here."
                />
              ) : (
                <div className="p-4 space-y-3">
                  {votes.map((vote) => (
                    <VoteCard key={vote.id} vote={vote} />
                  ))}
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>

        {/* Contact CTA */}
        <AnimatePresence>
          {currentTab === "people" && hasSelections && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="flex-shrink-0 p-4 border-t border-border/50 bg-background/80 backdrop-blur-sm"
            >
              <Button
                onClick={handleContactRepresentatives}
                className="w-full gap-2 rounded-xl bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20"
                size="lg"
              >
                <Send className="size-4" />
                Contact {selectionCount} Representative{selectionCount !== 1 ? "s" : ""}
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
