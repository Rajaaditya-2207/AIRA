import fs from "node:fs";
import path from "node:path";

import { Storage } from "@google-cloud/storage";
import { NextResponse } from "next/server";
import { z } from "zod";

import { getCallRecordingMetadata } from "@/lib/calls/recording-store";
import { getRecordingConfig } from "@/lib/env";

export const runtime = "nodejs";

const paramsSchema = z.object({
  callId: z.string().cuid(),
});

type RouteContext = {
  params: Promise<{ callId: string }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid call id." }, { status: 400 });
  }

  const metadata = await getCallRecordingMetadata(parsedParams.data.callId);
  if (!metadata) {
    return NextResponse.json({ error: "Recording not found." }, { status: 404 });
  }

  // Local provider: recording lives on this machine (desktop app / seeded demos).
  if (metadata.provider === "local") {
    return serveLocalFile(request, metadata.location);
  }

  if (metadata.provider !== "gcp") {
    return NextResponse.json({ error: "Unsupported recording provider." }, { status: 501 });
  }

  const recordingConfig = (() => {
    try {
      return getRecordingConfig();
    } catch {
      return null;
    }
  })();
  if (!recordingConfig || recordingConfig.provider !== "gcp") {
    return NextResponse.json({ error: "Recording storage is not configured." }, { status: 503 });
  }

  const projectId = getProjectId(recordingConfig.gcpCredentials);
  const storage = new Storage({
    credentials: recordingConfig.gcpCredentials as { [key: string]: string },
    projectId,
  });

  const location = parseStorageLocation(metadata.location);
  if (location) {
    const file = storage.bucket(location.bucket).file(location.object);
    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: "Recording file not found in bucket." }, { status: 404 });
    }

    const [audio] = await file.download();
    return new Response(new Uint8Array(audio), {
      status: 200,
      headers: {
        "content-type": "audio/mpeg",
        "cache-control": "private, max-age=120",
      },
    });
  }

  if (metadata.location.startsWith("http://") || metadata.location.startsWith("https://")) {
    // Only Google Cloud Storage hosts may be fetched. Anything else would let a
    // tampered metadata file turn this route into an SSRF proxy against internal
    // network services / cloud metadata endpoints.
    if (!isAllowedRemoteHost(metadata.location)) {
      return NextResponse.json(
        { error: "Recording location host is not allowed." },
        { status: 400 },
      );
    }
    const upstream = await fetch(metadata.location).catch(() => null);
    if (!upstream?.ok) {
      return NextResponse.json({ error: "Recording file not reachable." }, { status: 502 });
    }
    // Cap the buffered body so a hostile/large upstream can't exhaust memory.
    const audio = await readCapped(upstream, MAX_REMOTE_BYTES);
    if (audio === null) {
      return NextResponse.json({ error: "Recording file too large." }, { status: 502 });
    }
    return new Response(audio, {
      status: 200,
      headers: {
        "content-type": upstream.headers.get("content-type") ?? "audio/mpeg",
        "cache-control": "private, max-age=120",
      },
    });
  }

  return NextResponse.json({ error: "Invalid recording location." }, { status: 500 });
}

function parseStorageLocation(location: string) {
  if (location.startsWith("gs://")) {
    const value = location.slice("gs://".length);
    const firstSlash = value.indexOf("/");
    if (firstSlash <= 0) {
      return null;
    }

    const bucket = value.slice(0, firstSlash);
    const object = value.slice(firstSlash + 1);
    if (!bucket || !object) {
      return null;
    }

    return { bucket, object: decodeURIComponent(object) };
  }

  if (!location.startsWith("http://") && !location.startsWith("https://")) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(location);
  } catch {
    return null;
  }

  const host = parsed.hostname.toLowerCase();
  const pathname = parsed.pathname.replace(/^\/+/, "");
  if (!pathname) {
    return null;
  }

  if (host === "storage.googleapis.com" || host === "storage.cloud.google.com") {
    const firstSlash = pathname.indexOf("/");
    if (firstSlash <= 0) {
      return null;
    }

    const bucket = pathname.slice(0, firstSlash);
    const object = pathname.slice(firstSlash + 1);
    if (!bucket || !object) {
      return null;
    }
    return { bucket, object: decodeURIComponent(object) };
  }

  const bucketSubdomainSuffixes = [".storage.googleapis.com", ".storage.cloud.google.com"];
  for (const suffix of bucketSubdomainSuffixes) {
    if (host.endsWith(suffix)) {
      const bucket = host.slice(0, -suffix.length);
      if (!bucket || !pathname) {
        return null;
      }
      return { bucket, object: decodeURIComponent(pathname) };
    }
  }

  return null;
}

function getProjectId(credentials: Record<string, unknown>) {
  const value = credentials.project_id;
  return typeof value === "string" ? value : undefined;
}

/** Only GCS hosts are fetchable for remote recordings (SSRF guard). */
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

const MAX_REMOTE_BYTES = 64 * 1024 * 1024;

async function readCapped(response: Response, cap: number): Promise<ArrayBuffer | null> {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > cap) return null;
  const buffer = await response.arrayBuffer();
  return buffer.byteLength > cap ? null : buffer;
}

/**
 * Resolve a recording path and refuse anything outside the recordings root.
 * Without this containment check a tampered metadata JSON turns the route into
 * an arbitrary-file-read primitive.
 */
function resolveContainedPath(location: string): string | null {
  const root = path.resolve(
    process.env.AIRA_RECORDINGS_DIR ?? path.join(process.cwd(), ".callagent-recordings"),
  );
  const resolved = path.resolve(location);
  const rootWithSep = root.endsWith(path.sep) ? root : root + path.sep;
  if (resolved !== root && !resolved.startsWith(rootWithSep)) {
    return null;
  }
  return resolved;
}

function serveLocalFile(request: Request, location: string): Response {
  const filePath = resolveContainedPath(location);
  if (!filePath) {
    return NextResponse.json({ error: "Invalid recording path." }, { status: 400 });
  }
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Recording file missing on disk." }, { status: 404 });
  }
  const stat = fs.statSync(filePath);
  if (!stat.isFile()) {
    return NextResponse.json({ error: "Recording is not a file." }, { status: 400 });
  }
  const mime = filePath.toLowerCase().endsWith(".wav") ? "audio/wav" : "audio/mpeg";

  const range = request.headers.get("range");
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
    if (!match) {
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${stat.size}` },
      });
    }
    const rawStart = match[1];
    const rawEnd = match[2];
    let start: number;
    let end: number;
    if (!rawStart && rawEnd) {
      // Suffix range: `bytes=-500` means the LAST 500 bytes, not the first.
      const length = Math.min(Number(rawEnd), stat.size);
      start = stat.size - length;
      end = stat.size - 1;
    } else {
      start = rawStart ? Number(rawStart) : 0;
      end = rawEnd ? Math.min(Number(rawEnd), stat.size - 1) : stat.size - 1;
    }
    if (
      !Number.isFinite(start) ||
      !Number.isFinite(end) ||
      start < 0 ||
      start > end ||
      start >= stat.size
    ) {
      return new Response(null, {
        status: 416,
        headers: { "content-range": `bytes */${stat.size}` },
      });
    }
    const chunk = Buffer.alloc(end - start + 1);
    const fd = fs.openSync(filePath, "r");
    try {
      fs.readSync(fd, chunk, 0, chunk.length, start);
    } finally {
      fs.closeSync(fd);
    }
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "content-type": mime,
        "content-length": String(chunk.length),
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "accept-ranges": "bytes",
        "cache-control": "private, max-age=3600",
      },
    });
  }

  const buf = fs.readFileSync(filePath);
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "content-type": mime,
      "content-length": String(buf.length),
      "accept-ranges": "bytes",
      "cache-control": "private, max-age=3600",
    },
  });
}
