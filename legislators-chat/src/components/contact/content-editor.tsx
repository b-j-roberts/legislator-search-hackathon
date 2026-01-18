"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Edit3,
  Plus,
  Trash2,
  GripVertical,
  Undo2,
  Redo2,
  RotateCcw,
  Save,
  Eye,
  PenLine,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  EditableCallScript,
  EditableEmailDraft,
  CallScript,
  EmailDraft,
} from "@/lib/types";
import { useEditHistory, useEditHistoryKeyboard } from "@/hooks/use-edit-history";

// =============================================================================
// Utility Functions
// =============================================================================

/** Convert CallScript to EditableCallScript */
export function callScriptToEditable(script: CallScript): EditableCallScript {
  return {
    introduction: script.introduction,
    talkingPoints: [...script.talkingPoints],
    anticipatedResponses: script.anticipatedResponses.map((ar) => ({
      question: ar.question,
      response: ar.response,
    })),
    closing: script.closing,
  };
}

/** Convert EmailDraft to EditableEmailDraft */
export function emailDraftToEditable(
  draft: EmailDraft,
  selectedSubjectIndex: number = 0
): EditableEmailDraft {
  return {
    subjectLine: draft.subjectLines[selectedSubjectIndex] || draft.subjectLines[0],
    salutation: draft.salutation,
    opening: draft.opening,
    body: [...draft.body],
    closing: draft.closing,
    signature: draft.signature,
  };
}

/** Convert EditableCallScript back to plain text for copying */
export function editableCallScriptToText(script: EditableCallScript): string {
  const lines = [
    "INTRODUCTION:",
    script.introduction,
    "",
    "TALKING POINTS:",
    ...script.talkingPoints.map((point, i) => `${i + 1}. ${point}`),
    "",
  ];

  if (script.anticipatedResponses.length > 0) {
    lines.push("ANTICIPATED QUESTIONS:");
    script.anticipatedResponses.forEach((ar) => {
      lines.push(`Q: ${ar.question}`);
      lines.push(`A: ${ar.response}`);
      lines.push("");
    });
  }

  lines.push("CLOSING:");
  lines.push(script.closing);

  return lines.join("\n");
}

/** Convert EditableEmailDraft back to plain text for copying */
export function editableEmailDraftToText(draft: EditableEmailDraft): string {
  const lines = [
    `Subject: ${draft.subjectLine}`,
    "",
    draft.salutation,
    "",
    draft.opening,
    "",
    ...draft.body.map((p) => `${p}\n`),
    draft.closing,
    "",
    draft.signature,
  ];

  return lines.join("\n");
}

// =============================================================================
// Types
// =============================================================================

interface CallScriptEditorProps {
  content: EditableCallScript;
  onChange: (content: EditableCallScript) => void;
  isPreviewMode: boolean;
}

interface EmailDraftEditorProps {
  content: EditableEmailDraft;
  onChange: (content: EditableEmailDraft) => void;
  isPreviewMode: boolean;
}

interface ContentEditorProps {
  /** Type of content being edited */
  contentType: "call" | "email";
  /** Initial content (from generation) */
  initialContent: CallScript | EmailDraft;
  /** Selected subject index for emails */
  selectedSubjectIndex?: number;
  /** Called when content changes */
  onContentChange?: (
    content: EditableCallScript | EditableEmailDraft,
    isDirty: boolean
  ) => void;
  /** Called when user wants to save/apply changes */
  onSave?: (content: EditableCallScript | EditableEmailDraft) => void;
  /** Class name for the container */
  className?: string;
  /** External ref to access editor methods */
  editorRef?: React.RefObject<ContentEditorHandle | null>;
  /** Previously saved edited content to restore (takes priority over initialContent) */
  initialEditedContent?: EditableCallScript | EditableEmailDraft;
}

export interface ContentEditorHandle {
  /** Get current content */
  getContent: () => EditableCallScript | EditableEmailDraft | null;
  /** Apply refined content from AI */
  applyRefinement: (
    content: EditableCallScript | EditableEmailDraft,
    description: string
  ) => void;
  /** Check if content has been modified */
  isDirty: boolean;
  /** Undo last change */
  undo: () => void;
  /** Redo last undone change */
  redo: () => void;
  /** Can undo */
  canUndo: boolean;
  /** Can redo */
  canRedo: boolean;
  /** Reset to original */
  resetToOriginal: () => void;
}

// =============================================================================
// Call Script Editor
// =============================================================================

function CallScriptEditor({ content, onChange, isPreviewMode }: CallScriptEditorProps) {
  const updateField = <K extends keyof EditableCallScript>(
    field: K,
    value: EditableCallScript[K]
  ) => {
    onChange({ ...content, [field]: value });
  };

  const updateTalkingPoint = (index: number, value: string) => {
    const newPoints = [...content.talkingPoints];
    newPoints[index] = value;
    onChange({ ...content, talkingPoints: newPoints });
  };

  const addTalkingPoint = () => {
    onChange({ ...content, talkingPoints: [...content.talkingPoints, ""] });
  };

  const removeTalkingPoint = (index: number) => {
    const newPoints = content.talkingPoints.filter((_, i) => i !== index);
    onChange({ ...content, talkingPoints: newPoints });
  };

  const updateAnticipatedResponse = (
    index: number,
    field: "question" | "response",
    value: string
  ) => {
    const newResponses = [...content.anticipatedResponses];
    newResponses[index] = { ...newResponses[index], [field]: value };
    onChange({ ...content, anticipatedResponses: newResponses });
  };

  const addAnticipatedResponse = () => {
    onChange({
      ...content,
      anticipatedResponses: [
        ...content.anticipatedResponses,
        { question: "", response: "" },
      ],
    });
  };

  const removeAnticipatedResponse = (index: number) => {
    const newResponses = content.anticipatedResponses.filter((_, i) => i !== index);
    onChange({ ...content, anticipatedResponses: newResponses });
  };

  if (isPreviewMode) {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Introduction
          </p>
          <p className="text-sm leading-relaxed">{content.introduction}</p>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Talking Points
          </p>
          <ol className="space-y-2">
            {content.talkingPoints.map((point, index) => (
              <li key={index} className="flex gap-2 text-sm leading-relaxed">
                <span className="text-primary font-medium">{index + 1}.</span>
                <span>{point}</span>
              </li>
            ))}
          </ol>
        </div>

        {content.anticipatedResponses.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Anticipated Q&A
            </p>
            <div className="space-y-3">
              {content.anticipatedResponses.map((ar, index) => (
                <div key={index} className="text-sm space-y-1">
                  <p className="font-medium">Q: {ar.question}</p>
                  <p className="text-muted-foreground">A: {ar.response}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Closing
          </p>
          <p className="text-sm leading-relaxed">{content.closing}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Introduction */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Introduction
        </label>
        <Textarea
          value={content.introduction}
          onChange={(e) => updateField("introduction", e.target.value)}
          rows={3}
          className="resize-none text-sm"
          placeholder="Your introduction..."
        />
      </div>

      {/* Talking Points */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Talking Points
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addTalkingPoint}
            className="h-7 px-2 gap-1 text-xs"
          >
            <Plus className="size-3" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {content.talkingPoints.map((point, index) => (
            <div key={index} className="flex gap-2 items-start group">
              <span className="text-sm font-medium text-primary pt-2 w-5">
                {index + 1}.
              </span>
              <Textarea
                value={point}
                onChange={(e) => updateTalkingPoint(index, e.target.value)}
                rows={2}
                className="resize-none text-sm flex-1"
                placeholder={`Talking point ${index + 1}...`}
              />
              {content.talkingPoints.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeTalkingPoint(index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Anticipated Responses */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Anticipated Q&A
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addAnticipatedResponse}
            className="h-7 px-2 gap-1 text-xs"
          >
            <Plus className="size-3" />
            Add
          </Button>
        </div>
        <div className="space-y-3">
          {content.anticipatedResponses.map((ar, index) => (
            <div key={index} className="space-y-2 p-3 rounded-lg bg-muted/30 group relative">
              {content.anticipatedResponses.length > 0 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeAnticipatedResponse(index)}
                  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
              <Input
                value={ar.question}
                onChange={(e) =>
                  updateAnticipatedResponse(index, "question", e.target.value)
                }
                placeholder="If they ask..."
                className="text-sm"
              />
              <Textarea
                value={ar.response}
                onChange={(e) =>
                  updateAnticipatedResponse(index, "response", e.target.value)
                }
                rows={2}
                className="resize-none text-sm"
                placeholder="You could respond..."
              />
            </div>
          ))}
        </div>
      </div>

      {/* Closing */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Closing
        </label>
        <Textarea
          value={content.closing}
          onChange={(e) => updateField("closing", e.target.value)}
          rows={2}
          className="resize-none text-sm"
          placeholder="Your closing statement..."
        />
      </div>
    </div>
  );
}

// =============================================================================
// Email Draft Editor
// =============================================================================

function EmailDraftEditor({ content, onChange, isPreviewMode }: EmailDraftEditorProps) {
  const updateField = <K extends keyof EditableEmailDraft>(
    field: K,
    value: EditableEmailDraft[K]
  ) => {
    onChange({ ...content, [field]: value });
  };

  const updateBodyParagraph = (index: number, value: string) => {
    const newBody = [...content.body];
    newBody[index] = value;
    onChange({ ...content, body: newBody });
  };

  const addBodyParagraph = () => {
    onChange({ ...content, body: [...content.body, ""] });
  };

  const removeBodyParagraph = (index: number) => {
    const newBody = content.body.filter((_, i) => i !== index);
    onChange({ ...content, body: newBody });
  };

  if (isPreviewMode) {
    return (
      <div className="space-y-4 text-sm">
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Subject
          </p>
          <p className="font-medium">{content.subjectLine}</p>
        </div>

        <div className="border-t border-border pt-4 space-y-4">
          <p className="font-medium">{content.salutation}</p>
          <p className="leading-relaxed">{content.opening}</p>
          {content.body.map((paragraph, index) => (
            <p key={index} className="leading-relaxed">
              {paragraph}
            </p>
          ))}
          <p className="leading-relaxed">{content.closing}</p>
          <p className="whitespace-pre-line text-muted-foreground">{content.signature}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Subject Line */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Subject Line
        </label>
        <Input
          value={content.subjectLine}
          onChange={(e) => updateField("subjectLine", e.target.value)}
          placeholder="Email subject..."
          className="text-sm"
        />
      </div>

      {/* Salutation */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Salutation
        </label>
        <Input
          value={content.salutation}
          onChange={(e) => updateField("salutation", e.target.value)}
          placeholder="Dear..."
          className="text-sm"
        />
      </div>

      {/* Opening */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Opening
        </label>
        <Textarea
          value={content.opening}
          onChange={(e) => updateField("opening", e.target.value)}
          rows={3}
          className="resize-none text-sm"
          placeholder="Opening paragraph..."
        />
      </div>

      {/* Body Paragraphs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Body Paragraphs
          </label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={addBodyParagraph}
            className="h-7 px-2 gap-1 text-xs"
          >
            <Plus className="size-3" />
            Add
          </Button>
        </div>
        <div className="space-y-2">
          {content.body.map((paragraph, index) => (
            <div key={index} className="flex gap-2 items-start group">
              <Textarea
                value={paragraph}
                onChange={(e) => updateBodyParagraph(index, e.target.value)}
                rows={3}
                className="resize-none text-sm flex-1"
                placeholder={`Paragraph ${index + 1}...`}
              />
              {content.body.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeBodyParagraph(index)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Closing */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Closing
        </label>
        <Input
          value={content.closing}
          onChange={(e) => updateField("closing", e.target.value)}
          placeholder="Sincerely,..."
          className="text-sm"
        />
      </div>

      {/* Signature */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Signature
        </label>
        <Textarea
          value={content.signature}
          onChange={(e) => updateField("signature", e.target.value)}
          rows={3}
          className="resize-none text-sm"
          placeholder="Your name and contact info..."
        />
      </div>
    </div>
  );
}

// =============================================================================
// Main Content Editor Component
// =============================================================================

export function ContentEditor({
  contentType,
  initialContent,
  selectedSubjectIndex = 0,
  onContentChange,
  onSave,
  className,
  editorRef,
  initialEditedContent,
}: ContentEditorProps) {
  const [isPreviewMode, setIsPreviewMode] = React.useState(false);

  // Convert initial content to editable format, preferring saved edited content
  const initialEditable = React.useMemo(() => {
    // If we have previously saved edited content, use that
    if (initialEditedContent) {
      return initialEditedContent;
    }
    // Otherwise convert from the original generated content
    if (contentType === "call") {
      return callScriptToEditable(initialContent as CallScript);
    }
    return emailDraftToEditable(initialContent as EmailDraft, selectedSubjectIndex);
  }, [contentType, initialContent, selectedSubjectIndex, initialEditedContent]);

  // Use edit history hook
  const editHistory = useEditHistory<EditableCallScript | EditableEmailDraft>(
    initialEditable
  );

  // Enable keyboard shortcuts
  useEditHistoryKeyboard(editHistory, true);

  // Reset when initial content changes
  React.useEffect(() => {
    editHistory.reset(initialEditable);
  }, [initialContent, selectedSubjectIndex]);

  // Notify parent of changes
  React.useEffect(() => {
    if (onContentChange && editHistory.currentContent) {
      onContentChange(editHistory.currentContent, editHistory.isDirty);
    }
  }, [editHistory.currentContent, editHistory.isDirty, onContentChange]);

  // Handle content changes
  const handleChange = React.useCallback(
    (content: EditableCallScript | EditableEmailDraft) => {
      editHistory.pushState(content, "Manual edit");
    },
    [editHistory]
  );

  // Expose methods via ref
  React.useImperativeHandle(
    editorRef,
    () => ({
      getContent: () => editHistory.currentContent,
      applyRefinement: (
        content: EditableCallScript | EditableEmailDraft,
        description: string
      ) => {
        editHistory.pushState(content, description, true);
      },
      isDirty: editHistory.isDirty,
      undo: editHistory.undo,
      redo: editHistory.redo,
      canUndo: editHistory.canUndo,
      canRedo: editHistory.canRedo,
      resetToOriginal: editHistory.revertToOriginal,
    }),
    [editHistory]
  );

  if (!editHistory.currentContent) {
    return null;
  }

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Edit3 className="size-4 text-muted-foreground" />
            <CardTitle className="text-sm font-medium">Edit Content</CardTitle>
            {editHistory.isDirty && (
              <Badge variant="secondary" className="text-xs">
                Modified
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Mode Toggle */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={isPreviewMode ? "secondary" : "ghost"}
                    size="icon-sm"
                    onClick={() => setIsPreviewMode(!isPreviewMode)}
                  >
                    {isPreviewMode ? (
                      <PenLine className="size-3.5" />
                    ) : (
                      <Eye className="size-3.5" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isPreviewMode ? "Edit mode" : "Preview mode"}
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Undo */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={editHistory.undo}
                    disabled={!editHistory.canUndo}
                  >
                    <Undo2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Undo (Cmd+Z)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Redo */}
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={editHistory.redo}
                    disabled={!editHistory.canRedo}
                  >
                    <Redo2 className="size-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Redo (Cmd+Shift+Z)</TooltipContent>
              </Tooltip>
            </TooltipProvider>

            {/* Reset */}
            {editHistory.isDirty && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={editHistory.revertToOriginal}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <RotateCcw className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reset to original</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Save (if callback provided) */}
            {onSave && editHistory.isDirty && (
              <Button
                variant="default"
                size="sm"
                onClick={() => onSave(editHistory.currentContent!)}
                className="ml-2 gap-1"
              >
                <Save className="size-3.5" />
                Save
              </Button>
            )}
          </div>
        </div>

        {/* History indicator */}
        {editHistory.historyLength > 1 && (
          <p className="text-xs text-muted-foreground mt-2">
            Version {editHistory.currentIndex + 1} of {editHistory.historyLength}
            {editHistory.history[editHistory.currentIndex]?.isAIRefinement && (
              <span className="ml-2 text-primary">AI refined</span>
            )}
          </p>
        )}
      </CardHeader>

      <CardContent>
        <AnimatePresence mode="wait">
          <motion.div
            key={isPreviewMode ? "preview" : "edit"}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
          >
            {contentType === "call" ? (
              <CallScriptEditor
                content={editHistory.currentContent as EditableCallScript}
                onChange={handleChange}
                isPreviewMode={isPreviewMode}
              />
            ) : (
              <EmailDraftEditor
                content={editHistory.currentContent as EditableEmailDraft}
                onChange={handleChange}
                isPreviewMode={isPreviewMode}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
