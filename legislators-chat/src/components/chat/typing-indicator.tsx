"use client";

import * as React from "react";
import { motion } from "framer-motion";
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
  initial: { opacity: 0.3 },
  animate: { opacity: 1 },
};

const dotTransition = {
  duration: 0.5,
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
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white border border-border/50 overflow-hidden"
        aria-hidden="true"
      >
        <img
          src="/mindy_media_kit/logos/mindy_icon_color.png"
          alt="mindy"
          width={32}
          height={32}
          className="object-contain"
        />
      </div>

      {/* Typing bubble */}
      <div className="flex flex-col gap-1 items-start">
        <span className="text-[10px] font-medium text-muted-foreground/70 uppercase tracking-wider px-0.5">
          mindy
        </span>
        <div className="flex items-center gap-1.5 rounded-xl rounded-tl-sm bg-card border border-border px-4 py-3 card-shadow">
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
              className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"
            />
          ))}
          <span className="sr-only">Assistant is typing...</span>
        </div>
      </div>
    </motion.div>
  );
}
