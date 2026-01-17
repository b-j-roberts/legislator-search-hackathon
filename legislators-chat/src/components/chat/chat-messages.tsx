"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChatBubble } from "./chat-bubble";
import { TypingIndicator } from "./typing-indicator";
import type { ChatMessage } from "@/lib/types";

export interface ChatMessagesProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  className?: string;
  /** Callback to retry a failed message */
  onRetryMessage?: (messageId: string) => void;
}

const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-medium text-foreground">
        Start a Conversation
      </h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Ask about legislators, congressional hearings, voting records, or any
        topic you&apos;d like to research.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {[
          "Who represents my district?",
          "Recent climate votes",
          "Healthcare hearings",
        ].map((suggestion) => (
          <span
            key={suggestion}
            className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground"
          >
            {suggestion}
          </span>
        ))}
      </div>
    </div>
  );
}

export function ChatMessages({
  messages,
  isLoading = false,
  className,
  onRetryMessage,
}: ChatMessagesProps) {
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or loading state changes
  React.useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Show empty state if no messages
  if (messages.length === 0 && !isLoading) {
    return (
      <div className={cn("flex flex-1 flex-col", className)}>
        <EmptyState />
      </div>
    );
  }

  return (
    <ScrollArea className={cn("flex-1 min-h-0", className)}>
      <div ref={scrollRef} className="flex flex-col p-4">
        <motion.div
          variants={containerVariants}
          initial="initial"
          animate="animate"
          className="flex flex-col gap-4"
        >
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <ChatBubble
                key={message.id}
                role={message.role}
                content={message.content}
                timestamp={message.timestamp}
                status={message.status}
                error={message.error}
                onRetry={
                  message.status === "error" && onRetryMessage
                    ? () => onRetryMessage(message.id)
                    : undefined
                }
              />
            ))}
          </AnimatePresence>

          {/* Typing indicator when loading */}
          <AnimatePresence>
            {isLoading && <TypingIndicator key="typing-indicator" />}
          </AnimatePresence>
        </motion.div>

        {/* Invisible element for scroll anchor */}
        <div ref={bottomRef} className="h-px" aria-hidden="true" />
      </div>
    </ScrollArea>
  );
}
