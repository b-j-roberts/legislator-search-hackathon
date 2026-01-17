"use client";

import { AppLayout } from "@/components/layout";
import { ChatInput, ChatMessages } from "@/components/chat";
import { useChat } from "@/components/providers";
import { Users } from "lucide-react";

export default function Home() {
  const { messages, isLoading, sendMessage, retryMessage } = useChat();

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
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          onRetryMessage={retryMessage}
        />

        {/* Chat Input */}
        <ChatInput onSend={sendMessage} isLoading={isLoading} />
      </div>
    </AppLayout>
  );
}
