"use client";

import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowDown,
  Search,
  Users,
  FileText,
  Vote,
  Landmark,
  ArrowRight,
  Sparkles,
} from "lucide-react";
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
    title: "Find representatives",
    description: "Discover who represents your district",
    query: "Who represents my district in Congress?",
  },
  {
    icon: Vote,
    title: "Track voting records",
    description: "See how legislators voted on key issues",
    query: "Show me recent climate change votes",
  },
  {
    icon: FileText,
    title: "Research hearings",
    description: "Explore committee hearings and testimony",
    query: "Find healthcare committee hearings from this year",
  },
];

function HeroEmptyState({
  onSuggestionClick,
}: {
  onSuggestionClick?: (query: string) => void;
}) {
  return (
    <div className="flex flex-1 flex-col items-center px-6 py-8 text-center overflow-auto relative min-h-0">
      {/* Spacer to push content toward center but allow scrolling */}
      <div className="flex-1 min-h-8 max-h-[15vh]" />
      {/* Subtle background pattern */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] bg-accent/[0.03] rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-primary/[0.02] rounded-full blur-3xl" />
      </div>

      {/* Hero content */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 max-w-xl"
      >
        {/* Decorative icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="mb-6 inline-flex"
        >
          <div className="relative flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/10 to-accent/10 border border-border/50">
            <Landmark className="w-7 h-7 text-primary dark:text-accent" />
            <motion.div
              className="absolute -top-1 -right-1 w-6 h-6 rounded-lg bg-accent flex items-center justify-center"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.3, type: "spring", stiffness: 400, damping: 15 }}
            >
              <Sparkles className="w-3 h-3 text-accent-foreground" />
            </motion.div>
          </div>
        </motion.div>

        {/* Main headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-balance leading-[1.15] mb-3"
        >
          Explore Congress with{" "}
          <span className="text-gradient">AI-powered</span> research
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.6 }}
          className="text-muted-foreground text-base md:text-lg max-w-md mx-auto mb-10 text-balance leading-relaxed"
        >
          Ask about legislators, voting records, committee hearings, and policy positions.
          Get informed, then take action.
        </motion.p>

        {/* Suggestion cards - Editorial style */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.6 }}
          className="grid gap-3 w-full max-w-lg mx-auto"
        >
          {SUGGESTIONS.map((suggestion, index) => (
            <motion.button
              key={suggestion.title}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.08, duration: 0.5 }}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => onSuggestionClick?.(suggestion.query)}
              className="group flex items-center gap-4 p-4 rounded-xl border border-border/60 bg-card/60 hover:bg-card hover:border-accent/30 hover:shadow-md transition-all duration-300 text-left card-shadow"
            >
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-secondary group-hover:bg-accent/10 transition-colors flex-shrink-0">
                <suggestion.icon className="w-5 h-5 text-muted-foreground group-hover:text-accent transition-colors" />
              </div>
              <div className="flex-1 min-w-0">
                <span className="block text-sm font-medium text-foreground group-hover:text-foreground transition-colors">
                  {suggestion.title}
                </span>
                <span className="block text-xs text-muted-foreground mt-0.5 truncate">
                  {suggestion.description}
                </span>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-accent group-hover:translate-x-0.5 transition-all flex-shrink-0" />
            </motion.button>
          ))}
        </motion.div>

        {/* Bottom hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-8 text-xs text-muted-foreground/60 flex items-center justify-center gap-2"
        >
          <Search className="w-3 h-3" />
          <span>Type your question below or select a suggestion</span>
        </motion.p>
      </motion.div>

      {/* Bottom spacer for balanced layout */}
      <div className="flex-1 min-h-8 max-h-[10vh]" />
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
      <div className={cn("flex flex-1 flex-col relative min-h-0 overflow-hidden", className)}>
        <HeroEmptyState onSuggestionClick={onSuggestionClick} />
      </div>
    );
  }

  return (
    <div className={cn("relative flex-1 min-h-0", className)}>
      <ScrollArea ref={scrollAreaRef} className="h-full">
        <div className="flex flex-col p-4 md:p-6 lg:p-8 max-w-3xl mx-auto">
          <motion.div
            variants={containerVariants}
            initial="initial"
            animate="animate"
            className="flex flex-col gap-5"
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
              className="shadow-lg gap-1.5 rounded-full px-4 bg-card border border-border"
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
