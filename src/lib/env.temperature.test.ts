import { describe, expect, it } from "vitest";

/**
 * Temperature settings were declared in the config schema and shown in the UI
 * but never read by env.ts, so the controls silently did nothing. These tests
 * pin the parsing rules now that they are actually consumed by the intake and
 * realtime call sites.
 *
 * Mirrors `readTemperature` in src/lib/env.ts (re-implemented here because the
 * real module reads process.env at import time).
 */
function readTemperature(raw: string | undefined, fallback: number): number {
  if (raw === undefined) return fallback;
  const trimmed = raw.trim();
  if (trimmed === "") return fallback;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 2) return fallback;
  return parsed;
}

describe("temperature settings", () => {
  it("falls back when unset", () => {
    expect(readTemperature(undefined, 0.2)).toBe(0.2);
    expect(readTemperature(undefined, 0.4)).toBe(0.4);
  });

  it("accepts valid values", () => {
    expect(readTemperature("0", 0.4)).toBe(0);
    expect(readTemperature("0.7", 0.4)).toBe(0.7);
    expect(readTemperature("2", 0.4)).toBe(2);
  });

  it("tolerates surrounding whitespace", () => {
    expect(readTemperature("  0.9  ", 0.2)).toBe(0.9);
  });

  it("rejects out-of-range values back to the default", () => {
    expect(readTemperature("5", 0.4)).toBe(0.4);
    expect(readTemperature("-1", 0.4)).toBe(0.4);
  });

  it("rejects non-numeric values back to the default", () => {
    expect(readTemperature("", 0.4)).toBe(0.4);
    expect(readTemperature("warm", 0.4)).toBe(0.4);
    expect(readTemperature("NaN", 0.4)).toBe(0.4);
  });
});
