"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Mail, Users, AlertCircle, CheckCircle2 } from "lucide-react";

import { useContact } from "@/hooks/use-contact";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProgressStepper } from "@/components/layout";
import { ContactQueue } from "@/components/contact";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Users className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No representatives selected</h3>
      <p className="text-sm text-muted-foreground max-w-xs mb-6">
        Go back to the research phase to select representatives you&apos;d like to contact.
      </p>
      <Button asChild>
        <Link href="/">
          <ArrowLeft className="size-4 mr-2" />
          Back to Research
        </Link>
      </Button>
    </div>
  );
}

export default function ContactPage() {
  const router = useRouter();
  const {
    currentStep,
    setCurrentStep,
    hasSelections,
    selectionCount,
    queue,
    initializeQueue,
    markCurrentContacted,
    contactedCount,
    isComplete,
    activeItem,
  } = useContact();

  // Ensure we're on the contact step and initialize queue if needed
  React.useEffect(() => {
    if (currentStep !== "contact") {
      setCurrentStep("contact");
    }
  }, [currentStep, setCurrentStep]);

  // Initialize queue when entering contact page with selections but no queue
  React.useEffect(() => {
    if (hasSelections && !queue) {
      initializeQueue();
    }
  }, [hasSelections, queue, initializeQueue]);

  const handleBack = () => {
    setCurrentStep("research");
    router.push("/");
  };

  const handleMarkContacted = () => {
    markCurrentContacted();
  };

  // Calculate progress text
  const progressText = queue
    ? isComplete
      ? `All ${queue.items.length} representative${queue.items.length !== 1 ? "s" : ""} contacted`
      : `${contactedCount} of ${queue.items.length} contacted`
    : hasSelections
      ? `${selectionCount} representative${selectionCount !== 1 ? "s" : ""} selected`
      : "Select representatives to contact them";

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header with stepper */}
      <div className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
              <ArrowLeft className="size-4" />
              Back to Research
            </Button>
            <ProgressStepper currentStep="contact" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contact Your Representatives</h1>
            <p className="text-muted-foreground mt-1">{progressText}</p>
          </div>
        </div>
      </div>

      {/* Main content */}
      <ScrollArea className="flex-1">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {!hasSelections && !queue ? (
            <EmptyState />
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* Info banner */}
              {!isComplete && activeItem && (
                <div className="flex items-start gap-3 p-4 rounded-lg border border-border bg-muted/50">
                  <AlertCircle className="size-5 text-primary flex-shrink-0 mt-0.5" />
                  <div className="text-sm flex-1">
                    <p className="font-medium text-foreground">
                      Currently contacting: {activeItem.legislator.name}
                    </p>
                    <p className="text-muted-foreground mt-1">
                      Drag items to reorder your queue. Use skip to move someone to the end.
                    </p>
                  </div>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleMarkContacted}
                    className="gap-1.5 flex-shrink-0"
                  >
                    <CheckCircle2 className="size-4" />
                    Mark Contacted
                  </Button>
                </div>
              )}

              {/* Contact Queue */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Contact Queue</h2>
                <ContactQueue />
              </div>

              {/* Coming soon section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Coming Soon</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="opacity-60">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-muted p-2">
                          <Phone className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">Call Scripts</h3>
                          <p className="text-sm text-muted-foreground">
                            AI-generated scripts based on your research
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  <Card className="opacity-60">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3">
                        <div className="rounded-full bg-muted p-2">
                          <Mail className="size-5 text-muted-foreground" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">Email Drafts</h3>
                          <p className="text-sm text-muted-foreground">
                            Personalized email templates ready to send
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
