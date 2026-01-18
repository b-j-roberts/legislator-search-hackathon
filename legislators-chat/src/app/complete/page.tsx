"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import Link from "next/link";

import { useContact } from "@/hooks/use-contact";
import { Button } from "@/components/ui/button";
import { SessionSummary } from "@/components/contact";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Users className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No completed session</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Complete contacting your representatives to see your session summary here.
      </p>
      <Button asChild>
        <Link href="/">
          <ArrowLeft className="size-4 mr-2" />
          Start Research
        </Link>
      </Button>
    </div>
  );
}

export default function CompletePage() {
  const router = useRouter();
  const {
    queue,
    isComplete,
    researchContext,
    clearSelections,
    setCurrentStep,
  } = useContact();

  // Ensure we're on the complete step
  React.useEffect(() => {
    setCurrentStep("complete");
  }, [setCurrentStep]);

  // Redirect to /contact if not complete but has queue
  React.useEffect(() => {
    if (queue && !isComplete) {
      router.replace("/contact");
    }
  }, [queue, isComplete, router]);

  const handleClearSession = () => {
    clearSelections();
    setCurrentStep("research");
    router.push("/");
  };

  const handleContinueResearch = () => {
    setCurrentStep("research");
    router.push("/");
  };

  const totalCount = queue?.items.length ?? 0;

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-4">
          <div className="mb-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleContinueResearch}
              className="gap-1.5"
            >
              <ArrowLeft className="size-4" />
              Back to Research
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">Session Complete</h1>
              <p className="text-muted-foreground mt-0.5">
                {queue
                  ? `All ${totalCount} representative${totalCount !== 1 ? "s" : ""} contacted`
                  : "No active session"}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto px-4 py-6">
          {!queue || !isComplete ? (
            <EmptyState />
          ) : (
            <SessionSummary
              items={queue.items}
              researchContext={researchContext}
              onClearSession={handleClearSession}
              onContinueResearch={handleContinueResearch}
            />
          )}
        </div>
      </div>
    </div>
  );
}
