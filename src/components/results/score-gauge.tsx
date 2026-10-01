"use client";

import { useEffect, useState } from "react";

import { cn } from "@/lib/utils";

type ScoreGaugeProps = {
  score: number;
  size?: number;
  className?: string;
};

const RADIUS_RATIO = 0.44;
const SWEEP_DEG = 270;
const START_ANGLE = 135; // degrees, 0 = pointing up

function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function arcPath(cx: number, cy: number, r: number, sweepDeg: number): string {
  const start = polar(cx, cy, r, START_ANGLE);
  const end = polar(cx, cy, r, START_ANGLE + sweepDeg);
  const largeArc = sweepDeg > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y}`;
}

function tone(score: number): { stroke: string; text: string } {
  if (score >= 75) return { stroke: "var(--primary)", text: "text-primary" };
  if (score >= 50) return { stroke: "var(--warning)", text: "text-warning" };
  return { stroke: "var(--destructive)", text: "text-destructive" };
}

/**
 * Instrument-style arc gauge for match score.
 * Animates the sweep on mount; static under reduced motion.
 */
export function ScoreGauge({ score, size = 72, className }: ScoreGaugeProps) {
  const clamped = Math.max(0, Math.min(100, Math.round(score)));
  // Start at 0 and animate to the value via rAF (no setState in effect body).
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      requestAnimationFrame(() => setDisplayed(clamped));
      return;
    }
    const handle = requestAnimationFrame(() => setDisplayed(clamped));
    return () => cancelAnimationFrame(handle);
  }, [clamped]);

  const cx = size / 2;
  const cy = size / 2;
  const r = size * RADIUS_RATIO;
  const strokeWidth = Math.max(4, size * 0.075);
  const sweep = (displayed / 100) * SWEEP_DEG;
  const { stroke, text } = tone(clamped);

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden>
        {/* Track: full 270° sweep */}
        <path
          d={arcPath(cx, cy, r, SWEEP_DEG)}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
        />
        {/* Value sweep */}
        <path
          d={arcPath(cx, cy, r, Math.max(sweep, 0.01))}
          fill="none"
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          style={{
            transition: "stroke-dasharray 400ms ease-out, d 400ms ease-out",
          }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className={cn("font-mono text-sm font-semibold tabular-nums", text)}>{clamped}</span>
      </div>
    </div>
  );
}
