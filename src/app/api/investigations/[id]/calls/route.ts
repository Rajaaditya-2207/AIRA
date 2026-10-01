import { NextResponse } from "next/server";
import { z } from "zod";

import { fromJsonText } from "@/lib/dbjson";
import { db } from "@/lib/db";
import { getCallRecordingUrlIfExists } from "@/lib/calls/recording-store";
import { fromDbInvestigationStatus, fromDbLanguage } from "@/lib/mappers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paramsSchema = z.object({
  id: z.string().cuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export type CallDetail = {
  id: string;
  contactName: string;
  phone: string;
  language: string;
  status: string;
  score: number | null;
  failureReason: string | null;
  startedAt: string | null;
  endedAt: string | null;
  recordingUrl: string | null;
  finding: {
    summary: string | null;
    monthlyPrice: number | null;
    availability: string | null;
    locationFit: string | null;
    confidence: number | null;
    rules: string[];
    keyFacts: string[];
    actionItems: string[];
  } | null;
};

export async function GET(_request: Request, { params }: RouteContext) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid investigation id." }, { status: 400 });
  }
  const { id } = parsedParams.data;

  const investigation = await db.investigation.findUnique({
    where: { id },
    include: {
      calls: {
        orderBy: { createdAt: "asc" },
        include: { contact: true, extractedFinding: true },
      },
    },
  });
  if (!investigation) {
    return NextResponse.json({ error: "Investigation not found." }, { status: 404 });
  }

  const calls: CallDetail[] = await Promise.all(
    investigation.calls.map(async (call) => {
      const finding = call.extractedFinding;
      const extraction = finding
        ? (extractExtractionPayload(fromJsonText<unknown>(finding.raw)) ?? {})
        : {};

      return {
        id: call.id,
        contactName: call.contact.name,
        phone: call.contact.phone,
        language: fromDbLanguage(call.contact.language),
        status: call.status.toLowerCase(),
        score: call.score,
        failureReason: call.failureReason,
        startedAt: call.startedAt ? call.startedAt.toISOString() : null,
        endedAt: call.endedAt ? call.endedAt.toISOString() : null,
        recordingUrl: await getCallRecordingUrlIfExists(call.id),
        finding: finding
          ? {
              summary: finding.summary,
              monthlyPrice: finding.monthlyPrice,
              availability: finding.availability,
              locationFit: finding.locationFit,
              confidence: finding.confidence,
              rules: getStringArray(finding.rules ? fromJsonText<unknown>(finding.rules) : null),
              keyFacts: getStringArray(extraction.keyFacts),
              actionItems: getStringArray(extraction.actionItems),
            }
          : null,
      };
    }),
  );

  return NextResponse.json({
    investigationId: investigation.id,
    status: fromDbInvestigationStatus(investigation.status),
    calls,
  });
}

function extractExtractionPayload(raw: unknown): Record<string, unknown> | null {
  if (!isRecord(raw)) {
    return null;
  }
  const nested = raw.extraction;
  return isRecord(nested) ? nested : raw;
}

function getStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
