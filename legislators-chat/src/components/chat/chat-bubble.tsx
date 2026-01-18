"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, Sparkles, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { MessageRole, MessageStatus } from "@/lib/types";

export interface ChatBubbleProps {
  role: MessageRole;
  content: string;
  timestamp: string;
  status?: MessageStatus;
  error?: string;
  className?: string;
  onRetry?: () => void;
}

const bubbleVariants = {
  initial: { opacity: 0, y: 10, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

const bubbleTransition = {
  duration: 0.25,
  ease: [0.22, 1, 0.36, 1] as const,
};

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function ChatBubble({
  role,
  content,
  timestamp,
  status,
  error,
  className,
  onRetry,
}: ChatBubbleProps) {
  const isUser = role === "user";
  const hasError = status === "error";

  return (
    <motion.div
      variants={bubbleVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={bubbleTransition}
      layout
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-colors",
          isUser
            ? "bg-accent text-accent-foreground"
            : "bg-gradient-to-br from-primary/10 to-primary/5 border border-border/50 text-primary dark:text-accent"
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <Sparkles className="h-4 w-4" />
        )}
      </div>

      {/* Bubble content */}
      <div
        className={cn(
          "flex max-w-[85%] md:max-w-[75%] flex-col gap-1.5",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Role label */}
        <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider px-1">
          {isUser ? "You" : "Assistant"}
        </span>

        {/* Message bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-3 text-[15px] leading-relaxed",
            isUser
              ? "rounded-tr-md bg-accent text-accent-foreground shadow-sm"
              : "rounded-tl-md bg-card border border-border/50 text-foreground shadow-sm",
            hasError && "border-2 border-destructive/50 bg-destructive/5"
          )}
        >
          {/* Message content with proper whitespace handling */}
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>

        {/* Metadata row: timestamp and status */}
        <div
          className={cn(
            "flex items-center gap-2 text-[11px] text-muted-foreground/60 px-1",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          {/* Timestamp */}
          <time dateTime={timestamp} className="tabular-nums">
            {formatTimestamp(timestamp)}
          </time>

          {/* Error indicator */}
          {hasError && (
            <span className="flex items-center gap-1 text-destructive font-medium">
              <AlertCircle className="h-3 w-3" />
              <span>Failed</span>
            </span>
          )}

          {/* Sending indicator */}
          {status === "sending" && (
            <span className="text-muted-foreground/50 flex items-center gap-1">
              <motion.span
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="inline-block w-1.5 h-1.5 rounded-full bg-accent"
              />
              Sending
            </span>
          )}
        </div>

        {/* Error message and retry button */}
        {hasError && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2 px-1"
          >
            {error && (
              <p className="text-xs text-destructive/80">{error}</p>
            )}
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-7 px-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 rounded-lg"
              >
                <RefreshCw className="mr-1.5 h-3 w-3" />
                Retry
              </Button>
            )}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
