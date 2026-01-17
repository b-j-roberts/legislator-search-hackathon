"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Users } from "lucide-react";

import { cn } from "@/lib/utils";
import type { Legislator } from "@/lib/types";
import { LegislatorCard } from "@/components/legislators";
import { LegislatorCardSkeleton } from "./legislator-card-skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface LegislatorListProps {
  legislators: Legislator[];
  isLoading?: boolean;
  className?: string;
  skeletonCount?: number;
  /** Custom message when list is empty */
  emptyMessage?: string;
}

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95 },
};

function EmptyState({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Users className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">
        No legislators found
      </h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        {message || "Ask about a topic or issue to discover relevant legislators and their stances."}
      </p>
    </div>
  );
}

function LoadingState({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4 p-4">
      {Array.from({ length: count }).map((_, index) => (
        <LegislatorCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function LegislatorList({
  legislators,
  isLoading = false,
  className,
  skeletonCount = 3,
  emptyMessage,
}: LegislatorListProps) {
  if (isLoading) {
    return <LoadingState count={skeletonCount} />;
  }

  if (legislators.length === 0) {
    return <EmptyState message={emptyMessage} />;
  }

  return (
    <ScrollArea className={cn("flex-1", className)}>
      <div className="space-y-4 p-4">
        <AnimatePresence mode="popLayout">
          {legislators.map((legislator, index) => (
            <motion.div
              key={legislator.id}
              variants={itemVariants}
              initial="hidden"
              animate="visible"
              exit="exit"
              layout
              transition={{
                duration: 0.2,
                delay: index * 0.03, // Stagger effect
              }}
            >
              <LegislatorCard legislator={legislator} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </ScrollArea>
  );
}
