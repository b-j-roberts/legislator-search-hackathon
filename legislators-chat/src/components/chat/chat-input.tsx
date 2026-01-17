"use client";

import * as React from "react";
import { Send, Mic, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_MAX_CHARS = 4000;
const MIN_ROWS = 1;
const MAX_ROWS = 8;

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  maxChars?: number;
}

export function ChatInput({
  onSend,
  disabled = false,
  isLoading = false,
  placeholder = "Ask about legislators, hearings, or voting records...",
  maxChars = DEFAULT_MAX_CHARS,
}: ChatInputProps) {
  const [value, setValue] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const charCount = value.length;
  const isOverLimit = charCount > maxChars;
  const canSend = value.trim().length > 0 && !isOverLimit && !disabled && !isLoading;
  const isDisabled = disabled || isLoading;

  // Auto-resize textarea
  const adjustHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to calculate proper scrollHeight
    textarea.style.height = "auto";

    // Calculate line height and constrain rows
    const computedStyle = window.getComputedStyle(textarea);
    const lineHeight = parseInt(computedStyle.lineHeight) || 24;
    const paddingTop = parseInt(computedStyle.paddingTop) || 0;
    const paddingBottom = parseInt(computedStyle.paddingBottom) || 0;

    const minHeight = lineHeight * MIN_ROWS + paddingTop + paddingBottom;
    const maxHeight = lineHeight * MAX_ROWS + paddingTop + paddingBottom;

    const newHeight = Math.min(Math.max(textarea.scrollHeight, minHeight), maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, []);

  React.useEffect(() => {
    adjustHeight();
  }, [value, adjustHeight]);

  // Focus textarea on mount
  React.useEffect(() => {
    if (!isDisabled) {
      textareaRef.current?.focus();
    }
  }, [isDisabled]);

  const handleSend = React.useCallback(() => {
    if (!canSend) return;

    onSend(value.trim());
    setValue("");

    // Reset height after clearing
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, value, onSend]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Enter to send (without shift)
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
      // Shift+Enter allows newline (default behavior)
    },
    [handleSend]
  );

  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
    },
    []
  );

  return (
    <div className="border-t border-border bg-background p-4">
      <div className="flex items-end gap-3">
        {/* Voice input placeholder button */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          disabled
          className="shrink-0 text-muted-foreground"
          aria-label="Voice input (coming soon)"
        >
          <Mic className="h-5 w-5" />
        </Button>

        {/* Textarea container */}
        <div className="relative flex-1">
          <Textarea
            ref={textareaRef}
            value={value}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={isDisabled}
            rows={MIN_ROWS}
            className={cn(
              "min-h-[44px] resize-none pr-4 text-base leading-6",
              isOverLimit && "border-destructive focus-visible:border-destructive focus-visible:ring-destructive/50"
            )}
            aria-label="Chat message input"
            aria-describedby="char-count"
          />

          {/* Character count indicator */}
          <div
            id="char-count"
            className={cn(
              "absolute bottom-2 right-3 text-xs tabular-nums",
              isOverLimit ? "text-destructive" : "text-muted-foreground"
            )}
            aria-live="polite"
          >
            {charCount > maxChars * 0.8 && (
              <span>
                {charCount.toLocaleString()}/{maxChars.toLocaleString()}
              </span>
            )}
          </div>
        </div>

        {/* Send button */}
        <Button
          type="button"
          size="icon"
          onClick={handleSend}
          disabled={!canSend}
          className="shrink-0"
          aria-label={isLoading ? "Sending message..." : "Send message"}
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* Helper text */}
      <p className="mt-2 text-xs text-muted-foreground">
        Press <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Enter</kbd> to send, <kbd className="rounded border border-border bg-muted px-1 py-0.5 font-mono text-[10px]">Shift+Enter</kbd> for new line
      </p>
    </div>
  );
}
