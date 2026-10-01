"use client";

import { cn } from "@/lib/utils";

type SignalWaveProps = {
  active?: boolean;
  className?: string;
  barCount?: number;
};

/**
 * Full-width animated waveform used on the Live Ops header.
 * Pure CSS; static under prefers-reduced-motion.
 */
export function SignalWave({ active = false, className, barCount = 48 }: SignalWaveProps) {
  return (
    <div
      aria-hidden
      data-active={active}
      className={cn(
        "flex h-8 w-full items-center gap-[3px] overflow-hidden rounded-lg border border-border/50 bg-surface/60 px-2",
        active ? "text-info" : "text-muted-foreground/40",
        className,
      )}
    >
      {Array.from({ length: barCount }).map((_, index) => (
        <span
          key={index}
          className={cn("min-w-[3px] flex-1 rounded-full bg-current", active && "aira-bar-live")}
          style={{
            height: `${25 + ((index * 37) % 70)}%`,
            animationDelay: `${(index % 12) * 90}ms`,
            animationDuration: `${800 + (index % 5) * 120}ms`,
          }}
        />
      ))}
    </div>
  );
}
