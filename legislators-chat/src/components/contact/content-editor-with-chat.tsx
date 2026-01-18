"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PanelLeftClose,
  PanelLeftOpen,
  Copy,
  CheckCircle2,
  Mail,
  Phone,
  History,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type {
  CallScript,
  EmailDraft,
  EditableCallScript,
  EditableEmailDraft,
  Legislator,
  AdvocacyContext,
  RefinementMessage,
} from "@/lib/types";
import type { SavedDraft } from "@/lib/queue-storage";
import {
  ContentEditor,
  ContentEditorHandle,
  callScriptToEditable,
  emailDraftToEditable,
  editableCallScriptToText,
  editableEmailDraftToText,
} from "./content-editor";
import { RefinementChat } from "./refinement-chat";
import { DiffViewer } from "./diff-viewer";
import { DraftSavedIndicator } from "./draft-saved-indicator";
import { useAutoSave } from "@/hooks/use-auto-save";
import { useBeforeUnload } from "@/hooks/use-before-unload";

// =============================================================================
// Types
// =============================================================================

/** Data structure for auto-save */
interface DraftData {
  editedContent: EditableCallScript | EditableEmailDraft;
  chatHistory: RefinementMessage[];
  selectedSubjectIndex: number;
}

interface ContentEditorWithChatProps {
  /** Type of content being edited */
  contentType: "call" | "email";
  /** Original generated content */
  originalContent: CallScript | EmailDraft;
  /** Selected subject index for emails */
  selectedSubjectIndex?: number;
  /** Legislator context */
  legislator: Legislator;
  /** Advocacy context */
  advocacyContext: AdvocacyContext | null;
  /** Class name for the container */
  className?: string;
  /** Previously saved draft to restore */
  savedDraft?: SavedDraft;
  /** Called when content is saved (debounced auto-save) */
  onDraftSave?: (draft: Omit<SavedDraft, "savedAt">) => void;
  /** Called when content is finalized (manual save) */
  onSave?: (content: EditableCallScript | EditableEmailDraft) => void;
}

// =============================================================================
// Copy Button Component
// =============================================================================

function CopyButton({
  text,
  className,
  label = "Copy to clipboard",
}: {
  text: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopy}
            className={cn("gap-1.5", className)}
          >
            {copied ? (
              <>
                <CheckCircle2 className="size-3.5 text-green-500" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="size-3.5" />
                Copy
              </>
            )}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ContentEditorWithChat({
  contentType,
  originalContent,
  selectedSubjectIndex = 0,
  legislator,
  advocacyContext,
  className,
  savedDraft,
  onDraftSave,
  onSave,
}: ContentEditorWithChatProps) {
  const editorRef = React.useRef<ContentEditorHandle | null>(null);
  const [isChatCollapsed, setIsChatCollapsed] = React.useState(false);
  const [isDiffVisible, setIsDiffVisible] = React.useState(false);

  // Initialize from saved draft or original content
  const initialEditableContent = React.useMemo(() => {
    // Check if we have edited content in the saved draft
    if (savedDraft) {
      if (contentType === "call" && savedDraft.editedCallScript) {
        return savedDraft.editedCallScript;
      }
      if (contentType === "email" && savedDraft.editedEmailDraft) {
        return savedDraft.editedEmailDraft;
      }
    }
    // Fall back to converting original content
    if (contentType === "call") {
      return callScriptToEditable(originalContent as CallScript);
    }
    return emailDraftToEditable(
      originalContent as EmailDraft,
      savedDraft?.selectedSubjectIndex ?? selectedSubjectIndex
    );
  }, [contentType, originalContent, savedDraft, selectedSubjectIndex]);

  // Initialize chat history from saved draft
  const initialChatHistory = React.useMemo(
    () => savedDraft?.refinementChatHistory ?? [],
    [savedDraft]
  );

  // Track current editable content for diff and chat
  const [currentEditableContent, setCurrentEditableContent] = React.useState<
    EditableCallScript | EditableEmailDraft
  >(initialEditableContent);

  // Track chat history for persistence
  const [chatHistory, setChatHistory] = React.useState<RefinementMessage[]>(
    initialChatHistory
  );

  // Track subject index for emails
  const [currentSubjectIndex, setCurrentSubjectIndex] = React.useState(
    savedDraft?.selectedSubjectIndex ?? selectedSubjectIndex
  );

  // Original content for comparison
  const originalEditable = React.useMemo(() => {
    if (contentType === "call") {
      return callScriptToEditable(originalContent as CallScript);
    }
    return emailDraftToEditable(originalContent as EmailDraft, selectedSubjectIndex);
  }, [originalContent, contentType, selectedSubjectIndex]);

  // Combined data for auto-save
  const draftData: DraftData = React.useMemo(
    () => ({
      editedContent: currentEditableContent,
      chatHistory,
      selectedSubjectIndex: currentSubjectIndex,
    }),
    [currentEditableContent, chatHistory, currentSubjectIndex]
  );

  // Handle auto-save
  const handleDraftSave = React.useCallback(
    (data: DraftData) => {
      if (!onDraftSave) return;

      const draft: Omit<SavedDraft, "savedAt"> = {
        contentType,
        callScript: contentType === "call" ? (originalContent as CallScript) : undefined,
        emailDraft: contentType === "email" ? (originalContent as EmailDraft) : undefined,
        editedCallScript:
          contentType === "call" ? (data.editedContent as EditableCallScript) : undefined,
        editedEmailDraft:
          contentType === "email" ? (data.editedContent as EditableEmailDraft) : undefined,
        selectedSubjectIndex: data.selectedSubjectIndex,
        refinementChatHistory: data.chatHistory,
        advocacyContext: advocacyContext ?? undefined,
      };

      onDraftSave(draft);
    },
    [onDraftSave, contentType, originalContent, advocacyContext]
  );

  // Auto-save hook with 2.5 second debounce
  const { isDirty, isSaving, lastSavedAt, saveNow } = useAutoSave({
    data: draftData,
    onSave: handleDraftSave,
    delay: 2500,
    enabled: !!onDraftSave,
  });

  // Warn before leaving with unsaved changes
  useBeforeUnload(isDirty, "You have unsaved changes to your draft. Are you sure you want to leave?");

  // Handle content changes from editor
  const handleContentChange = React.useCallback(
    (content: EditableCallScript | EditableEmailDraft, editorIsDirty: boolean) => {
      setCurrentEditableContent(content);
      // Show diff when content has been modified
      if (editorIsDirty && !isDiffVisible) {
        setIsDiffVisible(true);
      }
    },
    [isDiffVisible]
  );

  // Handle chat history changes
  const handleChatHistoryChange = React.useCallback(
    (messages: RefinementMessage[]) => {
      setChatHistory(messages);
    },
    []
  );

  // Handle refinement from AI chat
  const handleRefinementComplete = React.useCallback(
    (content: EditableCallScript | EditableEmailDraft, changeSummary: string) => {
      if (editorRef.current) {
        editorRef.current.applyRefinement(content, changeSummary);
        setCurrentEditableContent(content);
      }
    },
    []
  );

  // Get full text for copying
  const fullText = React.useMemo(() => {
    if (contentType === "call") {
      return editableCallScriptToText(currentEditableContent as EditableCallScript);
    }
    return editableEmailDraftToText(currentEditableContent as EditableEmailDraft);
  }, [currentEditableContent, contentType]);

  // Build mailto link for email
  const mailtoLink = React.useMemo(() => {
    if (contentType !== "email" || !legislator.contact.email) return "";

    const emailContent = currentEditableContent as EditableEmailDraft;
    const subject = encodeURIComponent(emailContent.subjectLine);
    const bodyText = [
      emailContent.salutation,
      "",
      emailContent.opening,
      "",
      ...emailContent.body,
      "",
      emailContent.closing,
      "",
      emailContent.signature.replace(/\\n/g, "\n"),
    ].join("\n");
    const body = encodeURIComponent(bodyText);

    return `mailto:${legislator.contact.email}?subject=${subject}&body=${body}`;
  }, [currentEditableContent, contentType, legislator.contact.email]);

  // Original text for diff comparison
  const originalText = React.useMemo(() => {
    if (contentType === "call") {
      return editableCallScriptToText(originalEditable as EditableCallScript);
    }
    return editableEmailDraftToText(originalEditable as EditableEmailDraft);
  }, [originalEditable, contentType]);

  // Check if content has changed from original
  const hasChanges = fullText !== originalText || chatHistory.length > 0;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header Actions */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          {contentType === "call" ? (
            <Badge variant="outline" className="gap-1">
              <Phone className="size-3" />
              Call Script
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1">
              <Mail className="size-3" />
              Email Draft
            </Badge>
          )}
          {/* Draft saved indicator */}
          {onDraftSave && (
            <DraftSavedIndicator
              isDirty={isDirty}
              isSaving={isSaving}
              lastSavedAt={lastSavedAt}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <CopyButton text={fullText} />

          {contentType === "email" && mailtoLink && (
            <Button variant="outline" size="sm" asChild className="gap-1.5">
              <a href={mailtoLink}>
                <Mail className="size-3.5" />
                Open in Email
              </a>
            </Button>
          )}

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={isDiffVisible ? "secondary" : "ghost"}
                  size="icon-sm"
                  onClick={() => setIsDiffVisible(!isDiffVisible)}
                  disabled={!hasChanges}
                >
                  <History className="size-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isDiffVisible ? "Hide changes" : "Show changes"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setIsChatCollapsed(!isChatCollapsed)}
                  className="lg:hidden"
                >
                  {isChatCollapsed ? (
                    <PanelLeftOpen className="size-3.5" />
                  ) : (
                    <PanelLeftClose className="size-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                {isChatCollapsed ? "Show AI refinement" : "Hide AI refinement"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      {/* Diff Viewer */}
      <AnimatePresence>
        {isDiffVisible && fullText !== originalText && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
          >
            <DiffViewer
              original={originalText}
              modified={fullText}
              title="Changes from original"
              isVisible={true}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Layout - Side by Side on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor Panel */}
        <div className="space-y-4">
          <ContentEditor
            contentType={contentType}
            initialContent={originalContent}
            selectedSubjectIndex={currentSubjectIndex}
            onContentChange={handleContentChange}
            onSave={onSave}
            editorRef={editorRef}
            initialEditedContent={
              savedDraft
                ? contentType === "call"
                  ? savedDraft.editedCallScript
                  : savedDraft.editedEmailDraft
                : undefined
            }
          />
        </div>

        {/* Refinement Chat Panel */}
        <div className={cn("lg:block", isChatCollapsed && "hidden")}>
          <RefinementChat
            currentContent={currentEditableContent}
            contentType={contentType}
            legislator={legislator}
            advocacyContext={advocacyContext}
            onRefinementComplete={handleRefinementComplete}
            isCollapsed={false}
            initialMessages={initialChatHistory}
            onMessagesChange={handleChatHistoryChange}
          />
        </div>
      </div>

      {/* Mobile Collapsed Chat Toggle */}
      <AnimatePresence>
        {isChatCollapsed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="lg:hidden"
          >
            <Button
              variant="outline"
              onClick={() => setIsChatCollapsed(false)}
              className="w-full gap-2"
            >
              <PanelLeftOpen className="size-4" />
              Show AI Refinement Chat
              {chatHistory.length > 0 && (
                <Badge variant="secondary" className="ml-1">
                  {chatHistory.length}
                </Badge>
              )}
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
