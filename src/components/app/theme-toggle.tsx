"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";

import { Button } from "@/components/ui/button";

/** Re-render whenever the <html> class list changes (theme flips). */
function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

const getSnapshot = () => document.documentElement.classList.contains("dark");
const getServerSnapshot = () => false;

export function ThemeToggle() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggle = useCallback(() => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("aira-theme", next ? "dark" : "light");
    } catch {
      /* storage unavailable */
    }
  }, []);

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="rounded-full"
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      onClick={toggle}
    >
      {isDark ? <Moon className="size-4" /> : <Sun className="size-4" />}
    </Button>
  );
}
