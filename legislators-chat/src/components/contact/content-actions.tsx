"use client";

import * as React from "react";
import {
  Copy,
  Download,
  FileText,
  Mail,
  CheckCircle2,
  Save,
  ExternalLink,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { CallScript, EmailDraft, Legislator } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

interface ContentActionsProps {
  /** Type of content being acted upon */
  contentType: "call" | "email";
  /** The legislator this content is for */
  legislator: Legislator;
  /** Call script content (when contentType is 'call') */
  callScript?: CallScript | null;
  /** Email draft content (when contentType is 'email') */
  emailDraft?: EmailDraft | null;
  /** Selected subject line index for emails */
  selectedSubjectIndex?: number;
  /** Callback when draft is saved */
  onSaveDraft?: () => void;
  /** Whether there are unsaved changes */
  hasUnsavedChanges?: boolean;
  /** Whether in compact mode (icons only) */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Build full text representation of a call script
 */
function buildCallScriptText(script: CallScript, legislator: Legislator): string {
  const title = legislator.chamber === "Senate" ? "Senator" : "Rep.";
  const lines = [
    `CALL SCRIPT FOR ${title.toUpperCase()} ${legislator.name.toUpperCase()}`,
    `${legislator.party === "D" ? "Democrat" : legislator.party === "R" ? "Republican" : "Independent"} - ${legislator.state}${legislator.district ? `-${legislator.district}` : ""}`,
    "",
    "═══════════════════════════════════════════════════",
    "",
    "INTRODUCTION:",
    "─────────────",
    script.introduction,
    "",
    "KEY TALKING POINTS:",
    "───────────────────",
    ...script.talkingPoints.map((point, i) => `${i + 1}. ${point}`),
    "",
  ];

  if (script.anticipatedResponses.length > 0) {
    lines.push("IF THEY ASK...");
    lines.push("──────────────");
    script.anticipatedResponses.forEach((ar) => {
      lines.push(`Q: ${ar.question}`);
      lines.push(`A: ${ar.response}`);
      lines.push("");
    });
  }

  lines.push("CLOSING:");
  lines.push("────────");
  lines.push(script.closing);
  lines.push("");
  lines.push("═══════════════════════════════════════════════════");
  lines.push(`Estimated Duration: ~${Math.ceil(script.estimatedDuration / 60)} minute(s)`);
  lines.push(`Generated: ${new Date().toLocaleDateString()}`);

  return lines.join("\n");
}

/**
 * Build full text representation of an email draft
 */
function buildEmailText(draft: EmailDraft, selectedSubjectIndex: number = 0): string {
  const lines = [
    `Subject: ${draft.subjectLines[selectedSubjectIndex]}`,
    "",
    draft.salutation,
    "",
    draft.opening,
    "",
    ...draft.body.map((p) => `${p}\n`),
  ];

  if (draft.citations && draft.citations.length > 0) {
    lines.push("References:");
    draft.citations.forEach((c) => {
      lines.push(`- ${c.text} (${c.source}${c.url ? `: ${c.url}` : ""})`);
    });
    lines.push("");
  }

  lines.push(draft.closing);
  lines.push("");
  lines.push(draft.signature.replace(/\\n/g, "\n"));

  return lines.join("\n");
}

/**
 * Generate a simple PDF from text content using browser print
 * Uses a printable HTML page that triggers print dialog
 */
function downloadAsPdf(content: string, filename: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    alert("Please allow popups to download the PDF");
    return;
  }

  const styles = `
    <style>
      @page { margin: 1in; }
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 12pt;
        line-height: 1.6;
        color: #1a1a1a;
        max-width: 7.5in;
        margin: 0 auto;
      }
      pre {
        white-space: pre-wrap;
        word-wrap: break-word;
        font-family: inherit;
        margin: 0;
      }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style>
  `;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>${filename}</title>
        ${styles}
      </head>
      <body>
        <pre>${content.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() { window.close(); }
          }
        </script>
      </body>
    </html>
  `);
  printWindow.document.close();
}

/**
 * Download content as a text file
 */
function downloadAsText(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Build mailto link for email
 */
function buildMailtoLink(
  draft: EmailDraft,
  email: string,
  selectedSubjectIndex: number = 0
): string {
  const subject = encodeURIComponent(draft.subjectLines[selectedSubjectIndex]);
  const bodyText = [
    draft.salutation,
    "",
    draft.opening,
    "",
    ...draft.body,
    "",
    draft.closing,
    "",
    draft.signature.replace(/\\n/g, "\n"),
  ].join("\n");
  const body = encodeURIComponent(bodyText);

  // mailto links have ~2000 char limit in some clients
  // If too long, just include subject
  const fullLink = `mailto:${email}?subject=${subject}&body=${body}`;
  if (fullLink.length > 2000) {
    return `mailto:${email}?subject=${subject}`;
  }
  return fullLink;
}

// =============================================================================
// Component
// =============================================================================

export function ContentActions({
  contentType,
  legislator,
  callScript,
  emailDraft,
  selectedSubjectIndex = 0,
  onSaveDraft,
  hasUnsavedChanges,
  compact = false,
  className,
}: ContentActionsProps) {
  const [copiedState, setCopiedState] = React.useState<"idle" | "copied">("idle");

  const hasContent = contentType === "call" ? !!callScript : !!emailDraft;

  // Build content text
  const contentText = React.useMemo(() => {
    if (contentType === "call" && callScript) {
      return buildCallScriptText(callScript, legislator);
    }
    if (contentType === "email" && emailDraft) {
      return buildEmailText(emailDraft, selectedSubjectIndex);
    }
    return "";
  }, [contentType, callScript, emailDraft, legislator, selectedSubjectIndex]);

  // Build filename
  const filename = React.useMemo(() => {
    const sanitizedName = legislator.name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
    const date = new Date().toISOString().split("T")[0];
    if (contentType === "call") {
      return `call_script_${sanitizedName}_${date}`;
    }
    return `email_draft_${sanitizedName}_${date}`;
  }, [contentType, legislator.name]);

  // Handlers
  const handleCopy = async () => {
    if (!contentText) return;
    try {
      await navigator.clipboard.writeText(contentText);
      setCopiedState("copied");
      setTimeout(() => setCopiedState("idle"), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleDownloadPdf = () => {
    if (!contentText) return;
    downloadAsPdf(contentText, `${filename}.pdf`);
  };

  const handleDownloadTxt = () => {
    if (!contentText) return;
    downloadAsText(contentText, `${filename}.txt`);
  };

  const mailtoLink = React.useMemo(() => {
    if (contentType !== "email" || !emailDraft || !legislator.contact.email) {
      return null;
    }
    return buildMailtoLink(emailDraft, legislator.contact.email, selectedSubjectIndex);
  }, [contentType, emailDraft, legislator.contact.email, selectedSubjectIndex]);

  if (!hasContent) return null;

  const ActionButton = ({
    icon: Icon,
    label,
    onClick,
    href,
    variant = "outline",
    disabled = false,
    success = false,
  }: {
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
    href?: string;
    variant?: "outline" | "default" | "ghost";
    disabled?: boolean;
    success?: boolean;
  }) => {
    const buttonContent = (
      <>
        <Icon className={cn("size-4", success && "text-green-500")} />
        {!compact && <span className="ml-1.5">{label}</span>}
      </>
    );

    if (href) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant={variant} size={compact ? "icon-sm" : "sm"} asChild>
                <a href={href} target="_blank" rel="noopener noreferrer">
                  {buttonContent}
                </a>
              </Button>
            </TooltipTrigger>
            {compact && <TooltipContent>{label}</TooltipContent>}
          </Tooltip>
        </TooltipProvider>
      );
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={variant}
              size={compact ? "icon-sm" : "sm"}
              onClick={onClick}
              disabled={disabled}
            >
              {buttonContent}
            </Button>
          </TooltipTrigger>
          {compact && <TooltipContent>{label}</TooltipContent>}
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {/* Copy to Clipboard */}
      <ActionButton
        icon={copiedState === "copied" ? CheckCircle2 : Copy}
        label={copiedState === "copied" ? "Copied!" : "Copy"}
        onClick={handleCopy}
        success={copiedState === "copied"}
      />

      {/* Download as PDF (Call scripts) */}
      {contentType === "call" && (
        <ActionButton
          icon={FileText}
          label="Download PDF"
          onClick={handleDownloadPdf}
        />
      )}

      {/* Download as TXT */}
      <ActionButton
        icon={Download}
        label={contentType === "call" ? "Download TXT" : "Download"}
        onClick={handleDownloadTxt}
      />

      {/* Open in Email Client (Email only) */}
      {contentType === "email" && mailtoLink && (
        <ActionButton
          icon={ExternalLink}
          label="Open in Email"
          href={mailtoLink}
          variant="default"
        />
      )}

      {/* Save Draft */}
      {onSaveDraft && (
        <ActionButton
          icon={Save}
          label={hasUnsavedChanges ? "Save Draft" : "Saved"}
          onClick={onSaveDraft}
          disabled={!hasUnsavedChanges}
          variant={hasUnsavedChanges ? "default" : "ghost"}
        />
      )}
    </div>
  );
}
