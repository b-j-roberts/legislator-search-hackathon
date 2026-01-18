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
  Download,
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
} from "@/lib/types";
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

// =============================================================================
// Types
// =============================================================================

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
  /** Called when content is saved/finalized */
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
  onSave,
}: ContentEditorWithChatProps) {
  const editorRef = React.useRef<ContentEditorHandle | null>(null);
  const [isChatCollapsed, setIsChatCollapsed] = React.useState(false);
  const [isDiffVisible, setIsDiffVisible] = React.useState(false);
  const [showHistory, setShowHistory] = React.useState(false);

  // Track current editable content for diff and chat
  const [currentEditableContent, setCurrentEditableContent] = React.useState<
    EditableCallScript | EditableEmailDraft
  >(() => {
    if (contentType === "call") {
      return callScriptToEditable(originalContent as CallScript);
    }
    return emailDraftToEditable(originalContent as EmailDraft, selectedSubjectIndex);
  });

  // Original content for comparison
  const originalEditable = React.useMemo(() => {
    if (contentType === "call") {
      return callScriptToEditable(originalContent as CallScript);
    }
    return emailDraftToEditable(originalContent as EmailDraft, selectedSubjectIndex);
  }, [originalContent, contentType, selectedSubjectIndex]);

  // Handle content changes from editor
  const handleContentChange = React.useCallback(
    (content: EditableCallScript | EditableEmailDraft, isDirty: boolean) => {
      setCurrentEditableContent(content);
      // Show diff when content has been modified
      if (isDirty && !isDiffVisible) {
        setIsDiffVisible(true);
      }
    },
    [isDiffVisible]
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
          {editorRef.current?.isDirty && (
            <Badge variant="secondary" className="text-xs">
              Unsaved changes
            </Badge>
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
            selectedSubjectIndex={selectedSubjectIndex}
            onContentChange={handleContentChange}
            onSave={onSave}
            editorRef={editorRef}
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
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
