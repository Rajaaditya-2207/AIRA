"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { humanizeError } from "@/lib/errors";

type ErrorStateProps = {
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
};

export function ErrorState({ message, onRetry, retrying, className }: ErrorStateProps) {
  const mapped = humanizeError(message);
  const [showRaw, setShowRaw] = useState(false);

  return (
    <div
      className={
        className ??
        "flex flex-col items-start gap-3 rounded-xl border border-dashed border-destructive/40 bg-destructive/5 p-5"
      }
      role="alert"
    >
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{mapped.title}</p>
        {mapped.hint ? <p className="text-sm text-muted-foreground">{mapped.hint}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {onRetry ? (
          <Button size="sm" variant="outline" disabled={retrying} onClick={onRetry}>
            {retrying ? "Retrying…" : "Try again"}
          </Button>
        ) : null}
        <button
          type="button"
          className="text-xs text-muted-foreground underline-offset-4 hover:underline"
          onClick={() => setShowRaw((current) => !current)}
        >
          {showRaw ? "Hide details" : "Show details"}
        </button>
      </div>
      {showRaw ? (
        <pre className="max-h-32 w-full overflow-auto rounded-md bg-muted/60 p-3 text-xs text-muted-foreground">
          {mapped.raw}
        </pre>
      ) : null}
    </div>
  );
}
