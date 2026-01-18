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
  Landmark,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type {
  Legislator,
  Document,
  VoteRecord,
  Hearing,
  SearchResultData,
  Speaker,
  SpeakerSentimentMap,
} from "@/lib/types";
import { getContentTypeDisplayName } from "@/lib/search-service";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LegislatorList } from "./legislator-list";
import { SpeakerCard } from "@/components/legislators";
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
  searchResults?: SearchResultData[];
  /** Speakers extracted from search results */
  speakers?: Speaker[];
  /** Sentiment scores for speakers (speaker ID -> score 0-100) */
  sentimentScores?: SpeakerSentimentMap;
  /** Whether sentiment analysis is loading */
  sentimentLoading?: boolean;
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
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-secondary mb-4">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <h3 className="font-display text-base font-semibold text-foreground mb-1.5">
        {title}
      </h3>
      <p className="text-sm text-muted-foreground max-w-[260px] leading-relaxed">
        {description}
      </p>
    </motion.div>
  );
}

interface SearchDocumentCardProps {
  title: string;
  date?: string;
  contentType?: string;
  text?: string;
  speakerName?: string;
  chamber?: string;
  committee?: string;
  sourceUrl?: string;
}

function SearchDocumentCard({
  title,
  date,
  contentType,
  text,
  speakerName,
  chamber,
  committee,
  sourceUrl,
}: SearchDocumentCardProps) {
  const displayType = contentType ? getContentTypeDisplayName(contentType) : undefined;
  const formattedDate = date ? formatDate(date) : undefined;

  const handleClick = () => {
    if (sourceUrl) {
      window.open(sourceUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      onClick={handleClick}
      className={cn(
        "group p-4 rounded-xl border border-border bg-card hover:border-accent/30 hover:shadow-md transition-all duration-200 card-shadow",
        sourceUrl && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h4 className="font-medium text-sm text-foreground group-hover:text-accent transition-colors line-clamp-2 flex-1">
              {title}
            </h4>
            {displayType && (
              <Badge
                variant="secondary"
                className="shrink-0 text-[10px] font-medium uppercase tracking-wide bg-secondary text-muted-foreground"
              >
                {displayType}
              </Badge>
            )}
          </div>

          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-2 text-xs text-muted-foreground">
            {formattedDate && (
              <>
                <Calendar className="size-3" />
                <span>{formattedDate}</span>
              </>
            )}
            {chamber && (
              <>
                {formattedDate && <span className="text-border">|</span>}
                <span className="capitalize">{chamber}</span>
              </>
            )}
            {committee && (
              <>
                {(formattedDate || chamber) && <span className="text-border">|</span>}
                <Building2 className="size-3" />
                <span className="truncate max-w-[180px]">{committee}</span>
              </>
            )}
            {speakerName && (
              <>
                {(formattedDate || chamber || committee) && <span className="text-border">|</span>}
                <Users className="size-3" />
                <span className="truncate max-w-[140px]">{speakerName}</span>
              </>
            )}
          </div>

          {text && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
              {text}
            </p>
          )}
        </div>

        {sourceUrl && (
          <ExternalLink className="size-4 text-muted-foreground/0 group-hover:text-accent shrink-0 transition-colors mt-0.5" />
        )}
      </div>
    </motion.div>
  );
}

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateStr;
  }
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
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      className="group p-4 rounded-xl border border-border bg-card hover:border-accent/30 hover:shadow-md transition-all duration-200 cursor-pointer card-shadow"
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

interface SearchVoteCardProps {
  title: string;
  date?: string;
  text?: string;
  chamber?: string;
  sourceUrl?: string;
}

function SearchVoteCard({
  title,
  date,
  text,
  chamber,
  sourceUrl,
}: SearchVoteCardProps) {
  const formattedDate = date ? formatDate(date) : undefined;

  const handleClick = () => {
    if (sourceUrl) {
      window.open(sourceUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      onClick={handleClick}
      className={cn(
        "group p-4 rounded-xl border border-border bg-card hover:border-accent/30 hover:shadow-md transition-all duration-200 card-shadow",
        sourceUrl && "cursor-pointer"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            <h4 className="font-medium text-sm text-foreground group-hover:text-accent transition-colors line-clamp-2 flex-1">
              {title}
            </h4>
            <Badge
              variant="secondary"
              className="shrink-0 text-[10px] font-medium uppercase tracking-wide bg-teal/10 text-teal border-teal/20"
            >
              Vote
            </Badge>
          </div>

          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
            {formattedDate && (
              <>
                <Calendar className="size-3" />
                <span>{formattedDate}</span>
              </>
            )}
            {chamber && (
              <>
                {formattedDate && <span className="text-border">|</span>}
                <span className="capitalize">{chamber}</span>
              </>
            )}
          </div>

          {text && (
            <p className="text-sm text-muted-foreground mt-3 line-clamp-2 leading-relaxed">
              {text}
            </p>
          )}
        </div>

        {sourceUrl && (
          <ExternalLink className="size-4 text-muted-foreground/0 group-hover:text-accent shrink-0 transition-colors mt-0.5" />
        )}
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
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      className="group p-4 rounded-xl border border-border bg-card hover:border-accent/30 hover:shadow-md transition-all duration-200 card-shadow"
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
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
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

      <div className="relative h-1.5 rounded-full bg-secondary overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${yeasPercent}%` }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full"
        />
      </div>

      <div className="flex justify-between mt-2 text-xs font-medium">
        <span className="text-emerald-600">Yeas: {vote.yeas}</span>
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
          className="p-4 rounded-xl border border-border/50 bg-card animate-pulse"
        >
          <div className="h-4 w-3/4 bg-secondary rounded mb-3" />
          <div className="h-3 w-1/2 bg-secondary/70 rounded mb-3" />
          <div className="h-3 w-full bg-secondary/50 rounded" />
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
  searchResults = [],
  speakers = [],
  sentimentScores = {},
  sentimentLoading = false,
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
    applySpeakerFilters,
  } = useFilters();

  const filteredLegislators = React.useMemo(
    () => applyFilters(legislators),
    [legislators, applyFilters]
  );

  // Filter speakers from search results
  const filteredSpeakers = React.useMemo(
    () => applySpeakerFilters(speakers),
    [speakers, applySpeakerFilters]
  );

  const selectedIds = React.useMemo(
    () => selectedLegislators.map((l) => l.id),
    [selectedLegislators]
  );

  const searchDocuments = React.useMemo(
    () => searchResults.filter((r) => r.content_type === "hearing" || r.content_type === "floor_speech"),
    [searchResults]
  );

  const searchVotes = React.useMemo(
    () => searchResults.filter((r) => r.content_type === "vote"),
    [searchResults]
  );

  const hasSearchResults = searchResults.length > 0;

  // Extract matched legislators from speakers (for selection/contact flow)
  // These are speakers who have been matched to current legislators with contact info
  // Also enrich with sentiment scores converted to leaning scores
  const matchedLegislatorsFromSpeakers = React.useMemo(
    () => filteredSpeakers
      .filter((s) => s.matchedLegislator !== undefined)
      .map((s) => {
        const legislator = s.matchedLegislator!;
        const sentiment = sentimentScores[s.id];
        // Convert sentiment score (0-100) to leaning score (-100 to +100)
        const leaningScore = sentiment !== undefined
          ? (sentiment.score - 50) * 2
          : legislator.leaningScore;
        return {
          ...legislator,
          leaningScore,
        };
      }),
    [filteredSpeakers, sentimentScores]
  );

  // Determine which legislators list to use for selection based on mode
  const selectableLegislators = hasSearchResults
    ? matchedLegislatorsFromSpeakers
    : filteredLegislators;

  // Check if we have any contactable legislators (either from search or direct)
  const hasContactableLegislators = selectableLegislators.length > 0;
  const effectiveDocumentCount = hasSearchResults ? searchDocuments.length : documents.length + hearings.length;
  const effectiveVoteCount = hasSearchResults ? searchVotes.length : votes.length;

  // For people count: use filtered speakers from search results when available, otherwise use filtered legislators
  const effectivePeopleCount = hasSearchResults ? filteredSpeakers.length : filteredLegislators.length;

  const tabs: TabConfig[] = [
    { id: "people", label: "People", icon: Users, count: effectivePeopleCount },
    { id: "documents", label: "Documents", icon: FileText, count: effectiveDocumentCount },
    { id: "votes", label: "Votes", icon: Vote, count: effectiveVoteCount },
  ];

  const totalResults = effectivePeopleCount + effectiveDocumentCount + effectiveVoteCount;

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
    setSelectedLegislators(selectableLegislators);
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
    <div className={cn("flex flex-col flex-1 min-h-0 bg-background", className)}>
      {/* Mobile toggle bar */}
      <div className="lg:hidden border-b border-border">
        <Button
          variant="ghost"
          onClick={toggleMobileExpand}
          className="w-full flex items-center justify-between min-h-[52px] py-3 px-4 h-auto rounded-none touch-manipulation"
          aria-expanded={isMobileExpanded}
          aria-controls="results-panel-content"
        >
          <span className="flex items-center gap-2.5 text-sm font-medium">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-secondary">
              <Landmark className="size-4 text-muted-foreground" />
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
          <div className="flex-shrink-0 border-b border-border px-3 py-3">
            <TabsList className="w-full grid grid-cols-3 h-auto bg-secondary/50 p-1 rounded-lg">
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center justify-center gap-1.5 min-h-[38px] px-2 rounded-md data-[state=active]:bg-card data-[state=active]:shadow-sm transition-all touch-manipulation"
                >
                  <tab.icon className="size-4 flex-shrink-0" />
                  <span className="hidden md:inline text-sm font-medium">{tab.label}</span>
                  {tab.count > 0 && (
                    <span className="text-[10px] bg-accent text-accent-foreground px-1.5 py-0.5 rounded-md min-w-[20px] text-center font-semibold">
                      {tab.count}
                    </span>
                  )}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>

          {/* Filter bar - show for both legislators and speakers from search results */}
          {currentTab === "people" && (legislators.length > 0 || speakers.length > 0) && (
            <div className="flex-shrink-0 border-b border-border px-3 py-3 space-y-2.5 bg-secondary/20">
              <FilterBar
                filters={filters}
                onToggleParty={toggleParty}
                onToggleChamber={toggleChamber}
                onToggleState={toggleState}
                onToggleStance={hasSearchResults ? undefined : toggleStance} // Disable stance filter for search results
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
                onRemoveStance={hasSearchResults ? undefined : toggleStance} // Disable stance chip removal for search results
              />
              {/* Selection mode controls - show when there are contactable legislators */}
              {hasContactableLegislators && (
                <div className="flex items-center justify-between pt-1">
                  <Button
                    variant={isSelectionMode ? "default" : "outline"}
                    size="sm"
                    onClick={handleToggleSelectionMode}
                    className={cn(
                      "gap-2 rounded-lg h-8",
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
                          disabled={selectedIds.length === selectableLegislators.length}
                          className="text-xs h-8"
                        >
                          Select all
                        </Button>
                        {hasSelections && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearSelections}
                            className="text-xs text-muted-foreground h-8"
                          >
                            Clear
                          </Button>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Tab content */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <TabsContent value="people" className="h-full overflow-auto m-0 scrollbar-thin">
              {isLoading && effectivePeopleCount === 0 ? (
                <LoadingSkeleton />
              ) : effectivePeopleCount === 0 ? (
                <EmptyState
                  icon={Users}
                  title={hasActiveFilters ? "No legislators match filters" : "No people found"}
                  description={
                    hasActiveFilters
                      ? "Try adjusting or clearing your filters to see more results."
                      : "Legislators and congressional speakers will appear here."
                  }
                />
              ) : hasSearchResults ? (
                // Show speakers from search results with selection support
                <div className="p-4 space-y-3">
                  {filteredSpeakers.map((speaker) => (
                    <SpeakerCard
                      key={speaker.id}
                      speaker={speaker}
                      sentiment={sentimentScores[speaker.id] ?? null}
                      sentimentLoading={sentimentLoading}
                      selectable={isSelectionMode}
                      isSelected={speaker.matchedLegislator ? selectedIds.includes(speaker.matchedLegislator.id) : false}
                      onToggleSelect={toggleLegislator}
                    />
                  ))}
                </div>
              ) : (
                // Show legislators from AI extraction
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
              )}
            </TabsContent>

            <TabsContent value="documents" className="h-full overflow-auto m-0 scrollbar-thin">
              {isLoading && effectiveDocumentCount === 0 ? (
                <LoadingSkeleton />
              ) : effectiveDocumentCount === 0 ? (
                <EmptyState
                  icon={FileText}
                  title="No documents found"
                  description="Relevant documents, hearings, and transcripts will appear here."
                />
              ) : hasSearchResults ? (
                <div className="p-4 space-y-3">
                  {searchDocuments.map((result) => (
                    <SearchDocumentCard
                      key={`${result.content_id}-${result.segment_index}`}
                      title={result.title || "Untitled Document"}
                      date={result.date}
                      contentType={result.content_type}
                      text={result.text}
                      speakerName={result.speaker_name}
                      chamber={result.chamber}
                      committee={result.committee}
                      sourceUrl={result.source_url}
                    />
                  ))}
                </div>
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

            <TabsContent value="votes" className="h-full overflow-auto m-0 scrollbar-thin">
              {isLoading && effectiveVoteCount === 0 ? (
                <LoadingSkeleton />
              ) : effectiveVoteCount === 0 ? (
                <EmptyState
                  icon={Vote}
                  title="No votes found"
                  description="Voting records related to your query will appear here."
                />
              ) : hasSearchResults ? (
                <div className="p-4 space-y-3">
                  {searchVotes.map((result) => (
                    <SearchVoteCard
                      key={`${result.content_id}-${result.segment_index}`}
                      title={result.title || "Vote Record"}
                      date={result.date}
                      text={result.text}
                      chamber={result.chamber}
                      sourceUrl={result.source_url}
                    />
                  ))}
                </div>
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
              className="flex-shrink-0 p-4 border-t border-border bg-card"
            >
              <Button
                onClick={handleContactRepresentatives}
                className="w-full gap-2 rounded-lg bg-accent text-accent-foreground hover:bg-accent/90"
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
