"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { motion, AnimatePresence } from "framer-motion";
import { Users, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useContact } from "@/hooks/use-contact";
import { ContactQueueItem } from "./contact-queue-item";

export interface ContactQueueProps {
  className?: string;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="rounded-full bg-muted p-4 mb-4">
        <Users className="size-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">No representatives in queue</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        Select representatives from the research phase to add them to your contact queue.
      </p>
    </div>
  );
}

function CompletedState({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-12 px-4 text-center"
    >
      <div className="rounded-full bg-green-500/20 p-4 mb-4">
        <CheckCircle2 className="size-8 text-green-400" />
      </div>
      <h3 className="text-lg font-medium text-foreground mb-2">All representatives contacted</h3>
      <p className="text-sm text-muted-foreground max-w-xs">
        You&apos;ve reached out to all {count} representative{count !== 1 ? "s" : ""} in your queue.
      </p>
    </motion.div>
  );
}


export function ContactQueue({ className }: ContactQueueProps) {
  const {
    queue,
    reorderQueueItems,
    skipCurrentLegislator,
    removeFromQueueById,
    setActiveLegislator,
    isComplete,
    setLegislatorContactMethod,
  } = useContact();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id && queue) {
        const oldIndex = queue.items.findIndex((item) => item.legislator.id === active.id);
        const newIndex = queue.items.findIndex((item) => item.legislator.id === over.id);

        if (oldIndex !== -1 && newIndex !== -1) {
          reorderQueueItems(oldIndex, newIndex);
        }
      }
    },
    [queue, reorderQueueItems]
  );

  // No queue or empty queue
  if (!queue || queue.items.length === 0) {
    return (
      <div className={cn("", className)}>
        <EmptyState />
      </div>
    );
  }

  // All completed
  if (isComplete) {
    return (
      <div className={cn("", className)}>
        <CompletedState count={queue.items.length} />
        {/* Still show the list but in completed state */}
        <div className="mt-6 space-y-2">
          {queue.items.map((item, index) => (
            <ContactQueueItem
              key={item.legislator.id}
              legislator={item.legislator}
              status={item.status}
              index={index}
              contactMethod={item.contactMethod}
              onRemove={() => removeFromQueueById(item.legislator.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  // Separate pending/active items from completed items
  const pendingItems = queue.items.filter(
    (item) => item.status === "pending" || item.status === "active"
  );
  const completedItems = queue.items.filter(
    (item) => item.status === "contacted" || item.status === "skipped"
  );

  // Only include pending items in drag context (completed can't be reordered)
  const pendingItemIds = pendingItems.map((item) => item.legislator.id);

  return (
    <div className={cn("", className)}>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext items={pendingItemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {pendingItems.map((item) => {
                // Use original index for display
                const originalIndex = queue.items.findIndex(
                  (i) => i.legislator.id === item.legislator.id
                );
                return (
                  <motion.div
                    key={item.legislator.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    layout
                  >
                    <ContactQueueItem
                      legislator={item.legislator}
                      status={item.status}
                      index={originalIndex}
                      contactMethod={item.contactMethod}
                      onContactMethodChange={(method) =>
                        setLegislatorContactMethod(item.legislator.id, method)
                      }
                      onSkip={
                        item.status !== "contacted"
                          ? () => {
                              if (item.status === "active") {
                                skipCurrentLegislator();
                              } else {
                                // Move non-active pending item to end
                                reorderQueueItems(originalIndex, queue.items.length - 1);
                              }
                            }
                          : undefined
                      }
                      onRemove={() => removeFromQueueById(item.legislator.id)}
                      onSetActive={
                        item.status === "pending"
                          ? () => setActiveLegislator(item.legislator.id)
                          : undefined
                      }
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>

      {/* Completed items section with separator */}
      {completedItems.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium px-2">
              Completed ({completedItems.length})
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {completedItems.map((item) => {
                const originalIndex = queue.items.findIndex(
                  (i) => i.legislator.id === item.legislator.id
                );
                return (
                  <motion.div
                    key={item.legislator.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    layout
                  >
                    <ContactQueueItem
                      legislator={item.legislator}
                      status={item.status}
                      index={originalIndex}
                      contactMethod={item.contactMethod}
                      onRemove={() => removeFromQueueById(item.legislator.id)}
                    />
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      )}
    </div>
  );
}
