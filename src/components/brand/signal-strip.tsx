"use client";

import { cn } from "@/lib/utils";

type SignalStripProps = {
  /** Whether something is on the air (calls live). */
  active?: boolean;
  bars?: number;
  className?: string;
};

/**
 * AIRA's signature element: a small equalizer of rounded bars.
 * Animates only when `active`; respects prefers-reduced-motion.
 */
export function SignalStrip({ active = false, bars = 5, className }: SignalStripProps) {
  return (
    <span
      data-active={active}
      aria-hidden
      className={cn(
        "inline-flex h-4 items-end gap-[3px]",
        active ? "text-info" : "text-muted-foreground/50",
        className,
      )}
    >
      {Array.from({ length: bars }).map((_, index) => (
        <span
          key={index}
          className={cn(
            "w-[3px] rounded-full bg-current",
            active && "aira-bar-live",
          )}
          style={{
            height: `${[40, 75, 100, 60, 85][index % 5]}%`,
            animationDelay: `${index * 120}ms`,
          }}
        />
      ))}
    </span>
  );
}
