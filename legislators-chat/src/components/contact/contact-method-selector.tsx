"use client";

import * as React from "react";
import { Phone, Mail, PhoneOff, MailX } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ContactMethod } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface ContactMethodSelectorProps {
  /** Current selected method */
  value: ContactMethod;
  /** Called when method changes */
  onChange: (method: ContactMethod) => void;
  /** Whether phone is available */
  hasPhone: boolean;
  /** Whether email is available */
  hasEmail: boolean;
  /** Optional phone hours indicator */
  phoneHours?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Size variant */
  size?: "sm" | "default";
  /** Additional class name */
  className?: string;
}

export function ContactMethodSelector({
  value,
  onChange,
  hasPhone,
  hasEmail,
  phoneHours,
  disabled = false,
  size = "default",
  className,
}: ContactMethodSelectorProps) {
  const isSmall = size === "sm";

  // Determine what's actually selectable
  // Call requires a phone number, but email can be selected even without an address
  // (user can still draft and copy to use on contact forms)
  const canSelectCall = hasPhone && !disabled;
  const canSelectEmail = !disabled;

  const handleSelect = (method: ContactMethod) => {
    if (method === "call" && !canSelectCall) return;
    if (method === "email" && !canSelectEmail) return;
    onChange(method);
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div
        className={cn(
          "inline-flex items-center rounded-md border border-border bg-muted/50 p-0.5",
          disabled && "opacity-50",
          className
        )}
        role="radiogroup"
        aria-label="Contact method"
      >
        {/* Call option */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size={isSmall ? "icon-sm" : "icon"}
              className={cn(
                "relative transition-all",
                isSmall ? "size-7" : "size-8",
                value === "call" && hasPhone
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "hover:bg-muted",
                !hasPhone && "cursor-not-allowed opacity-40"
              )}
              onClick={() => handleSelect("call")}
              disabled={!canSelectCall}
              aria-checked={value === "call"}
              role="radio"
            >
              {hasPhone ? (
                <Phone className={cn(isSmall ? "size-3.5" : "size-4")} />
              ) : (
                <PhoneOff className={cn(isSmall ? "size-3.5" : "size-4")} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {hasPhone ? (
              <>
                <span className="font-medium">Call</span>
                {phoneHours && (
                  <span className="block text-muted-foreground">{phoneHours}</span>
                )}
              </>
            ) : (
              "Phone not available"
            )}
          </TooltipContent>
        </Tooltip>

        {/* Email option */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size={isSmall ? "icon-sm" : "icon"}
              className={cn(
                "relative transition-all",
                isSmall ? "size-7" : "size-8",
                value === "email"
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : "hover:bg-muted"
              )}
              onClick={() => handleSelect("email")}
              disabled={!canSelectEmail}
              aria-checked={value === "email"}
              role="radio"
            >
              {hasEmail ? (
                <Mail className={cn(isSmall ? "size-3.5" : "size-4")} />
              ) : (
                <MailX className={cn(isSmall ? "size-3.5" : "size-4")} />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">
            {hasEmail ? "Email" : "Email (no address on file)"}
          </TooltipContent>
        </Tooltip>
      </div>
    </TooltipProvider>
  );
}

/**
 * Compact inline version showing just the selected method with ability to toggle
 */
export interface ContactMethodBadgeProps {
  method: ContactMethod;
  hasPhone: boolean;
  hasEmail: boolean;
  onToggle?: () => void;
  className?: string;
}

export function ContactMethodBadge({
  method,
  hasPhone,
  hasEmail,
  onToggle,
  className,
}: ContactMethodBadgeProps) {
  const hasBoth = hasPhone && hasEmail;
  const isCall = method === "call";

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={!hasBoth || !onToggle}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors",
        isCall
          ? "bg-green-500/20 text-green-400"
          : "bg-blue-500/20 text-blue-400",
        hasBoth && onToggle && "hover:opacity-80 cursor-pointer",
        (!hasBoth || !onToggle) && "cursor-default",
        className
      )}
      aria-label={hasBoth ? `Switch to ${isCall ? "email" : "call"}` : undefined}
    >
      {isCall ? <Phone className="size-3" /> : <Mail className="size-3" />}
      <span>{isCall ? "Call" : "Email"}</span>
    </button>
  );
}
