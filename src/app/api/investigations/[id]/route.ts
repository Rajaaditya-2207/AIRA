import fs from "node:fs";
import path from "node:path";

import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * Permanently deletes an investigation and everything attached to it:
 * DB cascade removes calls, transcripts, findings, recommendations,
 * action items and event logs; local recording files are removed best-effort.
 */
export async function DELETE(_request: Request, { params }: RouteContext) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid investigation id." }, { status: 400 });
  }
  const { id } = parsedParams.data;

  const investigation = await db.investigation.findUnique({
    where: { id },
    include: { calls: { select: { id: true } } },
  });
  if (!investigation) {
    return NextResponse.json({ error: "Investigation not found." }, { status: 404 });
  }

  // Best-effort local recording cleanup (metadata + cached audio).
  const metaDir = path.join(process.cwd(), ".callagent-recordings");
  const legacyDir = path.join(process.cwd(), "public", "recordings");
  const cacheDir = process.env.AIRA_RECORDINGS_DIR ?? path.join(metaDir, "cache");

  for (const call of investigation.calls) {
    const candidates = [
      path.join(metaDir, `${call.id}.json`),
      path.join(legacyDir, `${call.id}.mp3`),
      path.join(cacheDir, `${call.id}.mp3`),
      path.join(cacheDir, `${call.id}.wav`),
    ];
    for (const file of candidates) {
      try {
        if (fs.existsSync(file)) {
          fs.unlinkSync(file);
        }
      } catch (error) {
        logger.warn("api.delete.recordingCleanupFailed", { file, error: String(error) });
      }
    }
  }

  await db.investigation.delete({ where: { id } });

  logger.info("api.delete.done", { investigationId: id, calls: investigation.calls.length });
  return NextResponse.json({ ok: true, calls: investigation.calls.length });
}
