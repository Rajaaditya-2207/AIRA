import { describe, expect, it } from "vitest";

import { humanizeError } from "./errors";

describe("humanizeError", () => {
  it("maps gemini key errors to setup guidance", () => {
    const mapped = humanizeError("Missing required env var GEMINI_API_KEY.");
    expect(mapped.title).toBe("AI parser isn't set up yet");
    expect(mapped.hint).toContain("Settings");
    expect(mapped.raw).toContain("GEMINI_API_KEY");
  });

  it("maps database errors to restart guidance", () => {
    const mapped = humanizeError("Error querying the database: P1001");
    expect(mapped.title).toBe("Local database isn't ready");
    expect(mapped.hint).toContain("Restart AIRA");
  });

  it("falls back to a generic title with raw preserved", () => {
    const mapped = humanizeError("Some totally unexpected failure");
    expect(mapped.title).toBe("Something went wrong");
    expect(mapped.hint).toBe("");
    expect(mapped.raw).toBe("Some totally unexpected failure");
  });

  it("handles empty messages", () => {
    const mapped = humanizeError("");
    expect(mapped.raw).toBe("Unknown error");
  });
});
