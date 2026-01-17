"use client";

import { cn } from "@/lib/utils";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export interface LegislatorCardSkeletonProps {
  className?: string;
}

export function LegislatorCardSkeleton({ className }: LegislatorCardSkeletonProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader>
        <div className="flex items-start gap-3">
          {/* Avatar skeleton */}
          <Skeleton className="size-12 rounded-full" />

          <div className="flex-1 min-w-0 space-y-2">
            {/* Name */}
            <Skeleton className="h-5 w-32" />
            {/* Title and location */}
            <Skeleton className="h-4 w-40" />
          </div>

          {/* Stance badge */}
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Badges row */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-20 rounded-full" />
          <Skeleton className="h-4 w-16" />
        </div>

        {/* Stance summary */}
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>

        {/* Contact buttons */}
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="h-8 w-16 rounded-md" />
          <Skeleton className="size-8 rounded-md" />
        </div>

        {/* Show more button */}
        <Skeleton className="h-8 w-full rounded-md" />
      </CardContent>
    </Card>
  );
}
