"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Clock, MessageSquare, HelpCircle, RefreshCw, Edit3, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { CallScript, Legislator, TonePreference } from "@/lib/types";
import { ToneSelectorCompact } from "./tone-selector";
import { ContentActions } from "./content-actions";

interface CallScriptPanelProps {
  script: CallScript | null;
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

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes === 0) return `${seconds}s`;
  if (remainingSeconds === 0) return `${minutes}m`;
  return `${minutes}m ${remainingSeconds}s`;
}

function CallScriptSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        <div className="space-y-2">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-20 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-12 w-full" />
      </div>
    </div>
  );
}

export function CallScriptPanel({
  script,
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
}: CallScriptPanelProps) {

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <CardTitle className="text-base flex items-center gap-2">
              <Phone className="size-4" />
              Call Script
            </CardTitle>
            <CardDescription className="mt-1">
              Personalized script for calling {legislator.chamber === "Senate" ? "Senator" : "Rep."}{" "}
              {legislator.name}
            </CardDescription>
          </div>
          {script && (
            <Badge variant="outline" className="flex items-center gap-1 text-xs">
              <Clock className="size-3" />
              ~{formatDuration(script.estimatedDuration)}
            </Badge>
          )}
        </div>

        {/* Tone selector and actions */}
        <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-border">
          <ToneSelectorCompact
            value={selectedTone}
            onChange={onToneChange}
            disabled={isLoading}
          />
          <div className="flex items-center gap-2">
            {onEdit && script && (
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
              {isLoading ? "Generating..." : script ? "Regenerate" : "Generate"}
            </Button>
          </div>
        </div>

        {/* Content Actions */}
        {script && (
          <div className="mt-3 pt-3 border-t border-border">
            <ContentActions
              contentType="call"
              legislator={legislator}
              callScript={script}
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
              <CallScriptSkeleton />
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-lg bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive"
            >
              <p className="font-medium">Failed to generate script</p>
              <p className="mt-1 opacity-80">{error}</p>
            </motion.div>
          ) : script ? (
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              {/* Introduction */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <MessageSquare className="size-4" />
                  Introduction
                </div>
                <div className="rounded-lg bg-muted/50 p-3 text-sm leading-relaxed">
                  {script.introduction}
                </div>
              </div>

              {/* Talking Points */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <CheckCircle2 className="size-4" />
                  Key Talking Points
                </div>
                <ol className="space-y-2">
                  {script.talkingPoints.map((point, index) => (
                    <li
                      key={index}
                      className="flex gap-3 rounded-lg bg-muted/50 p-3 text-sm leading-relaxed"
                    >
                      <span className="flex-shrink-0 font-medium text-primary">{index + 1}.</span>
                      <span>{point}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Anticipated Responses */}
              {script.anticipatedResponses.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                    <HelpCircle className="size-4" />
                    If They Ask...
                  </div>
                  <div className="space-y-3">
                    {script.anticipatedResponses.map((ar, index) => (
                      <div
                        key={index}
                        className="rounded-lg border border-border bg-background p-3 text-sm"
                      >
                        <p className="font-medium text-foreground mb-2">
                          Q: {ar.question}
                        </p>
                        <p className="text-muted-foreground leading-relaxed">
                          A: {ar.response}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Closing */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                  <Phone className="size-4" />
                  Closing
                </div>
                <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 text-sm leading-relaxed">
                  {script.closing}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-lg bg-muted/50 p-6 text-center"
            >
              <Phone className="size-8 mx-auto mb-3 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Click &quot;Generate&quot; to create a personalized call script
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
