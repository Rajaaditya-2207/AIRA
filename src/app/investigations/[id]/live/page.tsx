"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";

import { ErrorState } from "@/components/state/error-state";
import { SignalWave } from "@/components/live/signal-wave";
import { ProgressTimeline } from "@/components/live/progress-timeline";
import { TranscriptPane } from "@/components/live/transcript-pane";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useInvestigationStream, type StreamState } from "@/hooks/use-investigation-stream";

const STREAM_LABEL: Record<StreamState, string> = {
  connecting: "Connecting…",
  live: "Live",
  stale: "Reconnecting…",
  closed: "Offline",
  "not-found": "Not found",
};

const STREAM_CLASS: Record<StreamState, string> = {
  connecting: "border-border bg-muted text-muted-foreground",
  live: "border-success/40 bg-success/10 text-success",
  stale: "border-warning/40 bg-warning/10 text-warning",
  closed: "border-border bg-muted text-muted-foreground",
  "not-found": "border-destructive/40 bg-destructive/10 text-destructive",
};

export default function InvestigationLivePage() {
  const params = useParams<{ id: string }>();
  const investigationId = params.id;
  const { streamState, status: investigationStatus, calls, lines } =
    useInvestigationStream(investigationId);
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [retryingCallId, setRetryingCallId] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  if (streamState === "not-found") {
    return (
      <main className="aira-page flex min-h-[60dvh] flex-col justify-center gap-4 py-10">
        <ErrorState message="This investigation doesn't exist. It may have been deleted, or was created on another machine." />
        <div>
          <Button asChild variant="outline">
            <Link href="/investigations">Back to Investigations</Link>
          </Button>
        </div>
      </main>
    );
  }

  const completedCalls = calls.filter(
    (call) => call.status === "completed" || call.status === "failed",
  ).length;

  const resolvedSelectedCallId =
    selectedCallId && calls.some((call) => call.id === selectedCallId)
      ? selectedCallId
      : calls[0]?.id ?? null;
  const selectedCall = calls.find((call) => call.id === resolvedSelectedCallId) ?? null;
  const isRunActive = investigationStatus === "running" && streamState !== "closed";
  const waveActive = streamState === "live" || streamState === "stale";

  const retryCall = async (callId: string) => {
    if (!investigationId) return;
    setRetryingCallId(callId);
    try {
      await fetch(`/api/investigations/${investigationId}/retry/${callId}`, { method: "POST" });
    } finally {
      setRetryingCallId(null);
    }
  };

  const cancelInvestigation = async () => {
    if (!investigationId) return;
    setCancelling(true);
    try {
      await fetch(`/api/investigations/${investigationId}/cancel`, { method: "POST" });
    } finally {
      setCancelling(false);
    }
  };

  return (
    <main className="aira-page aira-glow relative flex flex-col gap-6 py-8">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <p className="text-eyebrow">Live transmission</p>
            <h1 className="font-display text-2xl font-semibold tracking-tight">Live Ops</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className={STREAM_CLASS[streamState]}>
              <span
                className={`inline-block size-1.5 rounded-full bg-current ${
                  streamState === "live" ? "animate-pulse" : ""
                }`}
              />
              {STREAM_LABEL[streamState]}
            </Badge>
            <Badge variant={investigationStatus === "failed" ? "destructive" : "secondary"}>
              {investigationStatus}
            </Badge>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" disabled={!isRunActive || cancelling}>
                  {cancelling ? "Cancelling…" : "Cancel run"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Cancel this investigation?</AlertDialogTitle>
                  <AlertDialogDescription>
                    In-flight calls hang up immediately and remaining calls are skipped. This
                    can&apos;t be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Keep running</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void cancelInvestigation()}>
                    Cancel investigation
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <Button asChild disabled={investigationStatus !== "completed"}>
              <Link href={`/investigations/${investigationId}/results`}>Open Results</Link>
            </Button>
          </div>
        </div>
        <SignalWave active={waveActive} />
      </header>

      <Card className="border-border/70 bg-surface/50 shadow-sm">
        <CardHeader className="space-y-0.5 pb-3">
          <p className="text-eyebrow">Calls</p>
          <CardTitle className="font-display text-base">
            {completedCalls}/{calls.length} finished
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProgressTimeline
            calls={calls}
            selectedCallId={resolvedSelectedCallId}
            onSelectCall={(callId) => setSelectedCallId(callId)}
            onRetryCall={(callId) => void retryCall(callId)}
            retryingCallId={retryingCallId}
          />
        </CardContent>
      </Card>

      <TranscriptPane
        lines={lines}
        selectedCallId={resolvedSelectedCallId}
        selectedContactName={selectedCall?.contactName}
        selectedCallStatus={selectedCall?.status ?? null}
        selectedCallStartedAt={selectedCall?.startedAt ?? null}
        selectedRecordingUrl={selectedCall?.recordingUrl ?? null}
      />
    </main>
  );
}
