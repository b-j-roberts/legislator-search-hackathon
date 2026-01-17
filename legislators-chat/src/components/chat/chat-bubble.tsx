"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Bot, User, AlertCircle, RefreshCw } from "lucide-react";
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
  /** Callback for retrying failed messages */
  onRetry?: () => void;
}

const bubbleVariants = {
  initial: { opacity: 0, y: 10, scale: 0.95 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
};

const bubbleTransition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1] as const,
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
      className={cn(
        "flex gap-3",
        isUser ? "flex-row-reverse" : "flex-row",
        className
      )}
    >
      {/* Avatar */}
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground"
        )}
        aria-hidden="true"
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble content */}
      <div
        className={cn(
          "flex max-w-[80%] flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Message bubble */}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-base leading-relaxed",
            isUser
              ? "rounded-br-sm bg-primary text-primary-foreground"
              : "rounded-bl-sm bg-muted text-foreground",
            hasError && "border border-destructive"
          )}
        >
          {/* Message content with proper whitespace handling */}
          <p className="whitespace-pre-wrap break-words">{content}</p>
        </div>

        {/* Metadata row: timestamp and status */}
        <div
          className={cn(
            "flex items-center gap-2 text-xs text-muted-foreground",
            isUser ? "flex-row-reverse" : "flex-row"
          )}
        >
          {/* Timestamp */}
          <time dateTime={timestamp} className="tabular-nums">
            {formatTimestamp(timestamp)}
          </time>

          {/* Error indicator */}
          {hasError && (
            <span className="flex items-center gap-1 text-destructive">
              <AlertCircle className="h-3 w-3" />
              <span>Failed to send</span>
            </span>
          )}

          {/* Sending indicator */}
          {status === "sending" && (
            <span className="text-muted-foreground">Sending...</span>
          )}
        </div>

        {/* Error message and retry button if present */}
        {hasError && (
          <div className="mt-1 flex items-center gap-2">
            {error && <p className="text-xs text-destructive">{error}</p>}
            {onRetry && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onRetry}
                className="h-6 px-2 text-xs text-destructive hover:text-destructive"
              >
                <RefreshCw className="mr-1 h-3 w-3" />
                Retry
              </Button>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}
