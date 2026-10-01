"use client";

import {
  BellRing,
  CircleCheckBig,
  Clock,
  Loader2,
  PhoneCall,
  PhoneOutgoing,
  RotateCcw,
  XCircle,
} from "lucide-react";

import type { CallProgressItem } from "@/lib/domain";
import { ElapsedTimer } from "@/components/live/elapsed-timer";
import { cn } from "@/lib/utils";

const STATUS_PILL: Record<CallProgressItem["status"], { icon: React.ReactNode; classes: string }> = {
  queued: { icon: <Clock className="size-3" />, classes: "border-border bg-surface-2 text-muted-foreground" },
  dialing: { icon: <PhoneOutgoing className="size-3" />, classes: "border-info/30 bg-info/10 text-info" },
  ringing: { icon: <BellRing className="size-3 animate-pulse" />, classes: "border-info/30 bg-info/10 text-info" },
  connected: { icon: <PhoneCall className="size-3 animate-pulse" />, classes: "border-success/30 bg-success/10 text-success" },
  analyzing: { icon: <Loader2 className="size-3 animate-spin" />, classes: "border-primary/30 bg-primary/10 text-primary" },
  completed: { icon: <CircleCheckBig className="size-3" />, classes: "border-success/40 bg-success/10 text-success" },
  failed: { icon: <XCircle className="size-3" />, classes: "border-destructive/40 bg-destructive/10 text-destructive" },
};

const LANGUAGE_HUE: Record<string, string> = {
  tamil: "bg-voice",
  hindi: "bg-primary",
  english: "bg-info",
  kannada: "bg-success",
};

function initial(name: string): string {
  return (name.trim()[0] ?? "?").toUpperCase();
}

type CallCardProps = {
  call: CallProgressItem;
  selected: boolean;
  onSelect: (callId: string) => void;
  onRetry?: (callId: string) => void;
  retrying?: boolean;
};

function CallCard({ call, selected, onSelect, onRetry, retrying }: CallCardProps) {
  const pill = STATUS_PILL[call.status];
  const dimmed = call.status === "failed";

  return (
    <button
      type="button"
      data-selected={selected}
      onClick={() => onSelect(call.id)}
      className={cn(
        "flex w-full items-center gap-4 rounded-xl border bg-card/70 px-4 py-3 text-left transition-all",
        "hover:border-primary/30 hover:shadow-sm",
        selected ? "border-primary/50 shadow-[inset_2px_0_0_0_var(--primary)]" : "border-border/60",
        dimmed && "opacity-75",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "grid size-10 shrink-0 place-items-center rounded-full text-sm font-semibold text-white",
          LANGUAGE_HUE[call.language.toLowerCase()] ?? "bg-primary",
        )}
      >
        {initial(call.contactName)}
      </span>

      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{call.contactName}</span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
              pill.classes,
            )}
          >
            {pill.icon}
            {call.status}
          </span>
        </span>
        <span className="block truncate font-mono text-xs text-muted-foreground">{call.phone}</span>
        {call.status === "failed" && call.failureReason ? (
          <span className="mt-0.5 block truncate text-xs text-destructive" title={call.failureReason}>
            {call.failureReason}
          </span>
        ) : null}
      </span>

      <span className="flex shrink-0 items-center gap-3">
        <ElapsedTimer
          status={call.status}
          startedAt={call.startedAt ?? null}
          endedAt={null}
          className="font-mono text-sm text-muted-foreground"
        />
        {call.status === "failed" && onRetry ? (
          <span
            role="button"
            tabIndex={0}
            aria-label={`Retry call to ${call.contactName}`}
            onClick={(event) => {
              event.stopPropagation();
              onRetry(call.id);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.stopPropagation();
                onRetry(call.id);
              }
            }}
            className={cn(
              "inline-flex items-center gap-1 rounded-md border border-border/70 px-2 py-1 text-xs",
              "hover:border-primary/40 hover:text-primary",
              retrying && "pointer-events-none opacity-50",
            )}
          >
            <RotateCcw className="size-3.5" />
            {retrying ? "Retrying…" : "Retry"}
          </span>
        ) : null}
      </span>
    </button>
  );
}

type ProgressTimelineProps = {
  calls: CallProgressItem[];
  selectedCallId?: string | null;
  onSelectCall?: (callId: string) => void;
  onRetryCall?: (callId: string) => void;
  retryingCallId?: string | null;
};

export function ProgressTimeline({
  calls,
  selectedCallId,
  onSelectCall,
  onRetryCall,
  retryingCallId,
}: ProgressTimelineProps) {
  if (calls.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-background px-3 py-6 text-center text-sm text-muted-foreground">
        Waiting for call jobs to start...
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {calls.map((call) => (
        <CallCard
          key={call.id}
          call={call}
          selected={selectedCallId === call.id}
          onSelect={(callId) => onSelectCall?.(callId)}
          onRetry={onRetryCall}
          retrying={retryingCallId === call.id}
        />
      ))}
    </div>
  );
}
