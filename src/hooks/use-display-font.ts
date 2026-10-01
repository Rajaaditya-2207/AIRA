"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Display-font preference (user decision #2).
 * Choices map to CSS font stacks written onto --aira-font-display.
 * Persisted in localStorage (instant, per-machine) and mirrored into
 * settings.json by the Settings dialog when running as a desktop app.
 */

export const DISPLAY_FONTS = [
  { id: "sora", label: "Sora", stack: "var(--font-sora), var(--font-geist-sans), system-ui, sans-serif" },
  { id: "bricolage", label: "Bricolage Grotesque", stack: "var(--font-bricolage), var(--font-sora), sans-serif" },
  { id: "inter", label: "Inter", stack: "var(--font-inter), var(--font-geist-sans), system-ui, sans-serif" },
  { id: "system", label: "System", stack: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
] as const;

export type DisplayFontId = (typeof DISPLAY_FONTS)[number]["id"];

const DEFAULT_FONT: DisplayFontId = "sora";

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  return () => observer.disconnect();
}

function readId(): DisplayFontId {
  try {
    const saved = localStorage.getItem("aira-font-id") as DisplayFontId | null;
    if (saved && DISPLAY_FONTS.some((font) => font.id === saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  return DEFAULT_FONT;
}

/**
 * Each font's stack begins with its own unique `var(--font-*)` token.
 * Identify the active font by that leading token — NOT by substring probes,
 * which collide (Bricolage's stack embeds Sora as its fallback, so a probe
 * for Sora matched a Bricolage selection and highlighted the wrong card).
 */
const LEADING_VAR: Record<DisplayFontId, string | null> = {
  sora: "var(--font-sora)",
  bricolage: "var(--font-bricolage)",
  inter: "var(--font-inter)",
  system: null, // plain system-ui stack — no var token
};

const getSnapshot = (): DisplayFontId => {
  const style = document.documentElement.style.getPropertyValue("--aira-font-display");
  if (!style) return readId();
  const applied = style.replace(/^[\s'"]+/, "");
  if (!applied.startsWith("var(")) return "system";
  const match = DISPLAY_FONTS.find((font) => {
    const lead = LEADING_VAR[font.id];
    return lead !== null && applied.startsWith(lead);
  });
  return match?.id ?? readId();
};

const getServerSnapshot = (): DisplayFontId => DEFAULT_FONT;

export function useDisplayFont(): {
  fontId: DisplayFontId;
  setFontId: (id: DisplayFontId) => void;
} {
  const fontId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setFontId = useCallback((id: DisplayFontId) => {
    const font = DISPLAY_FONTS.find((entry) => entry.id === id) ?? DISPLAY_FONTS[0];
    document.documentElement.style.setProperty("--aira-font-display", font.stack);
    try {
      localStorage.setItem("aira-font-id", id);
      localStorage.setItem("aira-font", font.stack);
    } catch {
      /* storage unavailable */
    }
    // Mirror into settings.json (desktop) so the choice survives reinstalls,
    // cleared app data, or a second machine — not just this browser profile.
    void window.aira?.saveSettings({ AIRA_DISPLAY_FONT: font.id }).catch(() => {});
  }, []);

  return { fontId, setFontId };
}
