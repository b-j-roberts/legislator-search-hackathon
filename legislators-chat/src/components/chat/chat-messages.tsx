"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowDown, Search, Users, FileText, Vote, ArrowRight } from "lucide-react";
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
  onRetryMessage?: (messageId: string) => void;
  onSuggestionClick?: (suggestion: string) => void;
}

const containerVariants = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const SCROLL_BUTTON_THRESHOLD = 100;

const SUGGESTIONS = [
  {
    icon: Users,
    title: "Find your representatives",
    query: "Who represents my district in Congress?",
  },
  {
    icon: Vote,
    title: "Track voting records",
    query: "Show me recent climate change votes",
  },
  {
    icon: FileText,
    title: "Research hearings",
    query: "Find healthcare committee hearings from this year",
  },
];

function HeroEmptyState({ onSuggestionClick }: { onSuggestionClick?: (query: string) => void }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
      </div>

      {/* Hero content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-2xl"
      >
        {/* Icon badge */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-8 inline-flex"
        >
          <div className="relative">
            <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20">
              <Search className="w-7 h-7 text-accent" />
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-accent flex items-center justify-center">
              <span className="text-accent-foreground text-xs font-bold">AI</span>
            </div>
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.6 }}
          className="font-display text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-balance leading-[1.1] mb-4"
        >
          Research your{" "}
          <span className="text-accent">representatives</span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-muted-foreground text-base md:text-lg max-w-md mx-auto mb-10 text-balance"
        >
          Ask about legislators, voting records, committee hearings, and policy positions. Get informed, then take action.
        </motion.p>

        {/* Suggestion cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="grid gap-3 sm:grid-cols-3 w-full max-w-xl mx-auto"
        >
          {SUGGESTIONS.map((suggestion, index) => (
            <motion.button
              key={suggestion.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + index * 0.1, duration: 0.5 }}
              whileHover={{ y: -2, transition: { duration: 0.2 } }}
              whileTap={{ scale: 0.98 }}
              onClick={() => onSuggestionClick?.(suggestion.query)}
              className="group relative flex flex-col items-start p-4 rounded-xl border border-border/50 bg-card/50 hover:bg-card hover:border-accent/30 hover:shadow-lg transition-all duration-300 text-left"
            >
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-muted/50 group-hover:bg-accent/10 transition-colors mb-3">
                <suggestion.icon className="w-4 h-4 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <span className="text-sm font-medium text-foreground group-hover:text-accent transition-colors">
                {suggestion.title}
              </span>
              <ArrowRight className="absolute bottom-4 right-4 w-4 h-4 text-muted-foreground/0 group-hover:text-accent group-hover:translate-x-0.5 transition-all" />
            </motion.button>
          ))}
        </motion.div>

        {/* Bottom hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8, duration: 0.6 }}
          className="mt-8 text-xs text-muted-foreground/60"
        >
          Type your question below or click a suggestion to get started
        </motion.p>
      </motion.div>
    </div>
  );
}

export function ChatMessages({
  messages,
  isLoading = false,
  className,
  onRetryMessage,
  onSuggestionClick,
}: ChatMessagesProps) {
  const scrollAreaRef = React.useRef<HTMLDivElement>(null);
  const bottomRef = React.useRef<HTMLDivElement>(null);
  const [showScrollButton, setShowScrollButton] = React.useState(false);

  const shouldAutoScrollRef = React.useRef(true);
  const isProgrammaticScrollRef = React.useRef(false);
  const lastMessageCountRef = React.useRef(messages.length);

  const getScrollViewport = React.useCallback(() => {
    return scrollAreaRef.current?.querySelector(
      "[data-radix-scroll-area-viewport]"
    ) as HTMLElement | null;
  }, []);

  const isNearBottom = React.useCallback(() => {
    const viewport = getScrollViewport();
    if (!viewport) return true;

    const { scrollTop, scrollHeight, clientHeight } = viewport;
    return scrollHeight - scrollTop - clientHeight < SCROLL_BUTTON_THRESHOLD;
  }, [getScrollViewport]);

  const scrollToBottom = React.useCallback(() => {
    const viewport = getScrollViewport();
    if (!viewport) return;

    isProgrammaticScrollRef.current = true;
    viewport.scrollTop = viewport.scrollHeight;
    setShowScrollButton(false);

    requestAnimationFrame(() => {
      isProgrammaticScrollRef.current = false;
    });
  }, [getScrollViewport]);

  const handleScrollToBottom = React.useCallback(() => {
    shouldAutoScrollRef.current = true;
    scrollToBottom();
  }, [scrollToBottom]);

  React.useEffect(() => {
    const viewport = getScrollViewport();
    if (!viewport) return;

    const handleScroll = () => {
      if (isProgrammaticScrollRef.current) return;

      const nearBottom = isNearBottom();

      if (!nearBottom) {
        shouldAutoScrollRef.current = false;
        setShowScrollButton(true);
      } else {
        shouldAutoScrollRef.current = true;
        setShowScrollButton(false);
      }
    };

    viewport.addEventListener("scroll", handleScroll);
    return () => viewport.removeEventListener("scroll", handleScroll);
  }, [getScrollViewport, isNearBottom]);

  React.useEffect(() => {
    const isNewMessage = messages.length > lastMessageCountRef.current;
    lastMessageCountRef.current = messages.length;

    if (isNewMessage && messages.length > 0) {
      const lastMessage = messages[messages.length - 1];
      if (lastMessage?.role === "user") {
        shouldAutoScrollRef.current = true;
        scrollToBottom();
      }
    }
  }, [messages.length, messages, scrollToBottom]);

  React.useEffect(() => {
    if (shouldAutoScrollRef.current) {
      requestAnimationFrame(() => {
        scrollToBottom();
      });
    }
  }, [messages, isLoading, scrollToBottom]);

  if (messages.length === 0 && !isLoading) {
    return (
      <div className={cn("flex flex-1 flex-col relative", className)}>
        <HeroEmptyState onSuggestionClick={onSuggestionClick} />
      </div>
    );
  }

  return (
    <div className={cn("relative flex-1 min-h-0", className)}>
      <ScrollArea ref={scrollAreaRef} className="h-full">
        <div className="flex flex-col p-4 md:p-6 max-w-4xl mx-auto">
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

            <AnimatePresence>
              {isLoading && <TypingIndicator key="typing-indicator" />}
            </AnimatePresence>
          </motion.div>

          <div ref={bottomRef} className="h-px" aria-hidden="true" />
        </div>
      </ScrollArea>

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
              className="shadow-lg gap-1.5 rounded-full px-4"
            >
              <ArrowDown className="h-4 w-4" />
              <span>New messages</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
