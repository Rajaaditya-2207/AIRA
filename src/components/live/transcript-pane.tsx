import { useEffect, useMemo, useRef } from "react";

import { ScrollArea } from "@/components/ui/scroll-area";
import { formatOffset } from "@/lib/time";
import { cn } from "@/lib/utils";

import type { CallStatus, TranscriptLine } from "@/lib/domain";

type TranscriptPaneProps = {
  lines: TranscriptLine[];
  selectedCallId: string | null;
  selectedContactName?: string;
  selectedCallStatus?: CallStatus | null;
  selectedCallStartedAt?: string | null;
  selectedRecordingUrl?: string | null;
};

/**
 * Live conversation pane.
 * Agent speech = signal indigo (right), contact speech = warm amber (left),
 * system events = centered mono captions. New lines slide in from their side.
 */
export function TranscriptPane({
  lines,
  selectedCallId,
  selectedContactName,
  selectedCallStatus,
  selectedCallStartedAt,
  selectedRecordingUrl,
}: TranscriptPaneProps) {
  const endRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const pinnedRef = useRef(true);

  const selectedLines = useMemo(
    () => lines.filter((line) => line.callId === selectedCallId),
    [lines, selectedCallId],
  );

  useEffect(() => {
    if (!selectedCallId || !pinnedRef.current) return;
    const frame = requestAnimationFrame(() => {
      endRef.current?.scrollIntoView({ block: "end", behavior: "auto" });
    });
    return () => cancelAnimationFrame(frame);
  }, [selectedCallId, selectedLines.length]);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    pinnedRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
  };

  return (
    <section className="space-y-3 rounded-2xl border border-border/70 bg-surface/50 p-4">
      <header className="flex items-center justify-between gap-2">
        <div>
          <p className="text-eyebrow">Transmission</p>
          <p className="text-sm text-muted-foreground">
            {selectedCallId
              ? `${selectedContactName ?? "Selected contact"} — live conversation`
              : "Select a call to view its conversation"}
          </p>
        </div>
        {selectedCallId && selectedCallStatus ? (
          <span className="font-mono text-xs text-muted-foreground">{selectedCallStatus}</span>
        ) : null}
      </header>

      {selectedCallId && selectedCallStatus === "completed" && selectedRecordingUrl ? (
        <div className="rounded-lg border border-border/70 bg-background p-3">
          <p className="text-eyebrow mb-2">Listen back</p>
          {/* Native element, styled container — reliable + accessible. */}
          <audio className="h-9 w-full" controls preload="metadata" src={selectedRecordingUrl} />
        </div>
      ) : null}

      <div ref={scrollRef} onScroll={onScroll}>
        <ScrollArea className="h-[420px] pr-3">
          <div className="space-y-3">
            {!selectedCallId ? (
              <p className="text-sm text-muted-foreground">Pick a call from the list above.</p>
            ) : null}
            {selectedCallId && selectedLines.length === 0 ? (
              <p className="text-sm text-muted-foreground">Waiting for first words…</p>
            ) : null}
            {selectedLines.map((line) => {
              const isSystem = line.speaker === "system";
              const isAgent = line.speaker === "agent";
              const offset = formatOffset(selectedCallStartedAt, line.createdAt);

              if (isSystem) {
                return (
                  <div key={line.id} className="flex justify-center">
                    <p className="max-w-[85%] rounded-md border border-border/60 bg-surface-2 px-3 py-1.5 text-center font-mono text-[11px] text-muted-foreground">
                      {line.text}
                    </p>
                  </div>
                );
              }

              return (
                <div key={line.id} className={cn("flex", isAgent ? "justify-end" : "justify-start")}>
                  <div className="aira-line-in max-w-[82%] space-y-1" data-side={isAgent ? "agent" : "contact"}>
                    <p
                      className={cn(
                        "font-mono text-[11px] text-muted-foreground",
                        isAgent ? "text-right" : "text-left",
                      )}
                    >
                      {offset} · {isAgent ? "AI AGENT" : (selectedContactName ?? "CONTACT").toUpperCase()}
                    </p>
                    <div
                      className={cn(
                        "rounded-2xl px-3.5 py-2 text-sm leading-relaxed",
                        isAgent
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
            <div ref={endRef} aria-hidden className="h-px w-full" />
          </div>
        </ScrollArea>
      </div>
    </section>
  );
}
