"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Info } from "lucide-react";

import { cn } from "@/lib/utils";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

export interface LeaningGaugeProps {
  /** Leaning score from -100 (strongly opposes) to +100 (strongly supports) */
  score: number;
  /** Optional label override */
  label?: string;
  /** Show the info tooltip */
  showTooltip?: boolean;
  /** Size variant */
  size?: "sm" | "md" | "lg";
  /** Additional className */
  className?: string;
}

/** Get the label based on score */
function getScoreLabel(score: number): string {
  if (score >= 75) return "Strongly Supports";
  if (score >= 25) return "Supports";
  if (score > -25) return "Mixed";
  if (score > -75) return "Opposes";
  return "Strongly Opposes";
}

/** Get the color class based on score */
function getScoreColor(score: number): string {
  if (score >= 75) return "text-green-400";
  if (score >= 25) return "text-green-500";
  if (score > -25) return "text-yellow-400";
  if (score > -75) return "text-red-500";
  return "text-red-400";
}

/** Convert score (-100 to 100) to angle in radians for needle position */
function scoreToRadians(score: number): number {
  // +100 (strongly supports) -> right side (0 radians / 0°)
  // -100 (strongly opposes) -> left side (π radians / 180°)
  const clampedScore = Math.max(-100, Math.min(100, score));
  // Map from [-100, 100] to [π, 0]
  const angle = ((100 + clampedScore) / 200) * Math.PI;
  return angle;
}

const sizeConfig = {
  sm: { width: 80, height: 48, strokeWidth: 8, needleLength: 28 },
  md: { width: 120, height: 70, strokeWidth: 10, needleLength: 42 },
  lg: { width: 160, height: 95, strokeWidth: 12, needleLength: 58 },
};

export function LeaningGauge({
  score,
  label,
  showTooltip = true,
  size = "md",
  className,
}: LeaningGaugeProps) {
  const clampedScore = Math.max(-100, Math.min(100, score));
  const displayLabel = label ?? getScoreLabel(clampedScore);
  const colorClass = getScoreColor(clampedScore);
  const angleRad = scoreToRadians(clampedScore);
  const config = sizeConfig[size];

  const centerX = config.width / 2;
  const centerY = config.height - 4;
  const radius = config.width / 2 - config.strokeWidth / 2 - 2;

  // Calculate needle endpoint
  const needleX = centerX - Math.cos(angleRad) * config.needleLength;
  const needleY = centerY - Math.sin(angleRad) * config.needleLength;

  // Create the arc path for the gauge background
  const arcPath = `
    M ${config.strokeWidth / 2 + 2} ${centerY}
    A ${radius} ${radius} 0 0 1 ${config.width - config.strokeWidth / 2 - 2} ${centerY}
  `;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      {/* SVG Gauge */}
      <div className="relative">
        <svg
          width={config.width}
          height={config.height}
          viewBox={`0 0 ${config.width} ${config.height}`}
          className="overflow-visible"
        >
          {/* Gradient definition */}
          <defs>
            <linearGradient id={`gauge-gradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#ef4444" />
              <stop offset="35%" stopColor="#f97316" />
              <stop offset="50%" stopColor="#eab308" />
              <stop offset="65%" stopColor="#84cc16" />
              <stop offset="100%" stopColor="#22c55e" />
            </linearGradient>
          </defs>

          {/* Background arc with gradient */}
          <path
            d={arcPath}
            fill="none"
            stroke={`url(#gauge-gradient-${size})`}
            strokeWidth={config.strokeWidth}
            strokeLinecap="round"
          />

          {/* Tick marks */}
          {[0, 45, 90, 135, 180].map((tickAngle) => {
            const tickRad = (tickAngle * Math.PI) / 180;
            const innerR = radius - config.strokeWidth / 2 - 2;
            const outerR = radius + config.strokeWidth / 2 + 2;
            const x1 = centerX - Math.cos(tickRad) * innerR;
            const y1 = centerY - Math.sin(tickRad) * innerR;
            const x2 = centerX - Math.cos(tickRad) * outerR;
            const y2 = centerY - Math.sin(tickRad) * outerR;
            return (
              <line
                key={tickAngle}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke="currentColor"
                strokeWidth={tickAngle === 90 ? 2 : 1}
                className="text-slate-600"
              />
            );
          })}

          {/* Needle - using animated x2/y2 coordinates */}
          <motion.line
            x1={centerX}
            y1={centerY}
            initial={{ x2: centerX, y2: centerY - config.needleLength }}
            animate={{ x2: needleX, y2: needleY }}
            transition={{ type: "spring", stiffness: 60, damping: 12 }}
            stroke="#e2e8f0"
            strokeWidth={3}
            strokeLinecap="round"
          />

          {/* Needle tip */}
          <motion.circle
            initial={{ cx: centerX, cy: centerY - config.needleLength }}
            animate={{ cx: needleX, cy: needleY }}
            transition={{ type: "spring", stiffness: 60, damping: 12 }}
            r={2.5}
            fill="#f1f5f9"
          />

          {/* Center pivot */}
          <circle cx={centerX} cy={centerY} r={size === "sm" ? 5 : 7} fill="#475569" />
          <circle cx={centerX} cy={centerY} r={size === "sm" ? 2.5 : 3.5} fill="#1e293b" />
        </svg>

        {/* Labels */}
        {size !== "sm" && (
          <>
            <span className="absolute bottom-0 left-0 text-[10px] font-medium text-red-500">
              Opposes
            </span>
            <span className="absolute bottom-0 right-0 text-[10px] font-medium text-green-500">
              Supports
            </span>
          </>
        )}
      </div>

      {/* Label with tooltip */}
      <div className="flex items-center gap-1.5 mt-1">
        <span className={cn("text-sm font-medium", colorClass)}>{displayLabel}</span>
        {showTooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="text-muted-foreground hover:text-foreground transition-colors"
                aria-label="Learn about the leaning scale"
              >
                <Info className="size-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-xs">
              <div className="space-y-1">
                <p className="font-medium">Leaning Score: {clampedScore > 0 ? "+" : ""}{clampedScore}</p>
                <p>
                  Based on voting record, public statements, and sponsored legislation.
                </p>
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-red-400">← Opposes</span>
                  <span className="text-green-400">Supports →</span>
                </div>
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

/** Compact inline version for card headers */
export function LeaningGaugeCompact({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const clampedScore = Math.max(-100, Math.min(100, score));
  const label = getScoreLabel(clampedScore);
  const colorClass = getScoreColor(clampedScore);
  const angleRad = scoreToRadians(clampedScore);

  // Compact dimensions
  const width = 48;
  const height = 28;
  const strokeWidth = 5;
  const centerX = width / 2;
  const centerY = height - 2;
  const radius = width / 2 - strokeWidth / 2 - 1;
  const needleLength = 16;

  // Calculate needle endpoint
  const needleX = centerX - Math.cos(angleRad) * needleLength;
  const needleY = centerY - Math.sin(angleRad) * needleLength;

  const arcPath = `
    M ${strokeWidth / 2 + 1} ${centerY}
    A ${radius} ${radius} 0 0 1 ${width - strokeWidth / 2 - 1} ${centerY}
  `;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-2 py-1 cursor-help",
            "bg-slate-900/50 border-slate-700",
            className
          )}
        >
          {/* Mini speedometer gauge */}
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
          >
            <defs>
              <linearGradient id="gauge-gradient-compact" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ef4444" />
                <stop offset="35%" stopColor="#f97316" />
                <stop offset="50%" stopColor="#eab308" />
                <stop offset="65%" stopColor="#84cc16" />
                <stop offset="100%" stopColor="#22c55e" />
              </linearGradient>
            </defs>

            {/* Background arc */}
            <path
              d={arcPath}
              fill="none"
              stroke="url(#gauge-gradient-compact)"
              strokeWidth={strokeWidth}
              strokeLinecap="round"
            />

            {/* Needle */}
            <motion.line
              x1={centerX}
              y1={centerY}
              initial={{ x2: centerX, y2: centerY - needleLength }}
              animate={{ x2: needleX, y2: needleY }}
              transition={{ type: "spring", stiffness: 60, damping: 12 }}
              stroke="#e2e8f0"
              strokeWidth={2}
              strokeLinecap="round"
            />

            {/* Center pivot */}
            <circle cx={centerX} cy={centerY} r={3} fill="#475569" />
            <circle cx={centerX} cy={centerY} r={1.5} fill="#1e293b" />
          </svg>

          <span className={cn("text-xs font-medium whitespace-nowrap", colorClass)}>{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-xs">
        <div className="space-y-1">
          <p className="font-medium">Leaning: {clampedScore > 0 ? "+" : ""}{clampedScore}</p>
          <p className="text-xs">
            Based on voting record, public statements, and sponsored legislation.
          </p>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
