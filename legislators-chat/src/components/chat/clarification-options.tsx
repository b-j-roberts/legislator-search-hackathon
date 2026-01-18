"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { HelpCircle, ChevronRight, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { ClarificationOption, ClarificationQuestion } from "@/lib/prompts/clarification";

export interface ClarificationOptionsProps {
  /** The clarification question with options */
  clarification: ClarificationQuestion;
  /** Callback when an option is selected */
  onSelect: (option: ClarificationOption) => void;
  /** Callback when user wants to provide custom input */
  onCustomInput?: () => void;
  /** Whether the options are disabled (e.g., already responded) */
  disabled?: boolean;
  /** Optional className */
  className?: string;
}

const containerVariants = {
  initial: { opacity: 0, y: 10 },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      staggerChildren: 0.05,
    },
  },
};

const optionVariants = {
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0 },
};

export function ClarificationOptions({
  clarification,
  onSelect,
  onCustomInput,
  disabled = false,
  className,
}: ClarificationOptionsProps) {
  const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);

  const handleSelect = (option: ClarificationOption, index: number) => {
    if (disabled) return;
    setSelectedIndex(index);
    onSelect(option);
  };

  return (
    <motion.div
      variants={containerVariants}
      initial="initial"
      animate="animate"
      className={cn("mt-4", className)}
    >
      {/* Options header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-accent/10">
          <Sparkles className="w-3 h-3 text-accent" />
        </div>
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
          Quick options
        </span>
      </div>

      {/* Option buttons */}
      <div className="flex flex-wrap gap-2">
        {clarification.options.map((option, index) => (
          <motion.button
            key={option.label}
            variants={optionVariants}
            onClick={() => handleSelect(option, index)}
            disabled={disabled}
            className={cn(
              "group flex items-center gap-2 px-4 py-2.5 rounded-xl",
              "text-sm font-medium transition-all duration-200",
              "border border-border/60 bg-card/60 hover:bg-card hover:border-accent/30",
              "hover:shadow-md active:scale-[0.98]",
              disabled && "opacity-50 cursor-not-allowed",
              selectedIndex === index && "bg-accent/10 border-accent text-accent"
            )}
          >
            <span className="text-foreground group-hover:text-foreground">
              {option.label}
            </span>
            <ChevronRight
              className={cn(
                "w-3.5 h-3.5 text-muted-foreground/40",
                "group-hover:text-accent group-hover:translate-x-0.5",
                "transition-all"
              )}
            />
          </motion.button>
        ))}
      </div>

      {/* Custom input option */}
      {onCustomInput && (
        <motion.div
          variants={optionVariants}
          className="mt-3"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={onCustomInput}
            disabled={disabled}
            className="text-xs text-muted-foreground hover:text-foreground h-8 px-3"
          >
            <HelpCircle className="w-3.5 h-3.5 mr-1.5" />
            Something else...
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}

/**
 * Inline clarification options that render within the chat bubble
 * This is a simpler version for embedding in message content
 */
export interface InlineClarificationProps {
  options: ClarificationOption[];
  onSelect: (option: ClarificationOption) => void;
  disabled?: boolean;
}

export function InlineClarificationOptions({
  options,
  onSelect,
  disabled = false,
}: InlineClarificationProps) {
  return (
    <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/40">
      {options.map((option) => (
        <button
          key={option.label}
          onClick={() => onSelect(option)}
          disabled={disabled}
          className={cn(
            "px-3 py-1.5 rounded-lg text-sm",
            "bg-secondary/50 hover:bg-secondary text-foreground",
            "border border-border/40 hover:border-accent/30",
            "transition-all duration-200 active:scale-[0.98]",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
