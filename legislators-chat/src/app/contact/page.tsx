"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  Mail,
  Users,
  CheckCircle2,
  Copy,
  X,
  ChevronRight,
  Sparkles,
} from "lucide-react";

import { useContact, getEffectiveContactMethod, getContactAvailability } from "@/hooks/use-contact";
import { ContactContentProvider } from "@/hooks/use-contact-content";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ContactQueue, ContactMethodSelector, ContentGenerationPanel, MarkCompleteDialog } from "@/components/contact";
import type { ContactOutcome } from "@/components/contact";

import type { QueueItem } from "@/hooks/use-contact";
import type { ContactMethod } from "@/lib/types";
import { autoLoadFixturesIfNeeded } from "@/lib/fixtures/mock-legislators";
import { cn } from "@/lib/utils";

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
      <div className="relative mb-6">
        <div className="absolute inset-0 bg-gradient-to-br from-copper/20 to-gold/20 rounded-full blur-xl" />
        <div className="relative rounded-full bg-muted p-5 border border-border">
          <Users className="size-10 text-muted-foreground" />
        </div>
      </div>
      <h3 className="font-display text-2xl font-semibold text-foreground mb-3">
        No Representatives Selected
      </h3>
      <p className="text-muted-foreground max-w-sm mb-8 leading-relaxed">
        Return to research to select the representatives you&apos;d like to contact about your issue.
      </p>
      <Button asChild size="lg" className="gap-2">
        <Link href="/">
          <ArrowLeft className="size-4" />
          Back to Research
        </Link>
      </Button>
    </div>
  );
}

interface ActiveLegislatorHeroProps {
  item: QueueItem;
  onMethodChange: (method: ContactMethod) => void;
  onMarkContacted: (outcome: ContactOutcome, notes?: string) => void;
  queuePosition: number;
  totalCount: number;
}

function ActiveLegislatorHero({
  item,
  onMethodChange,
  onMarkContacted,
  queuePosition,
  totalCount,
}: ActiveLegislatorHeroProps) {
  const { legislator } = item;
  const availability = getContactAvailability(legislator);
  const effectiveMethod = getEffectiveContactMethod(item);
  const [copied, setCopied] = React.useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = React.useState(false);

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

  const handleConfirmContact = (outcome: ContactOutcome, notes?: string) => {
    onMarkContacted(outcome, notes);
    setShowConfirmDialog(false);
  };

  const partyLabel = legislator.party === "D" ? "Democrat" : legislator.party === "R" ? "Republican" : "Independent";
  const chamberLabel = legislator.chamber === "House" ? "Representative" : "Senator";
  const location = legislator.district ? `${legislator.state}-${legislator.district}` : legislator.state;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="relative"
      >
        {/* Decorative background gradient */}
        <div className="absolute -inset-4 bg-gradient-to-br from-copper/5 via-transparent to-gold/5 rounded-3xl blur-2xl pointer-events-none" />

        <div className="relative bg-card border border-border rounded-2xl overflow-hidden">
          {/* Header strip */}
          <div className="bg-gradient-to-r from-muted/50 to-muted/30 px-6 py-3 border-b border-border">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Now Contacting
                </span>
                <span className="text-xs text-muted-foreground/60">
                  {queuePosition} of {totalCount}
                </span>
              </div>
              {availability.hasBoth && (
                <ContactMethodSelector
                  value={effectiveMethod}
                  onChange={onMethodChange}
                  hasPhone={availability.hasPhone}
                  hasEmail={availability.hasEmail}
                  size="sm"
                />
              )}
            </div>
          </div>

          {/* Main content */}
          <div className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-start gap-6">
              {/* Legislator info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="relative flex-shrink-0">
                    <div className={cn(
                      "size-16 sm:size-20 rounded-full flex items-center justify-center text-xl sm:text-2xl font-display font-bold",
                      legislator.party === "D" && "bg-blue-500/10 text-blue-400 ring-2 ring-blue-500/30",
                      legislator.party === "R" && "bg-red-500/10 text-red-400 ring-2 ring-red-500/30",
                      legislator.party === "I" && "bg-purple-500/10 text-purple-400 ring-2 ring-purple-500/30"
                    )}>
                      {legislator.name.split(" ").map(n => n[0]).slice(0, 2).join("")}
                    </div>
                  </div>

                  {/* Name and details */}
                  <div className="flex-1 min-w-0">
                    <h2 className="font-display text-2xl sm:text-3xl font-bold text-foreground leading-tight">
                      {legislator.name}
                    </h2>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
                      <span>{chamberLabel}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{partyLabel}</span>
                      <span className="text-muted-foreground/40">·</span>
                      <span>{location}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact action area */}
            <div className="mt-6 pt-6 border-t border-border">
              <div className="flex flex-col sm:flex-row gap-4">
                {/* Contact info box */}
                {contactInfo && (
                  <div className="flex-1 flex items-center gap-3 px-4 py-3 rounded-xl bg-muted/50 border border-border">
                    <div className="flex-shrink-0">
                      {effectiveMethod === "call" ? (
                        <Phone className="size-5 text-copper" />
                      ) : (
                        <Mail className="size-5 text-copper" />
                      )}
                    </div>
                    <span className="flex-1 font-mono text-sm text-foreground truncate">
                      {contactInfo}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={handleCopy}
                      className="flex-shrink-0"
                    >
                      {copied ? (
                        <CheckCircle2 className="size-4 text-green-500" />
                      ) : (
                        <Copy className="size-4" />
                      )}
                    </Button>
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-3 flex-shrink-0">
                  {contactInfo && (
                    <Button size="lg" asChild className="gap-2 flex-1 sm:flex-initial">
                      <a href={effectiveMethod === "call" ? `tel:${contactInfo}` : `mailto:${contactInfo}`}>
                        {effectiveMethod === "call" ? (
                          <>
                            <Phone className="size-4" />
                            Call Now
                          </>
                        ) : (
                          <>
                            <Mail className="size-4" />
                            Open Email
                          </>
                        )}
                      </a>
                    </Button>
                  )}
                  <Button
                    size="lg"
                    variant="secondary"
                    onClick={() => setShowConfirmDialog(true)}
                    className="gap-2 flex-1 sm:flex-initial"
                  >
                    <CheckCircle2 className="size-4" />
                    <span className="hidden sm:inline">Mark Complete</span>
                    <span className="sm:hidden">Done</span>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <MarkCompleteDialog
        open={showConfirmDialog}
        onOpenChange={setShowConfirmDialog}
        legislator={legislator}
        contactMethod={effectiveMethod}
        onConfirm={handleConfirmContact}
        onCancel={() => setShowConfirmDialog(false)}
      />
    </>
  );
}

interface QueuePanelProps {
  isOpen: boolean;
  onClose: () => void;
  contactedCount: number;
  totalCount: number;
  defaultContactMethod: ContactMethod;
  onSetDefaultMethod: (method: ContactMethod, applyToAll?: boolean) => void;
}

function QueuePanel({
  isOpen,
  onClose,
  contactedCount,
  totalCount,
  defaultContactMethod,
  onSetDefaultMethod,
}: QueuePanelProps) {
  const progress = totalCount > 0 ? (contactedCount / totalCount) * 100 : 0;

  return (
    <>
      {/* Mobile backdrop */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* Panel */}
      <motion.aside
        initial={false}
        animate={{
          x: isOpen ? 0 : "100%",
          opacity: isOpen ? 1 : 0,
        }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className={cn(
          "fixed right-0 top-0 bottom-0 w-full max-w-[400px] bg-card border-l border-border z-50 flex flex-col",
          "lg:relative lg:z-auto lg:translate-x-0 lg:opacity-100 lg:max-w-none lg:w-[380px] lg:flex-shrink-0",
          !isOpen && "lg:hidden"
        )}
      >
        {/* Panel header */}
        <div className="flex-shrink-0 px-5 py-4 border-b border-border bg-muted/30">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-display text-lg font-semibold text-foreground">
                Contact Queue
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {contactedCount} of {totalCount} completed
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={onClose}
              className="lg:hidden"
            >
              <X className="size-4" />
            </Button>
          </div>

          {/* Progress bar */}
          <div className="relative h-2 bg-muted rounded-full overflow-hidden">
            <motion.div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-copper to-gold rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.5, ease: "easeOut" }}
            />
          </div>

          {/* Default method selector */}
          {totalCount > 1 && (
            <div className="mt-4 flex items-center justify-between gap-3 pt-3 border-t border-border">
              <span className="text-xs font-medium text-muted-foreground">Default method</span>
              <div className="flex items-center gap-2">
                <ContactMethodSelector
                  value={defaultContactMethod}
                  onChange={(method) => onSetDefaultMethod(method, false)}
                  hasPhone={true}
                  hasEmail={true}
                  size="sm"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onSetDefaultMethod(defaultContactMethod, true)}
                  className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                >
                  Apply all
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Queue list */}
        <ScrollArea className="flex-1">
          <div className="p-4">
            <ContactQueue />
          </div>
        </ScrollArea>
      </motion.aside>
    </>
  );
}

function ContactPageContent() {
  const router = useRouter();
  const {
    currentStep,
    setCurrentStep,
    hasSelections,
    queue,
    initializeQueue,
    markCurrentContacted,
    contactedCount,
    isComplete,
    activeItem,
    setLegislatorContactMethod,
    setDefaultMethod,
    defaultContactMethod,
    researchContext,
    autoPopulatedFields,
  } = useContact();

  const [isSidebarOpen, setIsSidebarOpen] = React.useState(true);

  // Dev mode: Auto-load mock fixtures if no queue data exists
  React.useEffect(() => {
    if (autoLoadFixturesIfNeeded()) {
      window.location.reload();
    }
  }, []);

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

  // Navigate to /complete when session is complete
  React.useEffect(() => {
    if (isComplete && queue) {
      setCurrentStep("complete");
      router.push("/complete");
    }
  }, [isComplete, queue, router, setCurrentStep]);

  const handleBack = () => {
    setCurrentStep("research");
    router.push("/");
  };

  const handleMarkContacted = (outcome: ContactOutcome, notes?: string) => {
    markCurrentContacted(outcome, notes);
  };

  const totalCount = queue?.items.length ?? 0;
  const currentPosition = activeItem
    ? queue?.items.findIndex((i) => i.legislator.id === activeItem.legislator.id) ?? 0
    : 0;

  // Close sidebar on mobile by default
  React.useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 1024) {
        setIsSidebarOpen(false);
      }
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden">
      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Compact header */}
        <header className="flex-shrink-0 border-b border-border bg-background">
          <div className="px-4 sm:px-6 py-3">
            <div className="flex items-center justify-between gap-4">
              {/* Back button and title */}
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleBack}
                  className="rounded-full"
                >
                  <ArrowLeft className="size-4" />
                </Button>
                <div>
                  <h1 className="font-display text-lg sm:text-xl font-bold text-foreground">
                    Contact Representatives
                  </h1>
                </div>
              </div>

              {/* Progress and queue toggle */}
              <div className="flex items-center gap-3">
                {queue && (
                  <>
                    {/* Progress indicator */}
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="flex items-center gap-1.5">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <motion.div
                            className="h-full bg-copper rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${totalCount > 0 ? (contactedCount / totalCount) * 100 : 0}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          {contactedCount}/{totalCount}
                        </span>
                      </div>
                    </div>

                    {/* Queue toggle */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                      className="gap-2"
                    >
                      <Users className="size-4" />
                      <span className="hidden sm:inline">Queue</span>
                      <span className="sm:hidden">{contactedCount}/{totalCount}</span>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Scrollable content */}
        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {!hasSelections && !queue ? (
              <EmptyState />
            ) : (
              <div className="space-y-8">
                {/* Active legislator hero */}
                {activeItem && (
                  <ActiveLegislatorHero
                    item={activeItem}
                    onMethodChange={(method) =>
                      setLegislatorContactMethod(activeItem.legislator.id, method)
                    }
                    onMarkContacted={handleMarkContacted}
                    queuePosition={currentPosition + 1}
                    totalCount={totalCount}
                  />
                )}

                {/* AI Content Generation */}
                {activeItem && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.1, ease: "easeOut" }}
                  >
                    <ContentGenerationPanel
                      activeItem={activeItem}
                      contactMethod={getEffectiveContactMethod(activeItem)}
                      researchContext={researchContext}
                      autoPopulatedFields={autoPopulatedFields}
                    />
                  </motion.div>
                )}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Queue sidebar */}
      {queue && (
        <QueuePanel
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
          contactedCount={contactedCount}
          totalCount={totalCount}
          defaultContactMethod={defaultContactMethod}
          onSetDefaultMethod={setDefaultMethod}
        />
      )}
    </div>
  );
}

export default function ContactPage() {
  const { researchContext, advocacyContext } = useContact();

  return (
    <ContactContentProvider
      initialResearchContext={researchContext}
      initialAdvocacyContext={advocacyContext}
    >
      <ContactPageContent />
    </ContactContentProvider>
  );
}
