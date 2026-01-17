"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowLeft, Phone, Mail, Users, AlertCircle, CheckCircle2, Clock, Copy } from "lucide-react";

import { useContact, getEffectiveContactMethod, getContactAvailability } from "@/hooks/use-contact";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ProgressStepper } from "@/components/layout";
import { ContactQueue, ContactMethodSelector } from "@/components/contact";

import type { QueueItem } from "@/hooks/use-contact";
import type { ContactMethod } from "@/lib/types";

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

interface ActiveContactPanelProps {
  item: QueueItem;
  onMethodChange: (method: ContactMethod) => void;
  onMarkContacted: () => void;
}

function ActiveContactPanel({ item, onMethodChange, onMarkContacted }: ActiveContactPanelProps) {
  const { legislator } = item;
  const availability = getContactAvailability(legislator);
  const effectiveMethod = getEffectiveContactMethod(item);
  const [copied, setCopied] = React.useState(false);

  const contactInfo =
    effectiveMethod === "call" ? legislator.contact.phone : legislator.contact.email;

  const handleCopy = async () => {
    if (!contactInfo) return;
    try {
      await navigator.clipboard.writeText(contactInfo);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  return (
    <Card className="border-primary/50 bg-primary/5">
      <CardContent className="pt-4 pb-4">
        <div className="flex flex-col gap-4">
          {/* Header with name and method selector */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="rounded-full bg-primary p-2">
                {effectiveMethod === "call" ? (
                  <Phone className="size-4 text-primary-foreground" />
                ) : (
                  <Mail className="size-4 text-primary-foreground" />
                )}
              </div>
              <div>
                <p className="font-medium text-foreground">
                  {effectiveMethod === "call" ? "Calling" : "Emailing"}: {legislator.name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {legislator.chamber === "House" ? "Representative" : "Senator"} • {legislator.state}
                  {legislator.district ? `-${legislator.district}` : ""}
                </p>
              </div>
            </div>

            {/* Method selector - only show if both methods available */}
            {availability.hasBoth && (
              <ContactMethodSelector
                value={effectiveMethod}
                onChange={onMethodChange}
                hasPhone={availability.hasPhone}
                hasEmail={availability.hasEmail}
              />
            )}
          </div>

          {/* Contact info display */}
          {contactInfo && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-background border border-border">
              <div className="flex-1 font-mono text-sm text-foreground break-all">{contactInfo}</div>
              <Button variant="ghost" size="icon-sm" onClick={handleCopy} className="flex-shrink-0">
                {copied ? (
                  <CheckCircle2 className="size-4 text-green-500" />
                ) : (
                  <Copy className="size-4" />
                )}
              </Button>
              <Button variant="default" size="sm" asChild className="flex-shrink-0">
                <a
                  href={effectiveMethod === "call" ? `tel:${contactInfo}` : `mailto:${contactInfo}`}
                >
                  {effectiveMethod === "call" ? "Call Now" : "Open Email"}
                </a>
              </Button>
            </div>
          )}

          {/* Availability indicator */}
          {!availability.hasBoth && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="size-3" />
              {!availability.hasPhone
                ? "Phone number not available for this representative"
                : "Email not available for this representative"}
            </p>
          )}

          {/* Mark contacted button */}
          <div className="flex justify-end">
            <Button onClick={onMarkContacted} className="gap-1.5">
              <CheckCircle2 className="size-4" />
              Mark as Contacted
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
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
    setLegislatorContactMethod,
    setDefaultMethod,
    defaultContactMethod,
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
              {/* Active contact panel */}
              {!isComplete && activeItem && (
                <ActiveContactPanel
                  item={activeItem}
                  onMethodChange={(method) =>
                    setLegislatorContactMethod(activeItem.legislator.id, method)
                  }
                  onMarkContacted={handleMarkContacted}
                />
              )}

              {/* Default method preference */}
              {queue && queue.items.length > 1 && !isComplete && (
                <Card className="border-dashed">
                  <CardContent className="pt-4 pb-4">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="text-sm">
                        <p className="font-medium text-foreground">Default Contact Method</p>
                        <p className="text-muted-foreground">
                          Set the preferred method for new queue items
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <ContactMethodSelector
                          value={defaultContactMethod}
                          onChange={(method) => setDefaultMethod(method, false)}
                          hasPhone={true}
                          hasEmail={true}
                        />
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDefaultMethod(defaultContactMethod, true)}
                          className="text-xs"
                        >
                          Apply to All
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Contact Queue */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold text-foreground">Contact Queue</h2>
                <ContactQueue />
              </div>

              {/* Content generation section - Coming soon */}
              {activeItem && (
                <div className="space-y-4">
                  <h2 className="text-lg font-semibold text-foreground">
                    {getEffectiveContactMethod(activeItem) === "call"
                      ? "Call Script"
                      : "Email Draft"}
                  </h2>
                  <Card className="border-dashed opacity-75">
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="size-4" />
                        Coming Soon
                      </CardTitle>
                      <CardDescription>
                        {getEffectiveContactMethod(activeItem) === "call"
                          ? "AI-generated call scripts based on your research topic will appear here"
                          : "Personalized email drafts ready to send will appear here"}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg bg-muted/50 p-4 text-sm text-muted-foreground">
                        {getEffectiveContactMethod(activeItem) === "call" ? (
                          <>
                            <p className="font-medium mb-2">Sample call script:</p>
                            <p>
                              &quot;Hello, my name is [Your Name] and I&apos;m a constituent from
                              [Your City]. I&apos;m calling to speak with {activeItem.legislator.name}{" "}
                              about [Topic]. I would like to express my [support/concern] for...&quot;
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="font-medium mb-2">Sample email structure:</p>
                            <p>Subject: Constituent Input on [Topic]</p>
                            <p className="mt-2">Dear {activeItem.legislator.name},</p>
                            <p className="mt-1">
                              As your constituent, I am writing to share my perspective on...
                            </p>
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </motion.div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
