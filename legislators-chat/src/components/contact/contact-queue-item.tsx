"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { motion } from "framer-motion";
import { GripVertical, Phone, Mail, X, Check } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Legislator, Party, ContactMethod } from "@/lib/types";
import type { ContactStatus } from "@/hooks/use-contact";
import { getContactAvailability } from "@/lib/queue-storage";
import { Button } from "@/components/ui/button";

export interface ContactQueueItemProps {
  legislator: Legislator;
  status: ContactStatus;
  index: number;
  contactMethod?: ContactMethod;
  onContactMethodChange?: (method: ContactMethod) => void;
  onSkip?: () => void;
  onRemove?: () => void;
  onSetActive?: () => void;
}

const partyStyles: Record<Party, { ring: string; avatar: string; text: string }> = {
  D: {
    ring: "ring-blue-500/40",
    avatar: "bg-blue-500/10 text-blue-400",
    text: "text-blue-400",
  },
  R: {
    ring: "ring-red-500/40",
    avatar: "bg-red-500/10 text-red-400",
    text: "text-red-400",
  },
  I: {
    ring: "ring-purple-500/40",
    avatar: "bg-purple-500/10 text-purple-400",
    text: "text-purple-400",
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

  const { name, party, state, chamber, district } = legislator;
  const styles = partyStyles[party];
  const location = district ? `${state}-${district}` : state;
  const chamberLabel = chamber === "House" ? "Rep" : "Sen";
  const isActive = status === "active";
  const isContacted = status === "contacted";
  const isSkipped = status === "skipped";
  const isCompleted = isContacted || isSkipped;

  const availability = getContactAvailability(legislator);
  const { hasPhone, hasEmail, hasBoth } = availability;

  const handleMethodToggle = () => {
    if (!hasBoth || !onContactMethodChange) return;
    onContactMethodChange(contactMethod === "call" ? "email" : "call");
  };

  const handleClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("a") ||
      target.closest('[role="button"]')
    ) {
      return;
    }
    if (!isActive && !isCompleted && onSetActive) {
      onSetActive();
    }
  };

  return (
    <div ref={setNodeRef} style={style} className={cn("touch-none", isDragging && "z-50")}>
      <div
        onClick={handleClick}
        className={cn(
          "group relative rounded-xl transition-all duration-200 p-3",
          "border border-transparent",
          isActive && "bg-primary/5 border-primary/20 ring-1 ring-primary/10",
          isCompleted && "opacity-50",
          isDragging && "shadow-lg bg-card border-border rotate-1",
          !isActive && !isCompleted && onSetActive && "hover:bg-muted/50 cursor-pointer"
        )}
      >
        {/* Row 1: Drag + Position + Avatar + Name + Remove */}
        <div className="flex items-center gap-2">
          {/* Drag handle */}
          {!isCompleted ? (
            <button
              {...attributes}
              {...listeners}
              className={cn(
                "flex-shrink-0 cursor-grab active:cursor-grabbing p-0.5 rounded transition-colors",
                "text-muted-foreground/30 hover:text-muted-foreground",
                "opacity-0 group-hover:opacity-100",
                isActive && "opacity-100"
              )}
              aria-label="Drag to reorder"
            >
              <GripVertical className="size-3.5" />
            </button>
          ) : (
            <div className="w-[18px]" />
          )}

          {/* Position indicator */}
          <div
            className={cn(
              "flex-shrink-0 size-6 rounded-full flex items-center justify-center text-[11px] font-semibold",
              isActive && "bg-primary text-primary-foreground",
              isContacted && "bg-green-500/20 text-green-400",
              isSkipped && "bg-yellow-500/20 text-yellow-400",
              !isActive && !isCompleted && "bg-muted text-muted-foreground"
            )}
          >
            {isContacted ? (
              <Check className="size-3" />
            ) : isSkipped ? (
              <span className="text-[9px]">—</span>
            ) : (
              index + 1
            )}
          </div>

          {/* Avatar */}
          <div
            className={cn(
              "flex-shrink-0 size-8 rounded-full flex items-center justify-center text-xs font-display font-bold ring-2",
              styles.avatar,
              styles.ring
            )}
          >
            {getInitials(name)}
          </div>

          {/* Name - takes remaining space */}
          <p className={cn(
            "flex-1 min-w-0 text-sm font-medium text-foreground",
            isCompleted && "text-muted-foreground"
          )}>
            {name}
          </p>

          {/* Remove button */}
          {onRemove && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              aria-label={`Remove ${name} from queue`}
              className={cn(
                "flex-shrink-0 size-6 text-muted-foreground/30 hover:text-destructive",
                "opacity-0 group-hover:opacity-100 transition-opacity",
                isActive && "opacity-100"
              )}
            >
              <X className="size-3" />
            </Button>
          )}
        </div>

        {/* Row 2: Details (indented to align with name) */}
        <div className="mt-1 flex items-center gap-2 pl-[70px]">
          <span className="text-xs text-muted-foreground">
            {chamberLabel} · {location}
          </span>

          {/* Contact method indicator */}
          {!isCompleted && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleMethodToggle();
              }}
              disabled={!hasBoth}
              className={cn(
                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium transition-colors",
                contactMethod === "call"
                  ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                  : "bg-blue-500/10 text-blue-400 hover:bg-blue-500/20",
                !hasBoth && "cursor-default"
              )}
            >
              {contactMethod === "call" ? (
                <>
                  <Phone className="size-2.5" />
                  Call
                </>
              ) : (
                <>
                  <Mail className="size-2.5" />
                  Email
                </>
              )}
            </button>
          )}
        </div>

        {/* Active indicator line */}
        {isActive && (
          <motion.div
            layoutId="activeIndicator"
            className="absolute left-0 top-3 bottom-3 w-0.5 bg-primary rounded-full"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          />
        )}
      </div>
    </div>
  );
}
