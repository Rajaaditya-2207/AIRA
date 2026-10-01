"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { CallProgressItem, InvestigationStatus, TranscriptLine } from "@/lib/domain";
import type { SSEEventPayload } from "@/lib/events";

export type StreamState = "connecting" | "live" | "stale" | "closed" | "not-found";

type InvestigationStream = {
  streamState: StreamState;
  status: InvestigationStatus;
  calls: CallProgressItem[];
  lines: TranscriptLine[];
};

const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_DELAY_MS = 2000;
const STALE_AFTER_MS = 20_000;

/**
 * Owns the SSE connection for one investigation:
 * - snapshot on open, incremental events after
 * - auto-reconnect with capped attempts (EventSource auto-reconnect is
 *   disabled on error; we manage it explicitly)
 * - "stale" detection when no events arrive for a while during a live run
 * - explicit not-found when the server 404s
 */
export function useInvestigationStream(investigationId: string | undefined): InvestigationStream {
  const [streamState, setStreamState] = useState<StreamState>("connecting");
  const [status, setStatus] = useState<InvestigationStatus>("running");
  const [calls, setCalls] = useState<CallProgressItem[]>([]);
  const [lines, setLines] = useState<TranscriptLine[]>([]);
  // Refs avoid impure Date.now() calls during render.
  const lastEventAtRef = useRef<number | null>(null);
  const retryRef = useRef(0);

  useEffect(() => {
    lastEventAtRef.current = Date.now();
  }, []);

  useEffect(() => {
    if (!investigationId) {
      // Derive "closed" during render instead of setting state in an effect.
      return;
    }

    let source: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let staleTimer: ReturnType<typeof setInterval> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      setStreamState((current) => (current === "connecting" ? "connecting" : current));

      const es = new EventSource(`/api/investigations/${investigationId}/events`);
      source = es;

      es.onopen = () => {
        retryRef.current = 0;
        lastEventAtRef.current = Date.now();
        setStreamState((current) => (current === "not-found" ? current : "live"));
      };

      es.onmessage = (event) => {
        lastEventAtRef.current = Date.now();
        let payload: SSEEventPayload;
        try {
          payload = JSON.parse(event.data) as SSEEventPayload;
        } catch {
          return;
        }

        if (payload.type === "investigation.snapshot") {
          setStatus(payload.status);
          setCalls(payload.calls);
          setLines(payload.transcripts);
          setStreamState((current) => (current === "not-found" ? current : "live"));
          return;
        }
        if (payload.type === "call.status") {
          setCalls((currentCalls) => {
            const hasExisting = currentCalls.some((call) => call.id === payload.call.id);
            if (!hasExisting) return [...currentCalls, payload.call];
            return currentCalls.map((call) => (call.id === payload.call.id ? payload.call : call));
          });
          return;
        }
        if (payload.type === "call.transcript") {
          setLines((currentLines) => [...currentLines, payload.transcript]);
          return;
        }
        if (payload.type === "investigation.completed") {
          setStatus("completed");
          return;
        }
        if (payload.type === "investigation.failed") {
          setStatus("failed");
        }
      };

      es.onerror = () => {
        es.close();
        source = null;
        if (disposed) return;
        // The events route 404s unknown ids; EventSource gives no status, so
        // probe once to distinguish not-found from a transient drop.
        void fetch(`/api/investigations/${investigationId}/events`, { method: "HEAD" }).then(
          (response) => {
            if (disposed) return;
            if (response.status === 404) {
              setStreamState("not-found");
              return;
            }
            if (retryRef.current < MAX_RECONNECT_ATTEMPTS) {
              retryRef.current += 1;
              setStreamState("stale");
              reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS * retryRef.current);
            } else {
              setStreamState("closed");
            }
          },
        );
      };
    };

    connect();

    staleTimer = setInterval(() => {
      const lastEventAt = lastEventAtRef.current;
      if (lastEventAt === null) return;
      setStreamState((current) => {
        if (current !== "live") return current;
        return Date.now() - lastEventAt > STALE_AFTER_MS ? "stale" : current;
      });
    }, 5000);

    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (staleTimer) clearInterval(staleTimer);
      source?.close();
    };
  }, [investigationId]);

  return useMemo(
    () => ({ streamState, status, calls, lines }),
    [streamState, status, calls, lines],
  );
}
