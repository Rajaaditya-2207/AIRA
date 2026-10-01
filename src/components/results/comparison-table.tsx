"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Crown, Play, XCircle } from "lucide-react";

import type { CallDetail } from "@/app/api/investigations/[id]/calls/route";
import { ScoreGauge } from "@/components/results/score-gauge";
import { cn } from "@/lib/utils";
import { formatOffset } from "@/lib/time";

type ComparisonTableProps = {
  calls: CallDetail[];
  bestCallId?: string | null;
};

type TranscriptResponse = {
  callId: string;
  contactName: string;
  startedAt: string | null;
  lines: Array<{
    id: string;
    speaker: string;
    text: string;
    createdAt: string;
  }>;
};

function formatPrice(price: number | null): string {
  return price === null ? "—" : `₹${price.toLocaleString("en-IN")}`;
}

/**
 * Inline expanding transcript inside an evidence panel.
 * Lazily fetched on first open; bubbles reuse the amber/indigo language.
 */
function InlineTranscript({ call }: { call: CallDetail }) {
  const [data, setData] = useState<TranscriptResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = !data && !error;

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/calls/${call.id}/transcript`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Transcript unavailable for this call.");
        return (await response.json()) as TranscriptResponse;
      })
      .then((payload) => {
        if (!cancelled) setData(payload);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [call.id]);

  if (loading) {
    return (
      <div className="space-y-2 p-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="h-8 w-2/3 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    );
  }

  if (error) {
    return <p className="p-3 text-sm text-muted-foreground">{error}</p>;
  }

  if (!data || data.lines.length === 0) {
    return <p className="p-3 text-sm text-muted-foreground">No transcript captured for this call.</p>;
  }

  return (
    <div className="max-h-72 space-y-2.5 overflow-y-auto rounded-lg bg-background/80 p-3">
      {data.lines.map((line) => {
        const isAgent = line.speaker === "agent";
        const isSystem = line.speaker === "system";
        return (
          <div key={line.id} className={cn("flex", isSystem ? "justify-center" : isAgent ? "justify-end" : "justify-start")}>
            <div className={cn("max-w-[85%]", isSystem && "w-full text-center")}>
              <p className={cn("font-mono text-[11px] text-muted-foreground", isAgent && "text-right")}>
                {formatOffset(call.startedAt, line.createdAt)}
                {isSystem ? "" : isAgent ? " · AI AGENT" : ` · ${call.contactName.toUpperCase()}`}
              </p>
              <div
                className={cn(
                  "rounded-2xl px-3 py-1.5 text-sm leading-relaxed",
                  isSystem
                    ? "border border-border/60 bg-surface-2 font-mono text-[11px] text-muted-foreground"
                    : isAgent
                      ? "rounded-br-sm bg-primary text-primary-foreground"
                      : "rounded-bl-sm border border-voice/30 bg-voice/10 text-foreground",
                )}
              >
                {line.text}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function EvidencePanel({ call, rank, isBest }: { call: CallDetail; rank: number; isBest: boolean }) {
  const [open, setOpen] = useState(false);
  const failed = call.status === "failed";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border bg-card/70 transition-all",
        isBest ? "border-primary/50 shadow-[0_0_0_1px_var(--primary),0_8px_24px_-12px_var(--primary)]" : "border-border/60",
        failed && "opacity-75",
      )}
    >
      <div className="flex flex-wrap items-center gap-4 px-5 py-4">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs text-muted-foreground">#{rank}</span>
            {isBest ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-semibold text-primary">
                <Crown className="size-3" /> BEST MATCH
              </span>
            ) : null}
            <h3 className="truncate font-display text-base font-semibold">{call.contactName}</h3>
          </div>
          <p className="font-mono text-xs text-muted-foreground">{call.phone}</p>
          {failed ? (
            <p className="flex items-center gap-1.5 text-xs text-destructive">
              <XCircle className="size-3.5 shrink-0" />
              <span className="truncate">{call.failureReason ?? "Call failed"}</span>
            </p>
          ) : null}
        </div>

        {!failed ? (
          <div className="flex shrink-0 items-center gap-5">
            <dl className="grid grid-cols-[auto_auto] gap-x-4 gap-y-1 text-sm">
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Price</dt>
              <dd className="text-right font-mono tabular-nums">
                {formatPrice(call.finding?.monthlyPrice ?? null)}
              </dd>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Available</dt>
              <dd className="max-w-44 truncate text-right text-muted-foreground" title={call.finding?.availability ?? undefined}>
                {call.finding?.availability ?? "—"}
              </dd>
              <dt className="text-[11px] uppercase tracking-wide text-muted-foreground">Fit</dt>
              <dd className="max-w-44 truncate text-right text-muted-foreground" title={call.finding?.locationFit ?? undefined}>
                {call.finding?.locationFit ?? "—"}
              </dd>
            </dl>
            <ScoreGauge score={call.score ?? 0} size={72} />
          </div>
        ) : null}
      </div>

      {!failed ? (
        <div className="border-t border-border/50">
          <button
            type="button"
            className="flex w-full items-center gap-2 px-5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent/40"
            onClick={() => setOpen((current) => !current)}
            aria-expanded={open}
          >
            {open ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}
            Transcript
            {call.recordingUrl ? (
              <span className="ml-auto inline-flex items-center gap-1 font-mono text-xs text-primary">
                <Play className="size-3" /> PLAY RECORDING
              </span>
            ) : null}
          </button>
          {open ? (
            <div className="border-t border-border/40 px-5 py-3">
              <InlineTranscript call={call} />
              {call.recordingUrl ? (
                <audio className="mt-3 h-9 w-full" controls preload="none" src={call.recordingUrl} />
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

/**
 * Ranked evidence panels — the Decision Brief core.
 * #1 elevated; failed calls pinned last, dimmed.
 */
export function ComparisonTable({ calls, bestCallId }: ComparisonTableProps) {
  const ranked = [...calls].sort((a, b) => {
    const aFailed = a.status === "failed" ? 1 : 0;
    const bFailed = b.status === "failed" ? 1 : 0;
    if (aFailed !== bFailed) return aFailed - bFailed;
    return (b.score ?? -1) - (a.score ?? -1);
  });

  if (ranked.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground">
        No calls were part of this investigation.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      {ranked.map((call, index) => (
        <EvidencePanel
          key={call.id}
          call={call}
          rank={index + 1}
          isBest={bestCallId === call.id}
        />
      ))}
    </div>
  );
}
