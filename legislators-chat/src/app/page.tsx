"use client";

import * as React from "react";
import { AppLayout } from "@/components/layout";
import { ChatInput } from "@/components/chat";
import { MessageSquare, Users } from "lucide-react";

export default function Home() {
  const [isLoading, setIsLoading] = React.useState(false);

  const handleSend = React.useCallback((message: string) => {
    // TODO: Integrate with chat API
    console.log("Sending message:", message);
    setIsLoading(true);

    // Simulate API call
    setTimeout(() => {
      setIsLoading(false);
    }, 1000);
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
        <div className="flex flex-1 flex-col items-center justify-center p-6 text-muted-foreground">
          <MessageSquare className="h-12 w-12 mb-4" />
          <h2 className="text-lg font-medium mb-2">Chat Area</h2>
          <p className="text-sm text-center max-w-xs">
            Ask questions about legislators, hearings, and voting records
          </p>
        </div>

        {/* Chat Input */}
        <ChatInput onSend={handleSend} isLoading={isLoading} />
      </div>
    </AppLayout>
  );
}
