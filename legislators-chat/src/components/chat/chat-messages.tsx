"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageSquare, ArrowDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
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

// How far from bottom (in pixels) to show the scroll button
const SCROLL_BUTTON_THRESHOLD = 100;

function EmptyState() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <MessageSquare className="h-8 w-8 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-medium text-foreground">Start a Conversation</h2>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Ask about legislators, congressional hearings, voting records, or any topic you&apos;d like
        to research.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {["Who represents my district?", "Recent climate votes", "Healthcare hearings"].map(
          (suggestion) => (
            <span
              key={suggestion}
              className="rounded-full border border-border bg-muted/50 px-3 py-1.5 text-xs text-muted-foreground"
            >
              {suggestion}
            </span>
          )
        )}
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
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  // Track if we should auto-scroll (true by default, false when user scrolls up)
  const shouldAutoScrollRef = React.useRef(true);
  // Track if scroll was triggered programmatically to ignore that scroll event
  const isProgrammaticScrollRef = React.useRef(false);
  // Track last message count to detect new messages
  const lastMessageCountRef = React.useRef(messages.length);

  // Get the actual scrollable viewport from ScrollArea
  const getScrollViewport = React.useCallback(() => {
    return scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
  }, []);

  // Check if user is near the bottom of the scroll area
  const isNearBottom = React.useCallback(() => {
    const viewport = getScrollViewport();
    if (!viewport) return true;

    const { scrollTop, scrollHeight, clientHeight } = viewport;
    return scrollHeight - scrollTop - clientHeight < SCROLL_BUTTON_THRESHOLD;
  }, [getScrollViewport]);

  // Scroll to bottom
  const scrollToBottom = React.useCallback(() => {
    const viewport = getScrollViewport();
    if (!viewport) return;

    isProgrammaticScrollRef.current = true;
    viewport.scrollTop = viewport.scrollHeight;
    setShowScrollButton(false);

    // Reset the flag after a short delay to allow the scroll event to fire
    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, [getScrollViewport]);

  // Handle user clicking scroll to bottom button
  const handleScrollToBottom = React.useCallback(() => {
    shouldAutoScrollRef.current = true;
    scrollToBottom();
  }, [scrollToBottom]);

  // Track scroll position to detect user scrolling away
  React.useEffect(() => {
    const viewport = getScrollViewport();
    if (!viewport) return;

    const handleScroll = () => {
      // Ignore programmatic scrolls
      if (isProgrammaticScrollRef.current) return;

      const nearBottom = isNearBottom();

      // If user scrolls up (away from bottom), disable auto-scroll
      if (!nearBottom) {
        shouldAutoScrollRef.current = false;
        setShowScrollButton(true);
      } else {
        // User scrolled back to bottom manually
        shouldAutoScrollRef.current = true;
        setShowScrollButton(false);
      }
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [getScrollViewport, isNearBottom]);

  // Auto-scroll when new user message is sent
  React.useEffect(() => {
    const isNewMessage = messages.length > lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (isNewMessage && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      // Always scroll for new user messages and re-enable auto-scroll
      if (lastMessage?.role === "user") {
        shouldAutoScrollRef.current = true;
        scrollToBottom();
      }
    }
  }, [messages.length, messages, scrollToBottom]);

  // Auto-scroll during streaming if auto-scroll is enabled
  React.useEffect(() => {
    if (shouldAutoScrollRef.current) {
      // Use RAF for smooth scroll during streaming
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages, isLoading, scrollToBottom]);

  // Show empty state if no messages
  if (messages.length === 0 && !isLoading) {
    return (
      <div className={cn("flex flex-1 flex-col", className)}>
        <EmptyState />
      </div>
    );
  }

  return (
    <div className={cn("relative flex-1 min-h-0", className)}>
      <ScrollArea ref={scrollAreaRef} className="h-full">
        <div className="flex flex-col p-4">
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

      {/* Scroll to bottom button - appears when user scrolls up */}
      <AnimatePresence>
        {showScrollButton && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10"
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={handleScrollToBottom}
              className="shadow-lg gap-1.5"
            >
              <ArrowDown className="h-4 w-4" />
              <span>Scroll to bottom</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
