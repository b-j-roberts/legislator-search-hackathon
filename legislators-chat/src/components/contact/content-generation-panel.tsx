"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  MessageSquareText,
  Edit3,
  ChevronDown,
  ChevronUp,
  PenLine,
  Eye,
  ArrowLeft,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import type { ContactMethod, TonePreference, AdvocacyContext } from "@/lib/types";
import { useContactContent, useActiveContent } from "@/hooks/use-contact-content";
import { CallScriptPanel } from "./call-script-panel";
import { EmailDraftPanel } from "./email-draft-panel";
import { ContentEditorWithChat } from "./content-editor-with-chat";
import type { QueueItem } from "@/hooks/use-contact";

interface ContentGenerationPanelProps {
  activeItem: QueueItem;
  contactMethod: ContactMethod;
  researchContext?: string | null;
  className?: string;
}

interface AdvocacyContextFormProps {
  context: AdvocacyContext | null;
  onUpdate: (updates: Partial<AdvocacyContext>) => void;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  disabled?: boolean;
}

function AdvocacyContextForm({
  context,
  onUpdate,
  isExpanded,
  onToggleExpanded,
  disabled,
}: AdvocacyContextFormProps) {
  return (
    <Card className="border-dashed">
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Edit3 className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Customize Your Message</CardTitle>
          </div>
          {isExpanded ? (
            <ChevronUp className="size-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-4 text-muted-foreground" />
          )}
        </button>
        {!isExpanded && context?.topic && (
          <CardDescription className="mt-1 truncate">
            Topic: {context.topic}
          </CardDescription>
        )}
      </CardHeader>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="space-y-4 pt-2">
              {/* Main Topic */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Topic/Issue <span className="text-destructive">*</span>
                </label>
                <Input
                  placeholder="e.g., Climate change legislation, Healthcare access..."
                  value={context?.topic || ""}
                  onChange={(e) => onUpdate({ topic: e.target.value })}
                  disabled={disabled}
                />
              </div>

              {/* Position */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Your Position</label>
                <Input
                  placeholder="e.g., Support, Oppose, Request information about..."
                  value={context?.position || ""}
                  onChange={(e) => onUpdate({ position: e.target.value })}
                  disabled={disabled}
                />
              </div>

              {/* Specific Ask */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">Specific Ask</label>
                <Input
                  placeholder="e.g., Vote yes on HR 1234, Co-sponsor the bill..."
                  value={context?.specificAsk || ""}
                  onChange={(e) => onUpdate({ specificAsk: e.target.value })}
                  disabled={disabled}
                />
              </div>

              {/* Personal Story */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">
                  Personal Connection (optional)
                </label>
                <Textarea
                  placeholder="Share why this issue matters to you personally..."
                  value={context?.personalStory || ""}
                  onChange={(e) => onUpdate({ personalStory: e.target.value })}
                  disabled={disabled}
                  rows={3}
                  className="resize-none"
                />
                <p className="text-xs text-muted-foreground">
                  Personal stories make your message more compelling
                </p>
              </div>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}

export function ContentGenerationPanel({
  activeItem,
  contactMethod,
  researchContext,
  className,
}: ContentGenerationPanelProps) {
  const {
    state,
    generateContent,
    setSelectedTone,
    setAdvocacyContext,
    updateAdvocacyContext,
  } = useContactContent();

  const { content, isGenerating, error } = useActiveContent(activeItem);

  const [isContextExpanded, setIsContextExpanded] = React.useState(
    !state.advocacyContext?.topic
  );

  // Edit mode state - when true, show the content editor with AI chat
  const [isEditMode, setIsEditMode] = React.useState(false);
  const [selectedSubjectIndex, setSelectedSubjectIndex] = React.useState(0);

  // Initialize advocacy context from research context if not set
  React.useEffect(() => {
    if (researchContext && !state.advocacyContext?.topic) {
      setAdvocacyContext({ topic: researchContext });
      setIsContextExpanded(false);
    }
  }, [researchContext, state.advocacyContext?.topic, setAdvocacyContext]);

  // Reset edit mode when switching legislators or contact method
  React.useEffect(() => {
    setIsEditMode(false);
  }, [activeItem.legislator.id, contactMethod]);

  const handleGenerate = React.useCallback(
    async (forceRegenerate = false) => {
      await generateContent(activeItem.legislator, contactMethod, {
        tone: state.selectedTone,
        forceRegenerate,
      });
    },
    [activeItem.legislator, contactMethod, state.selectedTone, generateContent]
  );

  const handleRegenerate = React.useCallback(() => {
    handleGenerate(true);
  }, [handleGenerate]);

  const handleToneChange = React.useCallback(
    (tone: TonePreference) => {
      setSelectedTone(tone);
    },
    [setSelectedTone]
  );

  // Get the appropriate content based on contact method
  const callScript = content?.callScript || null;
  const emailDraft = content?.emailDraft || null;

  const hasTopicSet = !!state.advocacyContext?.topic?.trim();
  const hasGeneratedContent = contactMethod === "call" ? !!callScript : !!emailDraft;

  // If in edit mode and we have content, show the editor
  if (isEditMode && hasGeneratedContent) {
    const originalContent = contactMethod === "call" ? callScript! : emailDraft!;

    return (
      <div className={cn("space-y-4", className)}>
        {/* Header with back button */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditMode(false)}
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <PenLine className="size-5" />
              Edit & Refine
            </h2>
          </div>
          <Badge variant="outline">
            {contactMethod === "call" ? "Call Script" : "Email Draft"}
          </Badge>
        </div>

        {/* Content Editor with Chat */}
        <ContentEditorWithChat
          contentType={contactMethod}
          originalContent={originalContent}
          selectedSubjectIndex={selectedSubjectIndex}
          legislator={activeItem.legislator}
          advocacyContext={state.advocacyContext}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
          <Sparkles className="size-5" />
          AI-Generated Content
        </h2>
        <div className="flex items-center gap-2">
          {!hasTopicSet && (
            <span className="text-sm text-muted-foreground">
              Set a topic to generate content
            </span>
          )}
          {hasGeneratedContent && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditMode(true)}
              className="gap-1.5"
            >
              <PenLine className="size-3.5" />
              Edit & Refine
            </Button>
          )}
        </div>
      </div>

      {/* Advocacy Context Form */}
      <AdvocacyContextForm
        context={state.advocacyContext}
        onUpdate={updateAdvocacyContext}
        isExpanded={isContextExpanded}
        onToggleExpanded={() => setIsContextExpanded(!isContextExpanded)}
        disabled={isGenerating}
      />

      {/* Generate Button (when no content yet) */}
      {hasTopicSet && !content && !isGenerating && (
        <Button onClick={() => handleGenerate(false)} className="w-full gap-2">
          <Sparkles className="size-4" />
          Generate {contactMethod === "call" ? "Call Script" : "Email Draft"}
        </Button>
      )}

      {/* Content Panels */}
      {contactMethod === "call" ? (
        <CallScriptPanel
          script={callScript}
          legislator={activeItem.legislator}
          isLoading={isGenerating}
          error={error}
          selectedTone={state.selectedTone}
          onToneChange={handleToneChange}
          onRegenerate={handleRegenerate}
        />
      ) : (
        <EmailDraftPanel
          draft={emailDraft}
          legislator={activeItem.legislator}
          isLoading={isGenerating}
          error={error}
          selectedTone={state.selectedTone}
          onToneChange={handleToneChange}
          onRegenerate={handleRegenerate}
        />
      )}

      {/* Edit prompt when content exists */}
      {hasGeneratedContent && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary/10 p-2">
                  <PenLine className="size-4 text-primary" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Want to customize this content?
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Edit the text directly or use AI to refine specific parts
                  </p>
                </div>
              </div>
              <Button
                variant="default"
                size="sm"
                onClick={() => setIsEditMode(true)}
                className="gap-1.5"
              >
                <PenLine className="size-3.5" />
                Edit & Refine
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tip for non-generated state */}
      {content && !hasGeneratedContent && (
        <p className="text-xs text-muted-foreground text-center">
          <MessageSquareText className="size-3 inline mr-1" />
          Tip: Customize the topic or add a personal story, then regenerate for better results
        </p>
      )}
    </div>
  );
}
