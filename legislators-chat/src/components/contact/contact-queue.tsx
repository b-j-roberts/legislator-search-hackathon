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
import { Users, CheckCircle2, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { useContact } from "@/hooks/use-contact";
import { ContactQueueItem } from "./contact-queue-item";

export interface ContactQueueProps {
  className?: string;
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-gradient-to-br from-copper/10 to-gold/10 rounded-full blur-xl" />
        <div className="relative rounded-full bg-muted p-4 border border-border">
          <Users className="size-6 text-muted-foreground" />
        </div>
      </div>
      <h3 className="font-display text-base font-semibold text-foreground mb-1.5">
        Queue Empty
      </h3>
      <p className="text-sm text-muted-foreground max-w-[200px]">
        Select representatives from research to add them here.
      </p>
    </div>
  );
}

function CompletedState({ count }: { count: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-10 px-4 text-center"
    >
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-green-500/20 rounded-full blur-xl" />
        <div className="relative rounded-full bg-green-500/10 p-4 border border-green-500/20">
          <CheckCircle2 className="size-6 text-green-400" />
        </div>
      </div>
      <h3 className="font-display text-base font-semibold text-foreground mb-1.5">
        All Done!
      </h3>
      <p className="text-sm text-muted-foreground">
        You&apos;ve contacted all {count} representative{count !== 1 ? "s" : ""}.
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

  if (!queue || queue.items.length === 0) {
    return (
      <div className={cn("", className)}>
        <EmptyState />
      </div>
    );
  }

  if (isComplete) {
    return (
      <div className={cn("", className)}>
        <CompletedState count={queue.items.length} />
        <div className="mt-4 space-y-1">
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

  const pendingItems = queue.items.filter(
    (item) => item.status === "pending" || item.status === "active"
  );
  const completedItems = queue.items.filter(
    (item) => item.status === "contacted" || item.status === "skipped"
  );

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
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {pendingItems.map((item) => {
                const originalIndex = queue.items.findIndex(
                  (i) => i.legislator.id === item.legislator.id
                );
                return (
                  <motion.div
                    key={item.legislator.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
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

      {completedItems.length > 0 && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              Completed · {completedItems.length}
            </span>
            <div className="flex-1 h-px bg-border" />
          </div>
          <div className="space-y-1">
            <AnimatePresence mode="popLayout">
              {completedItems.map((item) => {
                const originalIndex = queue.items.findIndex(
                  (i) => i.legislator.id === item.legislator.id
                );
                return (
                  <motion.div
                    key={item.legislator.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
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
