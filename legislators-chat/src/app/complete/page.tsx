"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Users, Sparkles } from "lucide-react";
import Link from "next/link";

import { useContact } from "@/hooks/use-contact";
import { Button } from "@/components/ui/button";
import { SessionSummary } from "@/components/contact";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      {/* Decorative background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-gradient-to-br from-copper/5 via-transparent to-gold/5 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="relative"
      >
        <div className="relative rounded-2xl bg-gradient-to-br from-muted/80 to-muted/40 p-6 border border-border/50 mb-6">
          <div className="absolute inset-0 bg-gradient-to-br from-copper/5 to-gold/5 rounded-2xl" />
          <Users className="relative size-10 text-muted-foreground" />
        </div>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="font-display text-2xl font-semibold text-foreground mb-3"
      >
        No Completed Session
      </motion.h3>

      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="text-muted-foreground max-w-sm mb-8 leading-relaxed"
      >
        Complete contacting your representatives to see your session summary and impact report here.
      </motion.p>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Button asChild size="lg" className="gap-2">
          <Link href="/">
            <ArrowLeft className="size-4" />
            Start Research
          </Link>
        </Button>
      </motion.div>
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

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden relative">
      {/* Decorative background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[500px] h-[300px] bg-gradient-to-br from-copper/5 via-transparent to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[300px] bg-gradient-to-tl from-gold/5 via-transparent to-transparent rounded-full blur-3xl" />
      </div>

      {/* Compact Header */}
      <motion.header
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative flex-shrink-0 border-b border-border/50 bg-background/80 backdrop-blur-sm"
      >
        <div className="px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleContinueResearch}
                className="rounded-full hover:bg-muted"
              >
                <ArrowLeft className="size-4" />
              </Button>
              <div className="flex items-center gap-2">
                <div className="size-2 rounded-full bg-gradient-to-r from-copper to-gold animate-pulse" />
                <span className="text-sm font-medium text-foreground">Session Complete</span>
              </div>
            </div>

            {queue && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Sparkles className="size-4 text-copper" />
                <span>{queue.items.length} contacted</span>
              </div>
            )}
          </div>
        </div>
      </motion.header>

      {/* Main content */}
      <div className="relative flex-1 overflow-auto">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
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
