import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { mapTranscriptToLine } from "@/lib/mappers";

export const runtime = "nodejs";

const paramsSchema = z.object({
  callId: z.string().cuid(),
});

type RouteContext = {
  params: Promise<{ callId: string }>;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid call id." }, { status: 400 });
  }
  const { callId } = parsedParams.data;

  const call = await db.call.findUnique({
    where: { id: callId },
    select: {
      id: true,
      startedAt: true,
      contact: { select: { name: true } },
    },
  });
  if (!call) {
    return NextResponse.json({ error: "Call not found." }, { status: 404 });
  }

  const rows = await db.transcriptEvent.findMany({
    where: { callId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({
    callId,
    contactName: call.contact.name,
    startedAt: call.startedAt ? call.startedAt.toISOString() : null,
    lines: rows.map(mapTranscriptToLine),
  });
}
