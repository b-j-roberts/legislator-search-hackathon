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
  AlertCircle,
  CheckCircle2,
  Copy,
  PanelRightClose,
  PanelRightOpen,
  ListOrdered,
  GripVertical,
} from "lucide-react";

import { useContact, getEffectiveContactMethod, getContactAvailability } from "@/hooks/use-contact";
import { ContactContentProvider } from "@/hooks/use-contact-content";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ContactQueue, ContactMethodSelector, ContentGenerationPanel, MarkCompleteDialog } from "@/components/contact";
import type { ContactOutcome } from "@/components/contact";

import type { QueueItem } from "@/hooks/use-contact";
import type { ContactMethod } from "@/lib/types";
import {
  loadUIPreferences,
  saveUIPreferences,
  QUEUE_WIDTH_MIN,
  QUEUE_WIDTH_MAX,
} from "@/lib/ui-preferences";

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
  onMarkContacted: (outcome: ContactOutcome, notes?: string) => void;
}

function ActiveContactPanel({ item, onMethodChange, onMarkContacted }: ActiveContactPanelProps) {
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

  return (
    <>
      <Card className="border-primary/50 bg-primary/5">
        <CardContent className="pt-4 pb-4">
          <div className="flex flex-col gap-4">
            {/* Header with name and method selector */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="rounded-full bg-primary p-2.5">
                  {effectiveMethod === "call" ? (
                    <Phone className="size-5 text-primary-foreground" />
                  ) : (
                    <Mail className="size-5 text-primary-foreground" />
                  )}
                </div>
                <div>
                  <p className="text-lg font-semibold text-foreground">{legislator.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {legislator.chamber === "House" ? "Representative" : "Senator"} •{" "}
                    {legislator.party === "D" ? "Democrat" : legislator.party === "R" ? "Republican" : "Independent"} •{" "}
                    {legislator.state}
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
              <Button onClick={() => setShowConfirmDialog(true)} className="gap-1.5">
                <CheckCircle2 className="size-4" />
                Mark as Contacted
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
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

interface QueueSidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  contactedCount: number;
  totalCount: number;
  defaultContactMethod: ContactMethod;
  onSetDefaultMethod: (method: ContactMethod, applyToAll?: boolean) => void;
  width: number;
  onWidthChange: (width: number) => void;
}

function QueueSidebar({
  isOpen,
  onToggle,
  contactedCount,
  totalCount,
  defaultContactMethod,
  onSetDefaultMethod,
  width,
  onWidthChange,
}: QueueSidebarProps) {
  const [isResizing, setIsResizing] = React.useState(false);
  const sidebarRef = React.useRef<HTMLDivElement>(null);
  const widthRef = React.useRef(width);

  // Keep ref in sync with width prop
  React.useEffect(() => {
    widthRef.current = width;
  }, [width]);

  // Handle resize drag
  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      setIsResizing(true);

      const startX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const startWidth = widthRef.current;

      const handleMove = (moveEvent: MouseEvent | TouchEvent) => {
        const currentX =
          "touches" in moveEvent
            ? moveEvent.touches[0].clientX
            : moveEvent.clientX;
        // Dragging left increases width (sidebar is on right)
        const delta = startX - currentX;
        const newWidth = Math.max(
          QUEUE_WIDTH_MIN,
          Math.min(QUEUE_WIDTH_MAX, startWidth + delta)
        );
        onWidthChange(newWidth);
        widthRef.current = newWidth;
      };

      const handleEnd = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMove);
        document.removeEventListener("mouseup", handleEnd);
        document.removeEventListener("touchmove", handleMove);
        document.removeEventListener("touchend", handleEnd);
        // Save to localStorage when drag ends using ref for current value
        saveUIPreferences({ contactQueueWidth: widthRef.current });
      };

      document.addEventListener("mousemove", handleMove);
      document.addEventListener("mouseup", handleEnd);
      document.addEventListener("touchmove", handleMove);
      document.addEventListener("touchend", handleEnd);
    },
    [onWidthChange]
  );

  return (
    <>
      {/* Mobile toggle button */}
      <Button
        variant="outline"
        size="sm"
        onClick={onToggle}
        className="fixed right-4 top-20 z-40 gap-1.5 shadow-lg lg:hidden"
      >
        {isOpen ? <PanelRightClose className="size-4" /> : <PanelRightOpen className="size-4" />}
        <span className="sr-only">{isOpen ? "Close queue" : "Open queue"}</span>
        {!isOpen && (
          <Badge variant="secondary" className="ml-1">
            {contactedCount}/{totalCount}
          </Badge>
        )}
      </Button>

      {/* Desktop expand button - shown when sidebar is collapsed */}
      {!isOpen && (
        <div className="hidden lg:flex items-start pt-3 pr-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8"
            title="Expand contact queue"
          >
            <PanelRightOpen className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Sidebar - mobile: slide-in drawer, desktop: side panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop for mobile */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
              onClick={onToggle}
            />

            {/* Resize handle - desktop only */}
            <div
              onMouseDown={handleResizeStart}
              onTouchStart={handleResizeStart}
              className={`hidden lg:flex items-center justify-center w-1 hover:w-1.5 bg-border hover:bg-primary/50 cursor-col-resize transition-all group ${
                isResizing ? "w-1.5 bg-primary/50" : ""
              }`}
            >
              <GripVertical
                className={`h-6 w-4 text-muted-foreground/50 group-hover:text-primary transition-colors ${
                  isResizing ? "text-primary" : ""
                }`}
              />
            </div>

            {/* Sidebar panel */}
            <motion.aside
              ref={sidebarRef}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{ width: `${width}px` }}
              className="fixed right-0 top-0 bottom-0 w-full max-w-[500px] bg-background border-l border-border z-50 flex flex-col shadow-2xl lg:relative lg:shadow-none lg:z-auto lg:border-l-0"
            >
              {/* Sidebar header */}
              <div className="flex-shrink-0 px-3 py-2 border-b border-border bg-muted/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ListOrdered className="size-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Queue</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {contactedCount}/{totalCount}
                    </Badge>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={onToggle}
                      title="Collapse queue"
                    >
                      <PanelRightClose className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-2">
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${totalCount > 0 ? (contactedCount / totalCount) * 100 : 0}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  </div>
                </div>
              </div>

              {/* Default method preference - compact row */}
              {totalCount > 1 && (
                <div className="flex-shrink-0 px-3 py-2 border-b border-border">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-muted-foreground">Default</p>
                    <div className="flex items-center gap-1.5">
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
                        className="text-xs h-7 px-2"
                      >
                        Apply All
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Queue list */}
              <ScrollArea className="flex-1">
                <div className="p-3">
                  <ContactQueue />
                </div>
              </ScrollArea>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
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
  const [sidebarWidth, setSidebarWidth] = React.useState(384); // Default width

  // Load UI preferences from localStorage on mount
  React.useEffect(() => {
    const prefs = loadUIPreferences();
    setSidebarWidth(prefs.contactQueueWidth);
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

  // Calculate progress text
  const progressText = queue
    ? isComplete
      ? `All ${totalCount} representative${totalCount !== 1 ? "s" : ""} contacted`
      : `${contactedCount} of ${totalCount} contacted`
    : "Loading...";

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="px-4 py-4">
          <div className="mb-3">
            <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5">
              <ArrowLeft className="size-4" />
              Back to Research
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">
                Contact Your Representatives
              </h1>
              <p className="text-muted-foreground mt-0.5">{progressText}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main content area with sidebar */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="max-w-3xl mx-auto px-4 py-6">
              {!hasSelections && !queue ? (
                <EmptyState />
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Queue sidebar toggle for desktop (when closed) */}
                  <div className="hidden lg:flex lg:justify-end">
                    {!isSidebarOpen && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsSidebarOpen(true)}
                        className="gap-1.5"
                      >
                        <PanelRightOpen className="size-4" />
                        Show Queue
                        <Badge variant="secondary" className="ml-1">
                          {contactedCount}/{totalCount}
                        </Badge>
                      </Button>
                    )}
                  </div>

                  {/* Active contact panel */}
                  {activeItem && (
                    <ActiveContactPanel
                      item={activeItem}
                      onMethodChange={(method) =>
                        setLegislatorContactMethod(activeItem.legislator.id, method)
                      }
                      onMarkContacted={handleMarkContacted}
                    />
                  )}

                  {/* AI Content Generation */}
                  {activeItem && (
                    <ContentGenerationPanel
                      activeItem={activeItem}
                      contactMethod={getEffectiveContactMethod(activeItem)}
                      researchContext={researchContext}
                      autoPopulatedFields={autoPopulatedFields}
                    />
                  )}
                </motion.div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Queue sidebar */}
        {queue && (
          <QueueSidebar
            isOpen={isSidebarOpen}
            onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
            contactedCount={contactedCount}
            totalCount={totalCount}
            defaultContactMethod={defaultContactMethod}
            onSetDefaultMethod={setDefaultMethod}
            width={sidebarWidth}
            onWidthChange={setSidebarWidth}
          />
        )}
      </div>
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
