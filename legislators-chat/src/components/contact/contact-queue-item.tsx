"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, Phone, Mail, SkipForward, X, Check, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Legislator, Party, ContactMethod } from "@/lib/types";
import type { ContactStatus } from "@/hooks/use-contact";
import { getContactAvailability } from "@/lib/queue-storage";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ContactMethodSelector, ContactMethodBadge } from "./contact-method-selector";

export interface ContactQueueItemProps {
  legislator: Legislator;
  status: ContactStatus;
  index: number;
  /** Current contact method for this legislator */
  contactMethod?: ContactMethod;
  /** Called when contact method changes */
  onContactMethodChange?: (method: ContactMethod) => void;
  onSkip?: () => void;
  onRemove?: () => void;
  onSetActive?: () => void;
}

const partyConfig: Record<Party, { label: string; color: string; bgColor: string }> = {
  D: { label: "D", color: "bg-blue-500", bgColor: "bg-blue-500/10 text-blue-400" },
  R: { label: "R", color: "bg-red-500", bgColor: "bg-red-500/10 text-red-400" },
  I: { label: "I", color: "bg-purple-500", bgColor: "bg-purple-500/10 text-purple-400" },
};

const statusConfig: Record<ContactStatus, { label: string; className: string }> = {
  pending: {
    label: "Pending",
    className: "bg-muted text-muted-foreground",
  },
  active: {
    label: "Current",
    className: "bg-primary text-primary-foreground",
  },
  contacted: {
    label: "Contacted",
    className: "bg-green-500/20 text-green-400",
  },
  skipped: {
    label: "Skipped",
    className: "bg-yellow-500/20 text-yellow-400",
  },
};

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function ContactQueueItem({
  legislator,
  status,
  index,
  contactMethod = "email",
  onContactMethodChange,
  onSkip,
  onRemove,
  onSetActive,
}: ContactQueueItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: legislator.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const { name, party, state, chamber, district, contact, imageUrl } = legislator;
  const partyColor = partyConfig[party].color;
  const location = district ? `${state}-${district}` : state;
  const isActive = status === "active";
  const isContacted = status === "contacted";

  // Get contact availability for this legislator
  const availability = getContactAvailability(legislator);
  const { hasPhone, hasEmail, hasBoth } = availability;

  // Handle method toggle for badge click
  const handleMethodToggle = () => {
    if (!hasBoth || !onContactMethodChange) return;
    onContactMethodChange(contactMethod === "call" ? "email" : "call");
  };

  // Handle card click to set active
  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger if clicking a button or link
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest('[role="button"]')
    ) {
      return;
    }
    // Don't switch if already active or contacted
    if (!isActive && !isContacted && onSetActive) {
      onSetActive();
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("touch-none", isDragging && "z-50")}>
      <Card
        onClick={handleCardClick}
        className={cn(
          "overflow-hidden transition-all",
          isActive && "ring-2 ring-primary bg-primary/5",
          isContacted && "opacity-60",
          isDragging && "shadow-lg rotate-1",
          // Make clickable when not active and not contacted
          !isActive && !isContacted && onSetActive && "cursor-pointer hover:bg-muted/50"
        )}
      >
        <CardHeader className="p-2.5 sm:p-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full">
            {/* Left controls group - always stays together */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              {/* Drag handle */}
              <button
                {...attributes}
                {...listeners}
                className={cn(
                  "cursor-grab active:cursor-grabbing p-1 rounded hover:bg-muted/50 transition-colors",
                  isContacted && "cursor-not-allowed opacity-50"
                )}
                aria-label="Drag to reorder"
                disabled={isContacted}
              >
                <GripVertical className="size-4 text-muted-foreground" />
              </button>

              {/* Queue position */}
              <div
                className={cn(
                  "size-6 rounded-full flex items-center justify-center text-xs font-medium",
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : isContacted
                      ? "bg-green-500/20 text-green-400"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {isContacted ? <Check className="size-3.5" /> : index + 1}
              </div>

              {/* Avatar with party color ring */}
              <div className={cn("rounded-full p-0.5", partyColor)}>
                <Avatar className="size-8 sm:size-10">
                  {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
                  <AvatarFallback className="text-xs sm:text-sm font-medium">
                    {getInitials(name)}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            {/* Info section - wraps to new line when narrow */}
            <div className="flex-1 min-w-[120px]">
              <CardTitle className="text-sm">{name}</CardTitle>
              <CardDescription className="text-xs flex items-center gap-1">
                <span>{location}</span>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] px-1 py-0 h-3.5 ml-1",
                    partyConfig[party].bgColor
                  )}
                >
                  {partyConfig[party].label}
                </Badge>
              </CardDescription>
            </div>

            {/* Right controls group - contact badge and remove */}
            <div className="flex items-center gap-1.5 flex-shrink-0 ml-auto">
              {/* Contact method badge - compact view */}
              {!isContacted && (
                <ContactMethodBadge
                  method={contactMethod}
                  hasPhone={hasPhone}
                  hasEmail={hasEmail}
                  onToggle={hasBoth ? handleMethodToggle : undefined}
                />
              )}

              {/* Remove button */}
              {onRemove && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onRemove}
                  aria-label={`Remove ${name} from queue`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Expanded contact info on mobile for active item */}
          {isActive && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              className="sm:hidden mt-3 pt-3 border-t border-border"
            >
              {/* Contact method selector for mobile */}
              {hasBoth && onContactMethodChange && (
                <div className="flex justify-center mb-3">
                  <ContactMethodSelector
                    value={contactMethod}
                    onChange={onContactMethodChange}
                    hasPhone={hasPhone}
                    hasEmail={hasEmail}
                    size="default"
                  />
                </div>
              )}

              {/* Primary action button based on selected method */}
              <div className="flex gap-2">
                {contactMethod === "call" && hasPhone ? (
                  <Button variant="default" size="sm" asChild className="flex-1 gap-1.5">
                    <a href={`tel:${contact.phone}`}>
                      <Phone className="size-3.5" />
                      Call {name.split(" ")[0]}
                    </a>
                  </Button>
                ) : hasEmail ? (
                  <Button variant="default" size="sm" asChild className="flex-1 gap-1.5">
                    <a href={`mailto:${contact.email}`}>
                      <Mail className="size-3.5" />
                      Email {name.split(" ")[0]}
                    </a>
                  </Button>
                ) : hasPhone ? (
                  <Button variant="default" size="sm" asChild className="flex-1 gap-1.5">
                    <a href={`tel:${contact.phone}`}>
                      <Phone className="size-3.5" />
                      Call {name.split(" ")[0]}
                    </a>
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground text-center flex-1">
                    No contact methods available
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </CardHeader>
      </Card>
    </div>
  );
}
