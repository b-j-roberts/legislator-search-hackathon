"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle, X, RefreshCw } from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ErrorBannerProps {
  /** Error message to display */
  message: string;
  /** Optional title for the error */
  title?: string;
  /** Whether the error can be dismissed */
  dismissible?: boolean;
  /** Callback when dismiss button is clicked */
  onDismiss?: () => void;
  /** Whether to show retry button */
  showRetry?: boolean;
  /** Callback when retry button is clicked */
  onRetry?: () => void;
  /** Whether retry is currently in progress */
  isRetrying?: boolean;
  /** Additional class names */
  className?: string;
}

const bannerVariants = {
  initial: { opacity: 0, y: -10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
};

const bannerTransition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1] as const,
};

export function ErrorBanner({
  message,
  title = "Something went wrong",
  dismissible = true,
  onDismiss,
  showRetry = false,
  onRetry,
  isRetrying = false,
  className,
}: ErrorBannerProps) {
  return (
    <motion.div
      variants={bannerVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={bannerTransition}
      className={cn("w-full", className)}
    >
      <Alert variant="destructive" className="relative">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p>{message}</p>
          {(showRetry || dismissible) && (
            <div className="mt-2 flex gap-2">
              {showRetry && onRetry && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onRetry}
                  disabled={isRetrying}
                  className="h-7 text-xs"
                >
                  <RefreshCw className={cn("mr-1 h-3 w-3", isRetrying && "animate-spin")} />
                  {isRetrying ? "Retrying..." : "Try again"}
                </Button>
              )}
            </div>
          )}
        </AlertDescription>
        {dismissible && onDismiss && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onDismiss}
            className="absolute right-2 top-2 h-6 w-6 p-0 hover:bg-destructive/10"
            aria-label="Dismiss error"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
      </Alert>
    </motion.div>
  );
}

/**
 * Wrapper component for animated error banner
 */
export function AnimatedErrorBanner(props: ErrorBannerProps & { visible: boolean }) {
  const { visible, ...errorProps } = props;

  return <AnimatePresence>{visible && <ErrorBanner {...errorProps} />}</AnimatePresence>;
}
