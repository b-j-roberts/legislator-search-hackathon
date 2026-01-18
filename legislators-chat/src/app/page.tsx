"use client";

import * as React from "react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout";
import { ChatInput, ChatMessages } from "@/components/chat";
import { ResultsPanel } from "@/components/results";
import { OfflineBanner, AnimatedErrorBanner } from "@/components/errors";
import { useChat, useContact } from "@/components/providers";
import { useResults, useNetworkStatus, useSessionSync, useSentiment } from "@/hooks";

export default function Home() {
  const { messages, isLoading, error, sendMessage, retryMessage, clearError } = useChat();
  const { legislators, documents, votes, hearings, searchResults, speakers, activeTab, setActiveTab } = useResults(messages);
  const { isOnline, wasOffline, resetWasOffline } = useNetworkStatus();
  const { currentStep, setCurrentStep } = useContact();
  const [suggestionValue, setSuggestionValue] = React.useState("");
  const { sentimentScores, isLoading: sentimentLoading, analyzeSentiment, reset: resetSentiment } = useSentiment();

  // Get the last user message as the query for sentiment analysis
  const lastUserQuery = React.useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") {
        return messages[i].content;
      }
    }
    return "";
  }, [messages]);

  // Trigger sentiment analysis when speakers/search results change
  React.useEffect(() => {
    if (speakers.length > 0 && searchResults.length > 0 && lastUserQuery && !isLoading) {
      analyzeSentiment(lastUserQuery, speakers, searchResults);
    }
  }, [speakers, searchResults, lastUserQuery, isLoading, analyzeSentiment]);

  // Reset sentiment when starting a new conversation
  React.useEffect(() => {
    if (messages.length === 0) {
      resetSentiment();
    }
  }, [messages.length, resetSentiment]);

  // Sync chat conversation ID with contact state for session isolation
  useSessionSync();

  // Reset contact step to "research" when on home page
  React.useEffect(() => {
    if (currentStep !== "research") {
      setCurrentStep("research");
    }
  }, [currentStep, setCurrentStep]);

  React.useEffect(() => {
    if (wasOffline && isOnline) {
      toast.success("You're back online!", {
        description: "Your connection has been restored.",
        duration: 3000,
      });
      const timer = setTimeout(resetWasOffline, 3500);
      return () => clearTimeout(timer);
    }
  }, [wasOffline, isOnline, resetWasOffline]);

  React.useEffect(() => {
    if (!isOnline) {
      toast.error("You're offline", {
        description: "Messages will be sent when you reconnect.",
        duration: 5000,
      });
    }
  }, [isOnline]);

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

  const handleSendMessage = React.useCallback(
    async (content: string) => {
      if (!isOnline) {
        toast.error("You're offline", {
          description: "Please check your connection and try again.",
        });
        return;
      }
      await sendMessage(content);
      setSuggestionValue(""); // Clear suggestion after sending
    },
    [sendMessage, isOnline]
  );

  const handleSuggestionClick = React.useCallback(
    (suggestion: string) => {
      if (!isOnline) {
        toast.error("You're offline", {
          description: "Please check your connection and try again.",
        });
        return;
      }
      setSuggestionValue(suggestion);
    },
    [isOnline]
  );

  return (
    <AppLayout
      resultsPanel={
        <ResultsPanel
          legislators={legislators}
          documents={documents}
          votes={votes}
          hearings={hearings}
          searchResults={searchResults}
          speakers={speakers}
          sentimentScores={sentimentScores}
          sentimentLoading={sentimentLoading}
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
          onSuggestionClick={handleSuggestionClick}
        />

        {/* Chat Input */}
        <div className="flex-shrink-0">
          <ChatInput
            onSend={handleSendMessage}
            isLoading={isLoading}
            disabled={!isOnline}
            initialValue={suggestionValue}
          />
        </div>
      </div>
    </AppLayout>
  );
}
