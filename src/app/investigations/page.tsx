"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";

import { DeleteInvestigationButton } from "@/components/investigations/delete-investigation-button";
import { AnimatedGradientText } from "@/components/ui/animated-gradient-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/state/card-skeleton";
import { ErrorState } from "@/components/state/error-state";
import { SignalStrip } from "@/components/brand/signal-strip";
import { cn } from "@/lib/utils";

type InvestigationRow = {
  id: string;
  requirement: string;
  status: "draft" | "running" | "completed" | "failed";
  createdAt: string;
  completedAt: string | null;
  callCount: number;
};

type ListResponse = {
  investigations: InvestigationRow[];
};

const STATUS_STYLE: Record<InvestigationRow["status"], { dot: string; badge: "default" | "secondary" | "destructive" | "outline" }> = {
  draft: { dot: "bg-muted-foreground", badge: "outline" },
  running: { dot: "bg-info animate-pulse", badge: "secondary" },
  completed: { dot: "bg-success", badge: "default" },
  failed: { dot: "bg-destructive", badge: "destructive" },
};

function compactRequirement(value: string): string {
  const firstLine = value.split(/\r?\n/)[0]?.trim() ?? "";
  return firstLine.length <= 120 ? firstLine : `${firstLine.slice(0, 117)}...`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function InvestigationsPage() {
  const [rows, setRows] = useState<InvestigationRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setError(null);
    try {
      const response = await fetch("/api/investigations?limit=100", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const payload = (await response.json()) as ListResponse;
      setRows(payload.investigations);
    } catch {
      setError("The local database isn't reachable right now. Try restarting AIRA.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const onDeleted = (id: string) => {
    setRows((current) => current?.filter((row) => row.id !== id) ?? null);
  };

  return (
    <main className="aira-page aira-glow relative flex flex-col gap-6 py-8">
      <header className="space-y-2">
        <p className="text-eyebrow">Investigation history</p>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Everything on <AnimatedGradientText speed={1.1}>record</AnimatedGradientText>
        </h1>
        <p className="text-sm text-muted-foreground">
          Stored on this machine only. Delete anything you don&apos;t need.
        </p>
      </header>

      {error ? (
        <ErrorState message={error} onRetry={() => void load()} />
      ) : rows === null ? (
        <>
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
          <CardSkeleton lines={2} />
        </>
      ) : rows.length === 0 ? (
        <Card className="border-dashed border-border/70 bg-card/50">
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <SignalStrip bars={7} className="h-6 scale-125" />
            <p className="font-display text-xl font-semibold">Nothing on the airwaves yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Your first brief is one paste away.
            </p>
            <Button asChild className="mt-2">
              <Link href="/">New investigation</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {rows.map((row) => {
            const style = STATUS_STYLE[row.status];
            return (
              <div
                key={row.id}
                className={cn(
                  "group flex items-center gap-4 rounded-xl border border-border/60 bg-card/70 px-4 py-3 transition-all",
                  "hover:border-primary/30 hover:shadow-sm",
                )}
              >
                <span className={cn("h-10 w-1 shrink-0 rounded-full", style.dot)} aria-hidden />
                <div className="min-w-0 flex-1 space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={style.badge} className="capitalize">
                      {row.status}
                    </Badge>
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {row.callCount} calls · {formatDate(row.createdAt)}
                    </span>
                  </div>
                  <p className="truncate text-sm font-medium">{compactRequirement(row.requirement)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button asChild size="sm" variant="ghost">
                    <Link href={`/investigations/${row.id}/live`}>
                      {row.status === "running" ? "Watch" : "Live"}
                    </Link>
                  </Button>
                  {row.status === "completed" ? (
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/investigations/${row.id}/results`}>
                        Results <ChevronRight className="size-3.5" />
                      </Link>
                    </Button>
                  ) : null}
                  <DeleteInvestigationButton
                    investigationId={row.id}
                    onDeleted={onDeleted}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
