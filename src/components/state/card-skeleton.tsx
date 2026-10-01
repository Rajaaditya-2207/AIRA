import { cn } from "@/lib/utils";

type CardSkeletonProps = {
  className?: string;
  lines?: number;
};

/** Pulse placeholder matching the Card metrics used across AIRA pages. */
export function CardSkeleton({ className, lines = 3 }: CardSkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse space-y-4 rounded-xl border border-border/70 bg-card/60 p-5",
        className,
      )}
      aria-hidden
    >
      <div className="h-4 w-1/3 rounded bg-muted" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div key={index} className="h-3 w-full rounded bg-muted" />
        ))}
      </div>
    </div>
  );
}
