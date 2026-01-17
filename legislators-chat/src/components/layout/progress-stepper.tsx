"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { MessageSquare, Send, CheckCircle2, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ContactStep } from "@/hooks/use-contact";

interface Step {
  id: ContactStep;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
}

const steps: Step[] = [
  {
    id: "research",
    label: "Research",
    icon: MessageSquare,
    href: "/",
  },
  {
    id: "contact",
    label: "Contact",
    icon: Send,
    href: "/contact",
  },
  {
    id: "complete",
    label: "Complete",
    icon: CheckCircle2,
    href: "/contact/complete",
  },
];

export interface ProgressStepperProps {
  currentStep: ContactStep;
  className?: string;
}

export function ProgressStepper({ currentStep, className }: ProgressStepperProps) {
  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <nav
      aria-label="Progress"
      className={cn(
        "flex items-center justify-center gap-1 sm:gap-2",
        className
      )}
    >
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = index < currentStepIndex;
        const isClickable = index < currentStepIndex;
        const Icon = step.icon;

        const stepContent = (
          <motion.div
            className={cn(
              "flex items-center gap-1.5 px-2 py-1.5 sm:px-3 sm:py-2 rounded-full text-sm font-medium transition-colors",
              isActive && "bg-primary text-primary-foreground",
              isCompleted && "bg-primary/20 text-primary",
              !isActive && !isCompleted && "bg-muted text-muted-foreground"
            )}
            initial={false}
            animate={{
              scale: isActive ? 1 : 0.95,
            }}
            transition={{ duration: 0.2 }}
          >
            <Icon className="size-4" />
            <span className="hidden sm:inline">{step.label}</span>
          </motion.div>
        );

        return (
          <React.Fragment key={step.id}>
            {isClickable ? (
              <Link
                href={step.href}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
              >
                {stepContent}
              </Link>
            ) : (
              <div
                className={cn(!isActive && !isCompleted && "opacity-50")}
                aria-current={isActive ? "step" : undefined}
              >
                {stepContent}
              </div>
            )}

            {index < steps.length - 1 && (
              <ChevronRight
                className={cn(
                  "size-4 flex-shrink-0",
                  index < currentStepIndex
                    ? "text-primary"
                    : "text-muted-foreground/50"
                )}
              />
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
