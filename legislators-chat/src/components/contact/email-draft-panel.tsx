"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  FileText,
  Quote,
  Link as LinkIcon,
  RefreshCw,
  ChevronDown,
  Edit3,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { EmailDraft, Legislator, TonePreference } from "@/lib/types";
import { ToneSelectorCompact } from "./tone-selector";
import { ContentActions } from "./content-actions";

interface EmailDraftPanelProps {
  draft: EmailDraft | null;
  legislator: Legislator;
  isLoading?: boolean;
  error?: string | null;
  selectedTone: TonePreference;
  onToneChange: (tone: TonePreference) => void;
  onRegenerate: () => void;
  onEdit?: () => void;
  onSaveDraft?: () => void;
  hasUnsavedChanges?: boolean;
  className?: string;
}

function EmailDraftSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-1.5">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </div>
      </div>
      <Skeleton className="h-4 w-48" />
      <div className="space-y-2">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

interface SubjectLineSelectorProps {
  subjects: string[];
  selected: number;
  onSelect: (index: number) => void;
}

function SubjectLineSelector({ subjects, selected, onSelect }: SubjectLineSelectorProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg",
          "border border-border bg-background text-left text-sm",
          "hover:border-primary/50 transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        )}
      >
        <span className="truncate font-medium">{subjects[selected]}</span>
        <ChevronDown
          className={cn("size-4 flex-shrink-0 transition-transform", isOpen && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-10 top-full left-0 right-0 mt-1 rounded-lg border border-border bg-background shadow-lg"
          >
            {subjects.map((subject, index) => (
              <button
                key={index}
                type="button"
                onClick={() => {
                  onSelect(index);
                  setIsOpen(false);
                }}
                className={cn(
                  "w-full px-3 py-2 text-left text-sm transition-colors",
                  "hover:bg-muted first:rounded-t-lg last:rounded-b-lg",
                  index === selected && "bg-primary/10 text-primary font-medium"
                )}
              >
                {subject}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function EmailDraftPanel({
  draft,
  legislator,
  isLoading,
  error,
  selectedTone,
  onToneChange,
  onRegenerate,
  onEdit,
  onSaveDraft,
  hasUnsavedChanges,
  className,
}: EmailDraftPanelProps) {
  const [selectedSubjectIndex, setSelectedSubjectIndex] = React.useState(0);

  // Reset subject index when draft changes
  React.useEffect(() => {
    setSelectedSubjectIndex(0);
  }, [draft]);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="size-4" />
              Email Draft
            </CardTitle>
            <CardDescription className="mt-1">
              Personalized email for {legislator.chamber === "Senate" ? "Senator" : "Rep."}{" "}
              {legislator.name}
            </CardDescription>
          </div>
        </div>

        {/* Tone selector and actions */}
        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border">
          <ToneSelectorCompact
            value={selectedTone}
            onChange={onToneChange}
            disabled={isLoading}
          />
          <div className="flex items-center gap-2">
            {onEdit && draft && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEdit}
                className="gap-1.5"
              >
                <Edit3 className="size-3.5" />
                Edit
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={onRegenerate}
              disabled={isLoading}
              className="gap-1.5"
            >
              <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
              {isLoading ? "Generating..." : draft ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>

        {/* Content Actions */}
        {draft && (
          <div className="mt-3 pt-3 border-t border-border">
            <ContentActions
              contentType="email"
              legislator={legislator}
              emailDraft={draft}
              selectedSubjectIndex={selectedSubjectIndex}
              onSaveDraft={onSaveDraft}
              hasUnsavedChanges={hasUnsavedChanges}
            />
          </div>
        )}
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmailDraftSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive"
            >
              <p className="font-medium">Failed to generate email</p>
              <p className="mt-1 opacity-80">{error}</p>
            </motion.div>
          ) : draft ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Subject Line Selector */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <FileText className="size-4" />
                  Subject Line
                  <Badge variant="outline" className="text-xs ml-auto">
                    {draft.subjectLines.length} options
                  </Badge>
                </div>
                <SubjectLineSelector
                  subjects={draft.subjectLines}
                  selected={selectedSubjectIndex}
                  onSelect={setSelectedSubjectIndex}
                />
              </div>

              {/* Email Preview */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Mail className="size-4" />
                  Email Body
                </div>
                <div className="rounded-lg border border-border bg-background p-4 space-y-4 text-sm">
                  {/* Salutation */}
                  <p className="font-medium">{draft.salutation}</p>

                  {/* Opening */}
                  <p className="leading-relaxed">{draft.opening}</p>

                  {/* Body paragraphs */}
                  {draft.body.map((paragraph, index) => (
                    <p key={index} className="leading-relaxed">
                      {paragraph}
                    </p>
                  ))}

                  {/* Closing */}
                  <p className="leading-relaxed">{draft.closing}</p>

                  {/* Signature */}
                  <p className="whitespace-pre-line text-muted-foreground">{draft.signature}</p>
                </div>
              </div>

              {/* Citations */}
              {draft.citations && draft.citations.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <Quote className="size-4" />
                    References
                  </div>
                  <div className="space-y-2">
                    {draft.citations.map((citation, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-2 rounded-lg bg-muted/50 p-3 text-sm"
                      >
                        <LinkIcon className="size-4 flex-shrink-0 mt-0.5 text-muted-foreground" />
                        <div className="min-w-0">
                          <p className="text-foreground">{citation.text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {citation.source}
                            {citation.url && (
                              <a
                                href={citation.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="ml-1 text-primary hover:underline"
                              >
                                View source
                              </a>
                            )}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-lg bg-muted/50 p-6 text-center"
            >
              <Mail className="size-8 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Click &quot;Generate&quot; to create a personalized email draft
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
