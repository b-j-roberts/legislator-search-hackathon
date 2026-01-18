"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Phone, Mail, MessageSquare, AlertCircle } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { Legislator, ContactMethod } from "@/lib/types";

// =============================================================================
// Types
// =============================================================================

export type ContactOutcome = "successful" | "voicemail" | "no_answer" | "busy" | "sent";

interface MarkCompleteDialogProps {
  /** Whether the dialog is open */
  open: boolean;
  /** Callback when dialog open state changes */
  onOpenChange: (open: boolean) => void;
  /** The legislator being marked as contacted */
  legislator: Legislator;
  /** The contact method used */
  contactMethod: ContactMethod;
  /** Callback when contact is confirmed */
  onConfirm: (outcome: ContactOutcome, notes?: string) => void;
  /** Callback when cancelled */
  onCancel: () => void;
}

// =============================================================================
// Component
// =============================================================================

export function MarkCompleteDialog({
  open,
  onOpenChange,
  legislator,
  contactMethod,
  onConfirm,
  onCancel,
}: MarkCompleteDialogProps) {
  const [selectedOutcome, setSelectedOutcome] = React.useState<ContactOutcome | null>(null);
  const [notes, setNotes] = React.useState("");

  // Reset state when dialog opens
  React.useEffect(() => {
    if (open) {
      setSelectedOutcome(null);
      setNotes("");
    }
  }, [open]);

  const title = legislator.chamber === "Senate" ? "Senator" : "Rep.";

  const callOutcomes: { value: ContactOutcome; label: string; icon: React.ElementType }[] = [
    { value: "successful", label: "Spoke with someone", icon: CheckCircle2 },
    { value: "voicemail", label: "Left voicemail", icon: MessageSquare },
    { value: "no_answer", label: "No answer", icon: AlertCircle },
    { value: "busy", label: "Line busy", icon: Phone },
  ];

  const emailOutcomes: { value: ContactOutcome; label: string; icon: React.ElementType }[] = [
    { value: "sent", label: "Email sent", icon: CheckCircle2 },
  ];

  const outcomes = contactMethod === "call" ? callOutcomes : emailOutcomes;

  const handleConfirm = () => {
    if (selectedOutcome) {
      onConfirm(selectedOutcome, notes.trim() || undefined);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {contactMethod === "call" ? (
              <Phone className="size-5 text-primary" />
            ) : (
              <Mail className="size-5 text-primary" />
            )}
            Mark as Contacted
          </DialogTitle>
          <DialogDescription>
            How did your {contactMethod === "call" ? "call to" : "email to"} {title}{" "}
            {legislator.name} go?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Outcome selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Outcome</Label>
            <div className="grid gap-2">
              {outcomes.map(({ value, label, icon: Icon }) => (
                <motion.button
                  key={value}
                  type="button"
                  onClick={() => setSelectedOutcome(value)}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border text-left transition-colors",
                    selectedOutcome === value
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border bg-background hover:border-primary/50 hover:bg-muted/50"
                  )}
                  whileTap={{ scale: 0.98 }}
                >
                  <div
                    className={cn(
                      "rounded-full p-1.5",
                      selectedOutcome === value ? "bg-primary text-primary-foreground" : "bg-muted"
                    )}
                  >
                    <Icon className="size-4" />
                  </div>
                  <span className="text-sm font-medium">{label}</span>
                  {selectedOutcome === value && (
                    <CheckCircle2 className="size-4 ml-auto text-primary" />
                  )}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Optional notes */}
          <div className="space-y-2">
            <Label htmlFor="notes" className="text-sm font-medium">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </Label>
            <Textarea
              id="notes"
              placeholder={
                contactMethod === "call"
                  ? "Any details about the conversation..."
                  : "Any notes about this email..."
              }
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="resize-none"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedOutcome}
            className="gap-1.5"
          >
            <CheckCircle2 className="size-4" />
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
