"use client";

import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import type { CallDetail } from "@/app/api/investigations/[id]/calls/route";
import { ComparisonTable } from "@/components/results/comparison-table";
import { CardSkeleton } from "@/components/state/card-skeleton";
import { ErrorState } from "@/components/state/error-state";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

const PRIORITY_BADGE: Record<"high" | "medium" | "low", "destructive" | "secondary" | "outline"> = {
  high: "destructive",
  medium: "secondary",
  low: "outline",
};

type ActionItemView = {
  id: string;
  title: string;
  detail: string;
  priority: "high" | "medium" | "low";
  done: boolean;
};

type ResultsResponse = {
  investigationId: string;
  requirement: string;
  status: string;
  bestCallId: string | null;
  recommendationSummary: string;
};

type CallsResponse = {
  investigationId: string;
  status: string;
  calls: CallDetail[];
};

export default function InvestigationResultsPage() {
  const params = useParams<{ id: string }>();
  const investigationId = params.id;

  const [results, setResults] = useState<ResultsResponse | null>(null);
  const [calls, setCalls] = useState<CallDetail[]>([]);
  const [actionItems, setActionItems] = useState<ActionItemView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadAll = useCallback(async () => {
    if (!investigationId) return;
    try {
      setError(null);
      const [resultsRes, callsRes] = await Promise.all([
        fetch(`/api/investigations/${investigationId}/results`),
        fetch(`/api/investigations/${investigationId}/calls`),
      ]);
      if (!resultsRes.ok || !callsRes.ok) {
        throw new Error(
          resultsRes.status === 404
            ? "This investigation doesn't exist."
            : "Results aren't available yet.",
        );
      }
      const resultsPayload = (await resultsRes.json()) as ResultsResponse & {
        actionItems: Array<Omit<ActionItemView, "done">>;
      };
      const callsPayload = (await callsRes.json()) as CallsResponse;

      setResults(resultsPayload);
      setCalls(callsPayload.calls);
      setActionItems(
        (resultsPayload.actionItems ?? []).map((item) => ({ ...item, done: false })),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load results.");
    } finally {
      setLoading(false);
    }
  }, [investigationId]);

  // Initial load + poll while the investigation is still running.
  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!results || results.status === "completed" || results.status === "failed") return;
    const handle = setInterval(() => void loadAll(), 4000);
    return () => clearInterval(handle);
  }, [results, loadAll]);

  const toggleActionItem = async (id: string, done: boolean) => {
    // Optimistic update; revert on failure.
    setActionItems((current) =>
      current.map((item) => (item.id === id ? { ...item, done } : item)),
    );
    try {
      const response = await fetch(`/api/action-items/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ done }),
      });
      if (!response.ok) throw new Error();
    } catch {
      setActionItems((current) =>
        current.map((item) => (item.id === id ? { ...item, done: !done } : item)),
      );
    }
  };

  const stillRunning = results && (results.status === "running" || results.status === "draft");
  const scored = calls.filter((call) => typeof call.score === "number");
  const avgConfidence =
    scored.length > 0
      ? Math.round(scored.reduce((sum, call) => sum + (call.score ?? 0), 0) / scored.length)
      : null;

  return (
    <main className="aira-page aira-glow relative flex flex-col gap-6 py-8">
      <header className="space-y-2">
        <p className="text-eyebrow">Decision brief</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          The verdict, with receipts
        </h1>
        <p className="text-sm text-muted-foreground">
          Every number traces back to a recorded call.
          {avgConfidence !== null ? (
            <span className="ml-2 font-mono">CONFIDENCE {avgConfidence}/100</span>
          ) : null}
        </p>
      </header>

      {error ? (
        <ErrorState message={error} onRetry={() => void loadAll()} />
      ) : loading ? (
        <>
          <CardSkeleton lines={2} />
          <CardSkeleton lines={5} />
        </>
      ) : (
        <>
          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="font-display text-base">Executive Summary</CardTitle>
                {stillRunning ? (
                  <Badge variant="outline" className="border-info/40 bg-info/10 text-info">
                    <span className="inline-block size-1.5 animate-pulse rounded-full bg-current" />
                    updating live…
                  </Badge>
                ) : null}
              </div>
              <CardDescription>{results?.requirement}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed text-muted-foreground">
                {results?.recommendationSummary}
              </p>
            </CardContent>
          </Card>

          <ComparisonTable calls={calls} bestCallId={results?.bestCallId} />

          <Card className="border-border/70 shadow-sm">
            <CardHeader>
              <CardTitle className="font-display text-base">Next moves</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {actionItems.length > 0 ? (
                actionItems.map((item) => (
                  <label
                    key={item.id}
                    className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent/30"
                  >
                    <Checkbox
                      checked={item.done}
                      onCheckedChange={(checked) =>
                        void toggleActionItem(item.id, checked === true)
                      }
                      className="mt-0.5"
                    />
                    <div className={item.done ? "opacity-60" : ""}>
                      <div className="mb-1 flex items-center gap-2">
                        <Badge variant={PRIORITY_BADGE[item.priority]}>{item.priority}</Badge>
                        <p className={`font-medium ${item.done ? "line-through" : ""}`}>
                          {item.title}
                        </p>
                      </div>
                      <p className="text-sm text-muted-foreground">{item.detail}</p>
                    </div>
                  </label>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No action items yet.</p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </main>
  );
}
