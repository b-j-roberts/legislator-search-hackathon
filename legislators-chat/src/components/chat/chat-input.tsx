"use client";

import * as React from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

const DEFAULT_MAX_CHARS = 4000;
const MIN_ROWS = 1;
const MAX_ROWS = 6;

export interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  isLoading?: boolean;
  placeholder?: string;
  maxChars?: number;
  initialValue?: string;
}

export function ChatInput({
  onSend,
  disabled = false,
  isLoading = false,
  placeholder = "Ask about legislators, hearings, or voting records...",
  maxChars = DEFAULT_MAX_CHARS,
  initialValue = "",
}: ChatInputProps) {
  const [value, setValue] = React.useState(initialValue);
  const [isFocused, setIsFocused] = React.useState(false);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Update value when initialValue changes (for suggestions)
  React.useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
      // Auto-send after a brief delay when suggestion is clicked
      const timer = setTimeout(() => {
        if (initialValue.trim()) {
          onSend(initialValue.trim());
          setValue("");
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [initialValue, onSend]);

  const charCount = value.length;
  const isOverLimit = charCount > maxChars;
  const canSend = value.trim().length > 0 && !isOverLimit && !disabled && !isLoading;
  const isDisabled = disabled || isLoading;

  const adjustHeight = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";

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

  React.useEffect(() => {
    if (!isDisabled) {
      textareaRef.current?.focus();
    }
  }, [isDisabled]);

  const handleSend = React.useCallback(() => {
    if (!canSend) return;

    onSend(value.trim());
    setValue("");

    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [canSend, value, onSend]);

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  const handleChange = React.useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
  }, []);

  return (
    <div className="relative px-4 md:px-6 pb-4 md:pb-6 pt-4">
      {/* Floating input container with glass effect */}
      <motion.div
        initial={false}
        animate={{
          boxShadow: isFocused
            ? "0 -4px 30px -5px rgba(232, 169, 69, 0.15), 0 4px 20px -5px rgba(0, 0, 0, 0.1)"
            : "0 2px 20px -5px rgba(0, 0, 0, 0.1)",
        }}
        className={cn(
          "relative rounded-2xl border transition-all duration-300 max-w-4xl mx-auto",
          "bg-card/80 backdrop-blur-xl",
          isFocused
            ? "border-accent/30 ring-1 ring-accent/20"
            : "border-border/50 hover:border-border"
        )}
      >
        {/* AI indicator - inside the container */}
        <div className="flex items-center gap-1.5 px-4 pt-3 pb-1">
          <Sparkles className="w-3 h-3 text-accent" />
          <span className="text-[10px] font-medium text-accent uppercase tracking-wide">AI-Powered</span>
        </div>

        <div className="flex items-end gap-2 px-3 pb-3 md:px-4 md:pb-4">
          {/* Textarea container */}
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={value}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder={placeholder}
              disabled={isDisabled}
              rows={MIN_ROWS}
              className={cn(
                "min-h-[48px] resize-none border-0 bg-transparent px-0 py-2",
                "text-base leading-6 placeholder:text-muted-foreground/60",
                "focus-visible:ring-0 focus-visible:ring-offset-0",
                isOverLimit && "text-destructive"
              )}
              aria-label="Chat message input"
              aria-describedby="char-count"
            />

            {/* Character count indicator */}
            {charCount > maxChars * 0.8 && (
              <div
                id="char-count"
                className={cn(
                  "absolute -bottom-1 right-0 text-[10px] tabular-nums",
                  isOverLimit ? "text-destructive" : "text-muted-foreground/60"
                )}
                aria-live="polite"
              >
                {charCount.toLocaleString()}/{maxChars.toLocaleString()}
              </div>
            )}
          </div>

          {/* Send button */}
          <motion.div
            initial={false}
            animate={{
              scale: canSend ? 1 : 0.9,
              opacity: canSend ? 1 : 0.5,
            }}
            transition={{ duration: 0.15 }}
          >
            <Button
              type="button"
              size="icon"
              onClick={handleSend}
              disabled={!canSend}
              className={cn(
                "shrink-0 h-11 w-11 rounded-xl transition-all duration-200 touch-manipulation",
                canSend
                  ? "bg-accent text-accent-foreground hover:bg-accent/90 shadow-md shadow-accent/20"
                  : "bg-muted text-muted-foreground"
              )}
              aria-label={isLoading ? "Sending message..." : "Send message"}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </motion.div>
        </div>

        {/* Helper text inside the container */}
        <div className="hidden sm:flex items-center justify-between px-4 pb-3 text-[11px] text-muted-foreground/50">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">
                Enter
              </kbd>{" "}
              to send
            </span>
            <span>
              <kbd className="rounded bg-muted/50 px-1.5 py-0.5 font-mono text-[10px]">
                Shift+Enter
              </kbd>{" "}
              new line
            </span>
          </div>
          <span className="text-muted-foreground/40">Powered by Maple AI</span>
        </div>
      </motion.div>
    </div>
  );
}
