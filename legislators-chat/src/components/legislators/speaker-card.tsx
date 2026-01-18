"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { User, Building2, FileText, Mic, ExternalLink, Calendar } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Speaker, Chamber } from "@/lib/types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

export interface SpeakerCardProps {
  speaker: Speaker;
  className?: string;
}

const chamberConfig: Record<Chamber, { label: string; className: string }> = {
  House: {
    label: "House",
    className: "bg-amber-900/50 text-amber-400 border-amber-700",
  },
  Senate: {
    label: "Senate",
    className: "bg-indigo-900/50 text-indigo-400 border-indigo-700",
  },
};

const contentTypeLabels: Record<string, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
  hearing: { label: "Hearing", icon: Building2 },
  floor_speech: { label: "Floor Speech", icon: Mic },
  vote: { label: "Vote", icon: FileText },
};

function getInitials(name: string): string {
  // Remove common prefixes before getting initials
  const cleanName = name
    .replace(/^(Sen\.|Senator|Rep\.|Representative|Mr\.|Mrs\.|Ms\.|Dr\.)\s*/i, "")
    .trim();

  return cleanName
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function formatDateRange(dateRange?: { earliest?: string; latest?: string }): string | null {
  if (!dateRange?.earliest) return null;

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
      });
    } catch {
      return d;
    }
  };

  if (dateRange.earliest === dateRange.latest) {
    return formatDate(dateRange.earliest);
  }

  return `${formatDate(dateRange.earliest)} - ${formatDate(dateRange.latest!)}`;
}

export function SpeakerCard({ speaker, className }: SpeakerCardProps) {
  const {
    name,
    chamber,
    resultCount,
    contentTypes,
    committees,
    dateRange,
    sampleSourceUrls,
    imageUrl,
  } = speaker;

  const dateRangeStr = formatDateRange(dateRange);
  const hasSourceUrl = sampleSourceUrls.length > 0;

  const handleClick = () => {
    if (hasSourceUrl) {
      window.open(sampleSourceUrls[0], "_blank", "noopener,noreferrer");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <Card
        className={cn(
          "overflow-hidden transition-all hover:border-accent/30 hover:shadow-md",
          hasSourceUrl && "cursor-pointer",
          className
        )}
        onClick={hasSourceUrl ? handleClick : undefined}
      >
        <CardHeader>
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <div className="rounded-full p-0.5 bg-muted">
              <Avatar className="size-10">
                {imageUrl && <AvatarImage src={imageUrl} alt={name} />}
                <AvatarFallback className="text-sm font-medium bg-secondary">
                  {getInitials(name)}
                </AvatarFallback>
              </Avatar>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base truncate">{name}</CardTitle>
                {hasSourceUrl && (
                  <ExternalLink className="size-4 text-muted-foreground/50 group-hover:text-accent shrink-0 transition-colors" />
                )}
              </div>
              <CardDescription className="flex items-center gap-1.5 mt-0.5">
                {chamber && (
                  <>
                    <Building2 className="size-3" />
                    <span>{chamber}</span>
                  </>
                )}
                {resultCount > 1 && (
                  <>
                    {chamber && <span className="text-muted-foreground/50">·</span>}
                    <span>{resultCount} results</span>
                  </>
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          {/* Content type badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {chamber && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-medium",
                  chamberConfig[chamber].className
                )}
              >
                {chamberConfig[chamber].label}
              </Badge>
            )}
            {contentTypes.map((type) => {
              const config = contentTypeLabels[type];
              if (!config) return null;
              const Icon = config.icon;
              return (
                <Badge
                  key={type}
                  variant="secondary"
                  className="text-[10px] font-medium gap-1"
                >
                  <Icon className="size-3" />
                  {config.label}
                </Badge>
              );
            })}
          </div>

          {/* Committees */}
          {committees.length > 0 && (
            <div className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground/80">Committees: </span>
              {committees.join(", ")}
            </div>
          )}

          {/* Date range */}
          {dateRangeStr && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="size-3" />
              <span>{dateRangeStr}</span>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
