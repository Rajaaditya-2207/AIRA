import { describe, expect, it } from "vitest";

import { formatOffset } from "./time";

describe("formatOffset", () => {
  it("formats seconds-since-start as mm:ss", () => {
    expect(formatOffset("2026-01-01T00:00:00.000Z", "2026-01-01T00:00:42.000Z")).toBe("00:42");
    expect(formatOffset("2026-01-01T00:00:00.000Z", "2026-01-01T00:05:07.000Z")).toBe("05:07");
  });

  it("clamps lines before start to 00:00", () => {
    expect(formatOffset("2026-01-01T00:01:00.000Z", "2026-01-01T00:00:30.000Z")).toBe("00:00");
  });

  it("returns em-dash when either timestamp is missing or invalid", () => {
    expect(formatOffset(null, "2026-01-01T00:00:00.000Z")).toBe("—");
    expect(formatOffset("not-a-date", "2026-01-01T00:00:00.000Z")).toBe("—");
  });
});
