import { describe, expect, it } from "vitest";

import { fromJsonText, toJsonText } from "./dbjson";

describe("dbjson helpers", () => {
  it("round-trips objects", () => {
    const value = { a: 1, b: ["x"], c: null };
    expect(fromJsonText(toJsonText(value))).toEqual(value);
  });

  it("returns fallback for null/undefined/empty text", () => {
    expect(fromJsonText<string[] | null>(null, null)).toBeNull();
    expect(fromJsonText<string[] | null>(undefined, null)).toBeNull();
    expect(fromJsonText<string[]>("", ["fallback"])).toEqual(["fallback"]);
  });

  it("returns fallback for malformed json instead of throwing", () => {
    expect(fromJsonText("{oops", { d: 1 })).toEqual({ d: 1 });
    expect(fromJsonText("not json at all", "fb")).toBe("fb");
  });

  it("serializes undefined as the string 'null'", () => {
    expect(toJsonText(undefined)).toBe("null");
    expect(toJsonText(null)).toBe("null");
    expect(toJsonText([1, 2])).toBe("[1,2]");
  });
});
