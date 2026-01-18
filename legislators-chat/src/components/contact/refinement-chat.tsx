"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send,
  Bot,
  User,
  Loader2,
  Sparkles,
  ArrowDown,
  ArrowUp,
  FileText,
  PenLine,
  Heart,
  BarChart3,
  MessageSquare,
  Zap,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type {
  RefinementMessage,
  QuickAction,
  EditableCallScript,
  EditableEmailDraft,
  Legislator,
  AdvocacyContext,
} from "@/lib/types";

// =============================================================================
// Quick Actions Configuration
// =============================================================================

const QUICK_ACTIONS: QuickAction[] = [
  {
    id: "shorter",
    label: "Make shorter",
    prompt: "Make this content more concise and shorter while keeping the key points.",
    icon: "ArrowDown",
  },
  {
    id: "longer",
    label: "Make longer",
    prompt: "Expand this content with more detail and supporting points.",
    icon: "ArrowUp",
  },
  {
    id: "formal",
    label: "More formal",
    prompt: "Make the tone more formal and professional.",
    icon: "FileText",
  },
  {
    id: "casual",
    label: "More casual",
    prompt: "Make the tone more conversational and approachable.",
    icon: "MessageSquare",
  },
  {
    id: "personal",
    label: "Add personal touch",
    prompt: "Make this more personal and emotionally engaging.",
    icon: "Heart",
  },
  {
    id: "statistics",
    label: "Add statistics",
    prompt:
      "Add relevant statistics or data points to strengthen the argument.",
    icon: "BarChart3",
  },
  {
    id: "stronger",
    label: "Stronger call-to-action",
    prompt: "Make the call-to-action more compelling and urgent.",
    icon: "Zap",
  },
  {
    id: "simplify",
    label: "Simplify language",
    prompt: "Use simpler, clearer language that's easier to understand.",
    icon: "PenLine",
  },
];

const ICON_MAP: Record<string, React.ElementType> = {
  ArrowDown,
  ArrowUp,
  FileText,
  MessageSquare,
  Heart,
  BarChart3,
  Zap,
  PenLine,
};

// =============================================================================
// Types
// =============================================================================

interface RefinementChatProps {
  /** Current content being refined */
  currentContent: EditableCallScript | EditableEmailDraft;
  /** Type of content */
  contentType: "call" | "email";
  /** Legislator context */
  legislator: Legislator;
  /** Advocacy context */
  advocacyContext: AdvocacyContext | null;
  /** Called when refinement is complete */
  onRefinementComplete: (
    content: EditableCallScript | EditableEmailDraft,
    changeSummary: string
  ) => void;
  /** Class name for the container */
  className?: string;
  /** Whether the panel is collapsed */
  isCollapsed?: boolean;
  /** Toggle collapse state */
  onToggleCollapse?: () => void;
}

// =============================================================================
// Message Component
// =============================================================================

function ChatMessage({ message }: { message: RefinementMessage }) {
  const isUser = message.role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("flex gap-2", isUser ? "flex-row-reverse" : "flex-row")}
    >
      <div
        className={cn(
          "flex-shrink-0 size-7 rounded-full flex items-center justify-center",
          isUser ? "bg-primary text-primary-foreground" : "bg-muted"
        )}
      >
        {isUser ? <User className="size-4" /> : <Bot className="size-4" />}
      </div>
      <div
        className={cn(
          "max-w-[85%] rounded-lg px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-foreground"
        )}
      >
        <p className="whitespace-pre-wrap">{message.content}</p>
        {message.appliedChanges && (
          <p className="mt-2 text-xs opacity-75 border-t border-current/20 pt-2">
            Changes: {message.appliedChanges}
          </p>
        )}
      </div>
    </motion.div>
  );
}

// =============================================================================
// Quick Actions Component
// =============================================================================

function QuickActions({
  onActionClick,
  disabled,
}: {
  onActionClick: (action: QuickAction) => void;
  disabled: boolean;
}) {
  const [showAll, setShowAll] = React.useState(false);
  const visibleActions = showAll ? QUICK_ACTIONS : QUICK_ACTIONS.slice(0, 4);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Quick refinements</p>
        {QUICK_ACTIONS.length > 4 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="h-6 px-2 text-xs"
          >
            {showAll ? "Show less" : `+${QUICK_ACTIONS.length - 4} more`}
          </Button>
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <AnimatePresence mode="popLayout">
          {visibleActions.map((action) => {
            const Icon = action.icon ? ICON_MAP[action.icon] : Sparkles;
            return (
              <motion.div
                key={action.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.15 }}
              >
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onActionClick(action)}
                  disabled={disabled}
                  className="h-7 px-2 gap-1 text-xs"
                >
                  <Icon className="size-3" />
                  {action.label}
                </Button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

// =============================================================================
// Main Refinement Chat Component
// =============================================================================

export function RefinementChat({
  currentContent,
  contentType,
  legislator,
  advocacyContext,
  onRefinementComplete,
  className,
  isCollapsed = false,
  onToggleCollapse,
}: RefinementChatProps) {
  const [messages, setMessages] = React.useState<RefinementMessage[]>([]);
  const [input, setInput] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(false);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLTextAreaElement>(null);

  // Scroll to bottom when new messages arrive
  React.useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages]);

  // Auto-focus input when not collapsed
  React.useEffect(() => {
    if (!isCollapsed && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCollapsed]);

  const handleSubmit = React.useCallback(
    async (requestText: string) => {
      if (!requestText.trim() || isLoading) return;

      const userMessage: RefinementMessage = {
        id: `msg-${Date.now()}`,
        role: "user",
        content: requestText.trim(),
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
      setIsLoading(true);

      try {
        const response = await fetch("/api/refine-content", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            currentContent,
            contentType,
            request: requestText.trim(),
            legislator,
            advocacyContext,
            chatHistory: messages,
          }),
        });

        if (!response.ok) {
          throw new Error("Failed to refine content");
        }

        const data = await response.json();

        const assistantMessage: RefinementMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content: data.explanation,
          timestamp: new Date().toISOString(),
          appliedChanges: data.changeSummary,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Apply the refinement
        onRefinementComplete(data.content, data.changeSummary);
      } catch (error) {
        const errorMessage: RefinementMessage = {
          id: `msg-${Date.now()}`,
          role: "assistant",
          content:
            "I encountered an error while refining your content. Please try again.",
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, errorMessage]);
      } finally {
        setIsLoading(false);
      }
    },
    [
      currentContent,
      contentType,
      legislator,
      advocacyContext,
      messages,
      isLoading,
      onRefinementComplete,
    ]
  );

  const handleQuickAction = React.useCallback(
    (action: QuickAction) => {
      handleSubmit(action.prompt);
    },
    [handleSubmit]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(input);
    }
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="pb-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="size-4 text-primary" />
            <CardTitle className="text-sm font-medium">AI Refinement</CardTitle>
            {messages.length > 0 && (
              <Badge variant="secondary" className="text-xs">
                {messages.length} messages
              </Badge>
            )}
          </div>
          {onToggleCollapse && (
            isCollapsed ? (
              <ChevronDown className="size-4 text-muted-foreground" />
            ) : (
              <ChevronUp className="size-4 text-muted-foreground" />
            )
          )}
        </button>
      </CardHeader>

      <AnimatePresence>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CardContent className="space-y-4">
              {/* Quick Actions */}
              <QuickActions
                onActionClick={handleQuickAction}
                disabled={isLoading}
              />

              {/* Chat Messages */}
              {messages.length > 0 && (
                <div className="border-t border-border pt-4">
                  <ScrollArea className="h-48 pr-4">
                    <div className="space-y-3">
                      {messages.map((message) => (
                        <ChatMessage key={message.id} message={message} />
                      ))}
                      {isLoading && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex gap-2"
                        >
                          <div className="flex-shrink-0 size-7 rounded-full flex items-center justify-center bg-muted">
                            <Loader2 className="size-4 animate-spin" />
                          </div>
                          <div className="bg-muted rounded-lg px-3 py-2">
                            <p className="text-sm text-muted-foreground">
                              Refining your content...
                            </p>
                          </div>
                        </motion.div>
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </div>
              )}

              {/* Input Area */}
              <div className="flex gap-2">
                <Textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me to refine your content... (e.g., 'Include my personal story about healthcare costs')"
                  rows={2}
                  className="resize-none text-sm"
                  disabled={isLoading}
                />
                <Button
                  onClick={() => handleSubmit(input)}
                  disabled={!input.trim() || isLoading}
                  size="icon"
                  className="flex-shrink-0"
                >
                  {isLoading ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Send className="size-4" />
                  )}
                </Button>
              </div>

              {/* Tips */}
              <p className="text-xs text-muted-foreground">
                Try: &quot;Make it shorter&quot;, &quot;Add more statistics&quot;,
                &quot;Include my personal story about...&quot;, &quot;Change the tone
                to...&quot;
              </p>
            </CardContent>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
