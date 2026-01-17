"use client";

import * as React from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout";
import { ChatInput, ChatMessages } from "@/components/chat";
import { ResultsPanel } from "@/components/results";
import { OfflineBanner, AnimatedErrorBanner } from "@/components/errors";
import { useChat } from "@/components/providers";
import { useResults, useNetworkStatus } from "@/hooks";
import { MOCK_LEGISLATORS, MOCK_DOCUMENTS, MOCK_HEARINGS, MOCK_VOTES } from "@/lib/mock-data";

// Set to true to use mock data for testing filters
const USE_MOCK_DATA = process.env.NODE_ENV === "development";

export default function Home() {
  const { messages, isLoading, error, sendMessage, retryMessage, clearError } =
    useChat();
  const {
    legislators,
    documents,
    votes,
    hearings,
    activeTab,
    setActiveTab,
  } = useResults(messages);
  const { isOnline, wasOffline, resetWasOffline } = useNetworkStatus();

  // Show toast when coming back online
  React.useEffect(() => {
    if (wasOffline && isOnline) {
      toast.success("You're back online!", {
        description: "Your connection has been restored.",
        duration: 3000,
      });
      // Reset after showing toast
      const timer = setTimeout(resetWasOffline, 3500);
      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOnline, resetWasOffline]);

  // Show toast when going offline
  React.useEffect(() => {
    if (!isOnline) {
      toast.error("You're offline", {
        description: "Messages will be sent when you reconnect.",
        duration: 5000,
      });
    }
  }, [isOnline]);

  // Handle retry with toast feedback
  const handleRetryMessage = React.useCallback(
    async (messageId: string) => {
      toast.promise(retryMessage(messageId), {
        loading: "Retrying message...",
        success: "Message sent successfully!",
        error: "Failed to send message. Please try again.",
      });
    },
    [retryMessage]
  );

  // Handle send with offline check
  const handleSendMessage = React.useCallback(
    async (content: string) => {
      if (!isOnline) {
        toast.error("You're offline", {
          description: "Please check your connection and try again.",
        });
        return;
      }
      await sendMessage(content);
    },
    [sendMessage, isOnline]
  );

  // Use mock data in development for testing
  const displayLegislators = USE_MOCK_DATA && legislators.length === 0
    ? MOCK_LEGISLATORS
    : legislators;
  const displayDocuments = USE_MOCK_DATA && documents.length === 0
    ? MOCK_DOCUMENTS
    : documents;
  const displayHearings = USE_MOCK_DATA && hearings.length === 0
    ? MOCK_HEARINGS
    : hearings;
  const displayVotes = USE_MOCK_DATA && votes.length === 0
    ? MOCK_VOTES
    : votes;

  return (
    <AppLayout
      resultsPanel={
        <ResultsPanel
          legislators={displayLegislators}
          documents={displayDocuments}
          votes={displayVotes}
          hearings={displayHearings}
          isLoading={isLoading}
          activeTab={activeTab}
          onTabChange={setActiveTab}
        />
      }
    >
      <div className="flex flex-1 flex-col min-h-0 overflow-hidden">
        {/* Offline Banner */}
        <OfflineBanner
          isOffline={!isOnline}
          showRecovered={wasOffline && isOnline}
          onRecoveredDismiss={resetWasOffline}
        />

        {/* Global Error Banner */}
        <AnimatedErrorBanner
          visible={!!error && !isLoading}
          message={error || ""}
          title="Chat Error"
          dismissible
          onDismiss={clearError}
          showRetry={false}
          className="mx-4 mt-2"
        />

        {/* Chat Messages Area */}
        <ChatMessages
          messages={messages}
          isLoading={isLoading}
          onRetryMessage={handleRetryMessage}
        />

        {/* Chat Input - fixed at bottom */}
        <div className="flex-shrink-0">
          <ChatInput
            onSend={handleSendMessage}
            isLoading={isLoading}
            disabled={!isOnline}
          />
        </div>
      </div>
    </AppLayout>
  );
}
