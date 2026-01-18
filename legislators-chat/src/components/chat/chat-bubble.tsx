"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { AlertCircle, RefreshCw, User } from "lucide-react";
import ReactMarkdown, { Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { MessageRole, MessageStatus } from "@/lib/types";

const markdownComponents: Components = {
  p: ({ children }) => (
    <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
  ),
  strong: ({ children }) => (
    <strong className="font-semibold">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  a: ({ href, children }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-accent underline underline-offset-2 hover:text-accent/80 transition-colors"
    >
      {children}
    </a>
  ),
  ul: ({ children }) => (
    <ul className="mb-2 last:mb-0 ml-4 list-disc space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mb-2 last:mb-0 ml-4 list-decimal space-y-1">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 rounded bg-secondary/80 text-sm font-mono">
          {children}
        </code>
      );
    }
    return (
      <code className="block p-3 my-2 rounded-lg bg-secondary/80 text-sm font-mono overflow-x-auto">
        {children}
      </code>
    );
  },
  pre: ({ children }) => (
    <pre className="mb-2 last:mb-0 overflow-x-auto">{children}</pre>
  ),
  blockquote: ({ children }) => (
    <blockquote className="mb-2 last:mb-0 pl-3 border-l-2 border-accent/50 text-muted-foreground italic">
      {children}
    </blockquote>
  ),
  h1: ({ children }) => (
    <h1 className="text-lg font-semibold mb-2 mt-3 first:mt-0">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-base font-semibold mb-2 mt-3 first:mt-0">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold mb-1 mt-2 first:mt-0">{children}</h3>
  ),
  hr: () => <hr className="my-3 border-border" />,
};

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
  initial: { opacity: 0, y: 12, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
};

const bubbleTransition = {
  duration: 0.3,
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
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors overflow-hidden",
          isUser
            ? "bg-primary dark:bg-accent text-primary-foreground dark:text-accent-foreground"
            : "bg-white border border-border/50"
        )}
        aria-hidden="true"
      >
        {isUser ? (
          <User className="h-4 w-4" />
        ) : (
          <img
            src="/mindy_media_kit/logos/mindy_icon_color.png"
            alt="mindy"
            width={32}
            height={32}
            className="object-contain"
          />
        )}
      </div>

      {/* Bubble content */}
      <div
        className={cn(
          "flex max-w-[85%] md:max-w-[80%] flex-col gap-1",
          isUser ? "items-end" : "items-start"
        )}
      >
        {/* Role label */}
        <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider px-0.5">
          {isUser ? "You" : "mindy"}
        </span>

        {/* Message bubble */}
        <div
          className={cn(
            "rounded-xl px-4 py-3 text-[15px] leading-relaxed",
            isUser
              ? "rounded-tr-sm bg-primary dark:bg-accent text-primary-foreground dark:text-accent-foreground"
              : "rounded-tl-sm bg-card border border-border text-foreground card-shadow",
            hasError && "border-2 border-destructive/50 bg-destructive/5"
          )}
        >
          {/* Message content - markdown for assistant, plain text for user */}
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <div className="prose-chat break-words">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={markdownComponents}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>

        {/* Metadata row: timestamp and status */}
        <div
          className={cn(
            "flex items-center gap-2 text-[11px] text-muted-foreground/50 px-0.5 mt-0.5",
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
                animate={{ opacity: [0.4, 1, 0.4] }}
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
            className="flex items-center gap-2 px-0.5"
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
