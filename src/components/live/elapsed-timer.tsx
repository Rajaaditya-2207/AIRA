"use client";

import { useEffect, useState } from "react";

import type { CallStatus } from "@/lib/domain";

const ACTIVE_STATUSES: ReadonlySet<CallStatus> = new Set(["dialing", "ringing", "connected", "analyzing"]);

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

type ElapsedTimerProps = {
  status: CallStatus;
  startedAt: string | null;
  endedAt: string | null;
  className?: string;
};

/**
 * Honest call duration: ticks mm:ss while the call is in flight, freezes at
 * the final duration once ended, shows "—" when never started.
 */
export function ElapsedTimer({ status, startedAt, endedAt, className }: ElapsedTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  const isActive = ACTIVE_STATUSES.has(status);

  useEffect(() => {
    if (!isActive) return;
    const handle = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(handle);
  }, [isActive]);

  if (!startedAt) {
    return <span className={className}>—</span>;
  }

  const startMs = new Date(startedAt).getTime();
  const endMs = endedAt ? new Date(endedAt).getTime() : isActive ? now : startMs;
  const seconds = Math.max(0, (endMs - startMs) / 1000);

  return (
    <span className={`${className ?? ""} tabular-nums ${isActive ? "text-info" : ""}`}>
      {formatDuration(seconds)}
      {isActive ? <span className="ml-1 inline-block size-1.5 animate-pulse rounded-full bg-current align-middle" /> : null}
    </span>
  );
}
