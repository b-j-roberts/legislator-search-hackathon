"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";

export interface TypingIndicatorProps {
  className?: string;
}

const containerVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const dotVariants = {
  initial: { opacity: 0.4 },
  animate: { opacity: 1 },
};

const dotTransition = {
  duration: 0.4,
  repeat: Infinity,
  repeatType: "reverse" as const,
  ease: "easeInOut" as const,
};

export function TypingIndicator({ className }: TypingIndicatorProps) {
  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={{ duration: 0.2 }}
      className={cn("flex gap-3", className)}
    >
      {/* Avatar */}
      <div
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
        aria-hidden="true"
      >
        <Bot className="h-4 w-4" />
      </div>

      {/* Typing bubble */}
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
        {[0, 1, 2].map((index) => (
          <motion.span
            key={index}
            variants={dotVariants}
            initial="initial"
            animate="animate"
            transition={{
              ...dotTransition,
              delay: index * 0.15,
            }}
            className="h-2 w-2 rounded-full bg-muted-foreground"
          />
        ))}
        <span className="sr-only">Assistant is typing...</span>
      </div>
    </motion.div>
  );
}
