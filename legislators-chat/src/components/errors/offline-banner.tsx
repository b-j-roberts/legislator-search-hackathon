"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { WifiOff, Wifi } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OfflineBannerProps {
  /** Whether the user is currently offline */
  isOffline: boolean;
  /** Whether we just recovered from being offline */
  showRecovered?: boolean;
  /** Callback when the recovered message should be dismissed */
  onRecoveredDismiss?: () => void;
  /** Additional class names */
  className?: string;
}

const bannerVariants = {
  initial: { opacity: 0, y: -20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
};

const bannerTransition = {
  duration: 0.2,
  ease: [0.4, 0, 0.2, 1] as const,
};

export function OfflineBanner({
  isOffline,
  showRecovered = false,
  onRecoveredDismiss,
  className,
}: OfflineBannerProps) {
  // Auto-dismiss the recovered message after 3 seconds
  React.useEffect(() => {
    if (showRecovered && onRecoveredDismiss) {
      const timer = setTimeout(() => {
        onRecoveredDismiss();
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [showRecovered, onRecoveredDismiss]);

  return (
    <AnimatePresence mode="wait">
      {isOffline && (
        <motion.div
          key="offline"
          variants={bannerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={bannerTransition}
          className={cn(
            "flex items-center justify-center gap-2 bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground",
            className
          )}
          role="alert"
          aria-live="assertive"
        >
          <WifiOff className="h-4 w-4" />
          <span>You&apos;re offline. Messages will be sent when you reconnect.</span>
        </motion.div>
      )}
      {!isOffline && showRecovered && (
        <motion.div
          key="online"
          variants={bannerVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          transition={bannerTransition}
          className={cn(
            "flex items-center justify-center gap-2 bg-green-600 px-4 py-2 text-sm font-medium text-white",
            className
          )}
          role="status"
          aria-live="polite"
        >
          <Wifi className="h-4 w-4" />
          <span>You&apos;re back online!</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
