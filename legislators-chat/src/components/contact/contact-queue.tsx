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

function ProgressHeader({ contacted, total }: { contacted: number; total: number }) {
  const percentage = total > 0 ? (contacted / total) * 100 : 0;

  return (
    <div className="mb-4 space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Progress</span>
        <span className="font-medium text-foreground">
          {contacted} of {total} contacted
        </span>
      </div>
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-primary rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

export function ContactQueue({ className }: ContactQueueProps) {
  const {
    queue,
    reorderQueueItems,
    skipCurrentLegislator,
    removeFromQueueById,
    setActiveLegislator,
    contactedCount,
    isComplete,
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
        <ProgressHeader contacted={contactedCount} total={queue.items.length} />
        <CompletedState count={queue.items.length} />
        {/* Still show the list but in completed state */}
        <div className="mt-6 space-y-2">
          {queue.items.map((item, index) => (
            <ContactQueueItem
              key={item.legislator.id}
              legislator={item.legislator}
              status={item.status}
              index={index}
              onRemove={() => removeFromQueueById(item.legislator.id)}
            />
          ))}
        </div>
      </div>
    );
  }

  const itemIds = queue.items.map((item) => item.legislator.id);

  return (
    <div className={cn("", className)}>
      <ProgressHeader contacted={contactedCount} total={queue.items.length} />

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
      >
        <SortableContext items={itemIds} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            <AnimatePresence mode="popLayout">
              {queue.items.map((item, index) => (
                <motion.div
                  key={item.legislator.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2, delay: index * 0.03 }}
                  layout
                >
                  <ContactQueueItem
                    legislator={item.legislator}
                    status={item.status}
                    index={index}
                    onSkip={
                      item.status !== "contacted"
                        ? () => {
                            if (item.status === "active") {
                              skipCurrentLegislator();
                            } else {
                              // Move non-active pending item to end
                              reorderQueueItems(index, queue.items.length - 1);
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
              ))}
            </AnimatePresence>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
