"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout";
import { ChatInput, ChatMessages } from "@/components/chat";
import { Users } from "lucide-react";
import type { ChatMessage } from "@/lib/types";

// Generate a unique ID for messages
function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export default function Home() {
  const [messages, setMessages] = React.useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSend = React.useCallback((content: string) => {
    // Create user message
    const userMessage: ChatMessage = {
      id: generateId(),
      role: "user",
      content,
      timestamp: new Date().toISOString(),
      status: "sent",
    };

    // Add user message to state
    setMessages((prev) => [...prev, userMessage]);
    setIsLoading(true);

    // TODO: Replace with actual API call
    // Simulate API response
    setTimeout(() => {
      const assistantMessage: ChatMessage = {
        id: generateId(),
        role: "assistant",
        content: `I'm researching your question about "${content.slice(0, 50)}${content.length > 50 ? "..." : ""}". This is a simulated response - the actual API integration will provide real legislator data, voting records, and hearing information.`,
        timestamp: new Date().toISOString(),
        status: "sent",
      };

      setMessages((prev) => [...prev, assistantMessage]);
      setIsLoading(false);
    }, 1500);
  }, []);

  return (
    <AppLayout
      resultsPanel={
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-muted-foreground">
          <Users className="h-12 w-12 mb-4" />
          <h2 className="text-lg font-medium mb-2">Results Panel</h2>
          <p className="text-sm text-center max-w-xs">
            Legislator cards and search results will appear here
          </p>
        </div>
      }
    >
      <div className="flex flex-1 flex-col">
        {/* Chat Messages Area */}
        <ChatMessages messages={messages} isLoading={isLoading} />

        {/* Chat Input */}
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </AppLayout>
  );
}
