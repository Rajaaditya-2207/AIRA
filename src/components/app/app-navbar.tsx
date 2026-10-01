"use client";

import Link from "next/link";
import { useParams, usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";

import { AiraMark } from "@/components/brand/aira-mark";
import { SignalStrip } from "@/components/brand/signal-strip";
import { ThemeToggle } from "@/components/app/theme-toggle";
import { SettingsDialog } from "@/components/settings/settings-dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AppNavbar() {
  const pathname = usePathname();
  const params = useParams<{ id?: string }>();
  const router = useRouter();
  const backHref = getBackHref(pathname);
  const canGoBack = pathname !== "/";
  const [anyLive, setAnyLive] = useState(false);

  // App-level pulse: is any investigation on the air right now?
  // Cheap indexed poll; skipped while already watching a live page (its SSE
  // keeps the strip alive through `anyLive` set below).
  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        const response = await fetch("/api/investigations?limit=1&status=running", {
          cache: "no-store",
        });
        if (!response.ok) return;
        const payload = (await response.json()) as { investigations?: unknown[] };
        if (!cancelled) setAnyLive((payload.investigations?.length ?? 0) > 0);
      } catch {
        /* offline — leave previous state */
      }
    };
    if (pathname.includes("/live")) {
      // Derive during render instead of setting state in the effect body.
    } else {
      void check();
      const handle = setInterval(check, 30_000);
      return () => {
        cancelled = true;
        clearInterval(handle);
      };
    }
  }, [pathname, params?.id]);

  return (
    <nav className="sticky top-0 z-50 border-b border-border/60 bg-background/85 backdrop-blur-xl">
      <div className="flex h-14 w-full items-center justify-between gap-3 px-[var(--aira-gutter)]">
        <div className="flex items-center gap-2">
          {canGoBack ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                if (typeof window !== "undefined" && window.history.length > 1) {
                  router.back();
                  return;
                }
                router.push(backHref);
              }}
              className="rounded-full"
            >
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : null}
          <Link href="/" className="inline-flex items-center gap-2.5">
            <AiraMark className="size-7 rounded-[8px]" />
            <span className="font-display text-base font-semibold tracking-tight">AIRA</span>
          </Link>
          <SignalStrip active={anyLive} className="ml-1" />
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <SettingsDialog />
          <NavLink href="/" active={isHomePath(pathname)}>
            New Investigation
          </NavLink>
          <NavLink href="/investigations" active={isInvestigationsPath(pathname)}>
            Investigations
          </NavLink>
        </div>
      </div>
    </nav>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "relative rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground",
        active && "text-foreground",
      )}
    >
      {children}
      {active ? (
        <span className="absolute inset-x-4 -bottom-[13px] h-[2px] rounded-full bg-linear-to-r from-[var(--aira-gradient-from)] to-[var(--aira-gradient-to)]" />
      ) : null}
    </Link>
  );
}

function getBackHref(pathname: string) {
  if (pathname === "/" || pathname === "/investigations") {
    return "/";
  }

  const parts = pathname.split("/").filter(Boolean);
  if (parts[0] === "investigations" && parts[2] === "results" && parts[1]) {
    return `/investigations/${parts[1]}/live`;
  }

  if (parts[0] === "investigations") {
    return "/investigations";
  }

  return "/";
}

function isHomePath(pathname: string) {
  return pathname === "/";
}

function isInvestigationsPath(pathname: string) {
  return pathname === "/investigations" || pathname.startsWith("/investigations/");
}
