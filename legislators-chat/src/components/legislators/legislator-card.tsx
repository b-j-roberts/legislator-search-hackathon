"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, Mail, Globe, ChevronDown, MapPin, Building2 } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Legislator, Party, Chamber } from "@/lib/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Checkbox } from "@/components/ui/checkbox";
import { StanceBadge } from "./stance-badge";
import { LeaningGaugeCompact } from "./leaning-gauge";

export interface LegislatorCardProps {
  legislator: Legislator;
  className?: string;
  defaultExpanded?: boolean;
  /** Whether the card is in selection mode */
  selectable?: boolean;
  /** Whether the legislator is selected */
  isSelected?: boolean;
  /** Callback when selection is toggled */
  onToggleSelect?: (legislator: Legislator) => void;
}

const partyConfig: Record<Party, { label: string; className: string; color: string }> = {
  D: {
    label: "Democrat",
    className: "bg-blue-900/50 text-blue-400 border-blue-700",
    color: "bg-blue-500",
  },
  R: {
    label: "Republican",
    className: "bg-red-900/50 text-red-400 border-red-700",
    color: "bg-red-500",
  },
  I: {
    label: "Independent",
    className: "bg-purple-900/50 text-purple-400 border-purple-700",
    color: "bg-purple-500",
  },
};

const chamberLabels: Record<Chamber, string> = {
  House: "Representative",
  Senate: "Senator",
};

const cardVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const expandVariants = {
  collapsed: { height: 0, opacity: 0 },
  expanded: { height: "auto", opacity: 1 },
};

function PartyBadge({ party, className }: { party: Party; className?: string }) {
  const config = partyConfig[party];
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-full border px-2 py-0.5 text-xs font-medium",
        config.className,
        className
      )}
    >
      {config.label}
    </span>
  );
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function LegislatorCard({
  legislator,
  className,
  defaultExpanded = false,
  selectable = false,
  isSelected = false,
  onToggleSelect,
}: LegislatorCardProps) {
  const [isExpanded, setIsExpanded] = React.useState(defaultExpanded);

  const {
    name,
    party,
    state,
    chamber,
    district,
    stance,
    stanceSummary,
    leaningScore,
    contact,
    imageUrl,
    termStart,
    nextElection,
  } = legislator;

  const partyColor = partyConfig[party].color;
  const title = chamberLabels[chamber];
  const location = district ? `${state}-${district}` : state;

  const handleCall = () => {
    if (contact.phone) {
      window.location.href = `tel:${contact.phone}`;
    }
  };

  const handleEmail = () => {
    if (contact.email) {
      window.location.href = `mailto:${contact.email}`;
    }
  };

  const handleWebsite = () => {
    if (contact.website) {
      window.open(contact.website, "_blank", "noopener,noreferrer");
    }
  };

  const handleToggleSelect = () => {
    onToggleSelect?.(legislator);
  };

  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "overflow-hidden transition-colors",
          isSelected && "ring-2 ring-primary bg-primary/5",
          selectable && "cursor-pointer",
          className
        )}
        onClick={selectable ? handleToggleSelect : undefined}
      >
        <CardHeader>
          <div className="flex items-start gap-3">
            {/* Selection checkbox */}
            {selectable && (
              <div className="flex-shrink-0 pt-1" onClick={(e) => e.stopPropagation()}>
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={handleToggleSelect}
                  aria-label={`Select ${name}`}
                  className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                />
              </div>
            )}

            {/* Avatar with party color ring */}
            <div className={cn("rounded-full p-0.5", partyColor)}>
              <Avatar className="size-12">
                {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
                <AvatarFallback className="text-sm font-medium">{getInitials(name)}</AvatarFallback>
              </Avatar>
            </div>

            <div className="flex-1 min-w-0">
              <CardTitle className="text-base truncate">{name}</CardTitle>
              <CardDescription className="flex items-center gap-1.5 mt-0.5">
                <span>{title}</span>
                <span className="text-muted-foreground/50">·</span>
                <span className="flex items-center gap-1">
                  <MapPin className="size-3" />
                  {location}
                </span>
              </CardDescription>
            </div>
          </div>

          <CardAction>
            {leaningScore !== undefined ? (
              <LeaningGaugeCompact score={leaningScore} />
            ) : (
              <StanceBadge stance={stance} />
            )}
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Badges row */}
          <div className="flex items-center gap-2 flex-wrap">
            <PartyBadge party={party} />
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <Building2 className="size-3" />
              {chamber}
            </span>
          </div>

          {/* Stance summary */}
          {stanceSummary && (
            <p className="text-sm text-muted-foreground leading-relaxed">{stanceSummary}</p>
          )}

          {/* Contact buttons */}
          <div className="flex items-center gap-2">
            {contact.phone && (
              <Button variant="outline" size="sm" onClick={handleCall} className="gap-1.5">
                <Phone className="size-3.5" />
                Call
              </Button>
            )}
            {contact.email && (
              <Button variant="outline" size="sm" onClick={handleEmail} className="gap-1.5">
                <Mail className="size-3.5" />
                Email
              </Button>
            )}
            {contact.website && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleWebsite}
                aria-label="Visit website"
              >
                <Globe className="size-4" />
              </Button>
            )}
          </div>

          {/* Expand/collapse button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-full justify-center text-muted-foreground hover:text-foreground"
          >
            <span>{isExpanded ? "Show less" : "Show more"}</span>
            <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronDown className="size-4" />
            </motion.div>
          </Button>

          {/* Expanded details */}
          <AnimatePresence>
            {isExpanded && (
              <motion.div
                variants={expandVariants}
                initial="collapsed"
                animate="expanded"
                exit="collapsed"
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="space-y-3 pt-2 border-t border-border">
                  {/* Office address */}
                  {contact.office && (
                    <div className="text-sm">
                      <span className="font-medium text-foreground">Office:</span>
                      <p className="text-muted-foreground mt-0.5">{contact.office}</p>
                    </div>
                  )}

                  {/* Phone (displayed as text when expanded) */}
                  {contact.phone && (
                    <div className="text-sm">
                      <span className="font-medium text-foreground">Phone:</span>
                      <a
                        href={`tel:${contact.phone}`}
                        className="text-muted-foreground hover:text-foreground ml-2 transition-colors"
                      >
                        {contact.phone}
                      </a>
                    </div>
                  )}

                  {/* Email (displayed as text when expanded) */}
                  {contact.email && (
                    <div className="text-sm">
                      <span className="font-medium text-foreground">Email:</span>
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-muted-foreground hover:text-foreground ml-2 transition-colors truncate"
                      >
                        {contact.email}
                      </a>
                    </div>
                  )}

                  {/* Term info */}
                  {(termStart || nextElection) && (
                    <div className="flex gap-4 text-sm">
                      {termStart && (
                        <div>
                          <span className="font-medium text-foreground">Term started:</span>
                          <span className="text-muted-foreground ml-2">{termStart}</span>
                        </div>
                      )}
                      {nextElection && (
                        <div>
                          <span className="font-medium text-foreground">Next election:</span>
                          <span className="text-muted-foreground ml-2">{nextElection}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Social media */}
                  {contact.socialMedia && Object.keys(contact.socialMedia).length > 0 && (
                    <div className="text-sm">
                      <span className="font-medium text-foreground">Social:</span>
                      <div className="flex gap-3 mt-1">
                        {contact.socialMedia.twitter && (
                          <a
                            href={`https://twitter.com/${contact.socialMedia.twitter}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-muted-foreground hover:text-foreground transition-colors"
                          >
                            @{contact.socialMedia.twitter}
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
