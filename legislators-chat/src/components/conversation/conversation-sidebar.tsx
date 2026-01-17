"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquarePlus,
  MessageSquare,
  Trash2,
  X,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useChat } from "@/hooks/use-chat";
import type { Conversation } from "@/lib/types";

// =============================================================================
// ConversationItem
// =============================================================================

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onSelect: () => void;
  onDelete: () => void;
}

function ConversationItem({
  conversation,
  isActive,
  onSelect,
  onDelete,
}: ConversationItemProps) {
  const [showDelete, setShowDelete] = React.useState(false);

  // Format relative time
  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;

    return date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -10 }}
      className="group relative"
      onMouseEnter={() => setShowDelete(true)}
      onMouseLeave={() => setShowDelete(false)}
    >
      <button
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg px-3 py-3 text-left transition-colors",
          "hover:bg-accent/50",
          isActive && "bg-accent"
        )}
      >
        <MessageSquare
          className={cn(
            "mt-0.5 h-4 w-4 flex-shrink-0",
            isActive ? "text-primary" : "text-muted-foreground"
          )}
        />
        <div className="flex-1 min-w-0 overflow-hidden">
          <p
            className={cn(
              "text-sm font-medium truncate",
              isActive ? "text-foreground" : "text-foreground/80"
            )}
          >
            {conversation.title || "New Conversation"}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {formatRelativeTime(conversation.updatedAt)}
            {conversation.messages.length > 0 && (
              <span className="ml-2">
                {conversation.messages.length} message
                {conversation.messages.length !== 1 && "s"}
              </span>
            )}
          </p>
        </div>
      </button>

      {/* Delete button - appears on hover */}
      <AnimatePresence>
        {showDelete && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="absolute right-2 top-1/2 -translate-y-1/2"
          >
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="sr-only">Delete conversation</span>
            </Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// =============================================================================
// ConversationSidebar
// =============================================================================

export function ConversationSidebar() {
  const {
    conversations,
    activeConversation,
    newConversation,
    switchConversation,
    deleteConversation,
    isSidebarOpen,
    setSidebarOpen,
  } = useChat();

  const handleNewConversation = () => {
    newConversation();
    // Close sidebar on mobile after creating new conversation
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleSelectConversation = (id: string) => {
    switchConversation(id);
    // Close sidebar on mobile after selecting
    if (window.innerWidth < 768) {
      setSidebarOpen(false);
    }
  };

  const handleDeleteConversation = (id: string) => {
    deleteConversation(id);
  };

  // Group conversations by date
  const groupedConversations = React.useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const weekAgo = new Date(today);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const groups: { label: string; conversations: Conversation[] }[] = [
      { label: "Today", conversations: [] },
      { label: "Yesterday", conversations: [] },
      { label: "Previous 7 Days", conversations: [] },
      { label: "Older", conversations: [] },
    ];

    conversations.forEach((conv) => {
      const convDate = new Date(conv.updatedAt);
      const convDateStr = convDate.toDateString();

      if (convDateStr === today.toDateString()) {
        groups[0].conversations.push(conv);
      } else if (convDateStr === yesterday.toDateString()) {
        groups[1].conversations.push(conv);
      } else if (convDate > weekAgo) {
        groups[2].conversations.push(conv);
      } else {
        groups[3].conversations.push(conv);
      }
    });

    // Filter out empty groups
    return groups.filter((g) => g.conversations.length > 0);
  }, [conversations]);

  return (
    <>
      {/* Backdrop for mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className={cn(
              "fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border bg-background",
              "md:relative md:z-auto"
            )}
          >
            {/* Header */}
            <div className="flex h-14 md:h-16 items-center justify-between border-b border-border px-4">
              <h2 className="text-sm font-semibold">Chat History</h2>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 md:hidden"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close sidebar</span>
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:flex h-8 w-8"
                onClick={() => setSidebarOpen(false)}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">Collapse sidebar</span>
              </Button>
            </div>

            {/* New Conversation Button */}
            <div className="p-3 border-b border-border">
              <Button
                onClick={handleNewConversation}
                className="w-full justify-start gap-2"
                variant="outline"
              >
                <MessageSquarePlus className="h-4 w-4" />
                New Conversation
              </Button>
            </div>

            {/* Conversation List */}
            <ScrollArea className="flex-1">
              <div className="p-2">
                {groupedConversations.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                    <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No conversations yet
                    </p>
                    <p className="text-xs text-muted-foreground/60 mt-1">
                      Start a new conversation to begin
                    </p>
                  </div>
                ) : (
                  groupedConversations.map((group) => (
                    <div key={group.label} className="mb-4">
                      <h3 className="px-3 py-2 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {group.label}
                      </h3>
                      <div className="space-y-1">
                        <AnimatePresence mode="popLayout">
                          {group.conversations.map((conv) => (
                            <ConversationItem
                              key={conv.id}
                              conversation={conv}
                              isActive={activeConversation?.id === conv.id}
                              onSelect={() => handleSelectConversation(conv.id)}
                              onDelete={() => handleDeleteConversation(conv.id)}
                            />
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>

            {/* Footer with count */}
            <div className="border-t border-border p-3">
              <p className="text-xs text-muted-foreground text-center">
                {conversations.length} conversation
                {conversations.length !== 1 && "s"}
              </p>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
