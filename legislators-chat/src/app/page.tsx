"use client";

import { AppLayout } from "@/components/layout";
import { ChatInput, ChatMessages } from "@/components/chat";
import { ResultsPanel } from "@/components/results";
import { useChat } from "@/components/providers";
import { useResults } from "@/hooks";

export default function Home() {
  const { messages, isLoading, sendMessage, retryMessage } = useChat();
  const {
    legislators,
    documents,
    votes,
    hearings,
    activeTab,
    setActiveTab,
  } = useResults(messages);

  return (
    <AppLayout
      resultsPanel={
        <ResultsPanel
          legislators={legislators}
          documents={documents}
          votes={votes}
          hearings={hearings}
          isLoading={isLoading}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      }
    >
      <div className="flex flex-1 flex-col min-h-0">
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
