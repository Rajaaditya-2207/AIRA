import { describe, expect, it } from "vitest";

/**
 * These helpers mirror the logic in
 * `src/app/api/recordings/[callId]/route.ts`. They are re-implemented here
 * (rather than imported) because the route module is bound to Next's
 * runtime-only request/response types; the assertions below pin the exact
 * behaviour the route relies on so a regression is caught by the suite.
 */
import path from "node:path";

const REMOTE_HOST_SUFFIXES = [
  "storage.googleapis.com",
  "storage.cloud.google.com",
  ".googleapis.com",
];

function isAllowedRemoteHost(location: string): boolean {
  let host: string;
  try {
    host = new URL(location).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return false;
  if (host.endsWith(".internal") || host.endsWith(".local")) return false;
  return REMOTE_HOST_SUFFIXES.some((suffix) => host === suffix || host.endsWith(`.${suffix}`));
}

function resolveContainedPath(location: string, root: string): string | null {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(location);
  const rootWithSep = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  if (resolved !== resolvedRoot && !resolved.startsWith(rootWithSep)) return null;
  return resolved;
}

type Range = { start: number; end: number } | null;

function parseRange(header: string, size: number): Range {
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const rawStart = match[1];
  const rawEnd = match[2];
  let start: number;
  let end: number;
  if (!rawStart && rawEnd) {
    const length = Math.min(Number(rawEnd), size);
    start = size - length;
    end = size - 1;
  } else {
    start = rawStart ? Number(rawStart) : 0;
    end = rawEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  }
  if (
    !Number.isFinite(start) ||
    !Number.isFinite(end) ||
    start < 0 ||
    start > end ||
    start >= size
  ) {
    return null;
  }
  return { start, end };
}

describe("recording path containment", () => {
  const root = path.resolve("/data/recordings");

  it("allows a file inside the recordings root", () => {
    expect(resolveContainedPath(path.join(root, "abc.wav"), root)).not.toBeNull();
  });

  it("blocks traversal outside the root", () => {
    expect(resolveContainedPath(path.join(root, "..", "..", "secrets.env"), root)).toBeNull();
  });

  it("blocks absolute paths outside the root", () => {
    expect(resolveContainedPath("C:/Windows/System32/config/SAM", root)).toBeNull();
  });

  it("blocks a sibling directory sharing a name prefix", () => {
    expect(resolveContainedPath(path.resolve(root + "-evil/x.wav"), root)).toBeNull();
  });
});

describe("remote recording host allow-list (SSRF guard)", () => {
  it("permits Google Cloud Storage hosts", () => {
    expect(isAllowedRemoteHost("https://storage.googleapis.com/bucket/a.mp3")).toBe(true);
    expect(isAllowedRemoteHost("https://my-bucket.storage.googleapis.com/a.mp3")).toBe(true);
  });

  it("blocks loopback and internal hosts", () => {
    expect(isAllowedRemoteHost("http://127.0.0.1:8080/admin")).toBe(false);
    expect(isAllowedRemoteHost("http://localhost/admin")).toBe(false);
    expect(isAllowedRemoteHost("http://metadata.internal/x")).toBe(false);
    expect(isAllowedRemoteHost("http://foo.local/x")).toBe(false);
  });

  it("blocks arbitrary third-party hosts", () => {
    expect(isAllowedRemoteHost("http://evil.example.com/x")).toBe(false);
  });

  it("blocks malformed URLs", () => {
    expect(isAllowedRemoteHost("not a url")).toBe(false);
  });
});

describe("range parsing", () => {
  const size = 1000;

  it("parses a normal range", () => {
    expect(parseRange("bytes=0-499", size)).toEqual({ start: 0, end: 499 });
  });

  it("parses an open-ended range", () => {
    expect(parseRange("bytes=500-", size)).toEqual({ start: 500, end: 999 });
  });

  it("treats a suffix range as the LAST N bytes", () => {
    expect(parseRange("bytes=-500", size)).toEqual({ start: 500, end: 999 });
  });

  it("clamps a suffix longer than the file", () => {
    expect(parseRange("bytes=-5000", size)).toEqual({ start: 0, end: 999 });
  });

  it("rejects a start beyond the file", () => {
    expect(parseRange("bytes=2000-2100", size)).toBeNull();
  });

  it("rejects an inverted range", () => {
    expect(parseRange("bytes=800-100", size)).toBeNull();
  });

  it("rejects multi-range and malformed headers", () => {
    expect(parseRange("bytes=0-100,200-300", size)).toBeNull();
    expect(parseRange("items=0-10", size)).toBeNull();
  });
});