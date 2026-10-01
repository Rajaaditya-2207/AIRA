import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";
import { persistEvent } from "@/lib/events/log";
import { parseInvestigationInputText } from "@/lib/intake/parse";
import { mapCallToProgressItem, toDbLanguage } from "@/lib/mappers";
import { createInvestigationSchema } from "@/lib/validation/investigation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z
    .string()
    .transform((value) => value.toUpperCase())
    .pipe(z.enum(["DRAFT", "RUNNING", "COMPLETED", "FAILED"]))
    .optional(),
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = listQuerySchema.safeParse({
    limit: url.searchParams.get("limit") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query." }, { status: 400 });
  }

  const investigations = await db.investigation.findMany({
    where: parsed.data.status ? { status: parsed.data.status } : undefined,
    orderBy: { createdAt: "desc" },
    take: parsed.data.limit,
    select: {
      id: true,
      requirement: true,
      status: true,
      createdAt: true,
      completedAt: true,
      // UI reads `callCount`; Prisma's raw `_count` shape rendered as
      // "undefined calls" on every history row.
      _count: { select: { calls: true } },
    },
  });

  return NextResponse.json({
    investigations: investigations.map((item) => ({
      ...item,
      // Flatten Prisma's `_count.calls` into the `callCount` field the
      // History page renders.
      callCount: item._count.calls,
      status: item.status.toLowerCase(),
      createdAt: item.createdAt.toISOString(),
      completedAt: item.completedAt ? item.completedAt.toISOString() : null,
    })),
  });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = createInvestigationSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request payload.",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  let normalized: {
    requirement: string;
    contacts: Array<{
      name: string;
      phone: string;
      language: string;
    }>;
    questionHints: string[];
  };
  try {
    normalized = "inputText" in input
      ? await parseInvestigationInputText(input.inputText)
      : {
          requirement: input.requirement.trim(),
          contacts: input.contacts,
          questionHints: input.questionHints ?? [],
        };
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not parse investigation input.",
      },
      { status: 400 },
    );
  }

  let created;
  const requirementForExecution = composeRequirementForExecution(
    normalized.requirement,
    normalized.questionHints,
  );
  try {
    created = await db.$transaction(async (tx) => {
      const investigation = await tx.investigation.create({
        data: {
          requirement: requirementForExecution,
          status: "DRAFT",
          concurrency: 3,
        },
      });

      const calls = [];
      for (const contact of normalized.contacts) {
        const savedContact = await tx.contact.create({
          data: {
            investigationId: investigation.id,
            name: contact.name.trim(),
            phone: contact.phone.trim(),
            language: toDbLanguage(contact.language),
          },
        });

        const call = await tx.call.create({
          data: {
            investigationId: investigation.id,
            contactId: savedContact.id,
            status: "QUEUED",
          },
          include: {
            contact: true,
          },
        });

        calls.push(call);
      }

      return {
        investigation,
        calls,
      };
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/ECONNREFUSED|connect ECONNREFUSED|P1001/i.test(message)) {
      return NextResponse.json(
        {
          error: "Local database isn't reachable. Restart AIRA and try again.",
        },
        { status: 503 },
      );
    }
    throw error;
  }

  const snapshotPayload = {
    type: "investigation.snapshot" as const,
    investigationId: created.investigation.id,
    status: "draft" as const,
    requirement: created.investigation.requirement,
    calls: created.calls.map((call) => mapCallToProgressItem(call)),
    transcripts: [],
  };

  await persistEvent({
    investigationId: created.investigation.id,
    payload: snapshotPayload,
  });

  for (const call of created.calls) {
    await persistEvent({
      investigationId: created.investigation.id,
      callId: call.id,
      payload: {
        type: "call.status",
        investigationId: created.investigation.id,
        call: mapCallToProgressItem(call),
      },
    });
  }

  return NextResponse.json(
    {
      investigationId: created.investigation.id,
    },
    { status: 201 },
  );
}

function composeRequirementForExecution(requirement: string, questionHints: string[]) {
  const base = requirement.trim();
  const cleanedHints = Array.from(
    new Set(
      questionHints
        .map((hint) => hint.trim())
        .filter(Boolean),
    ),
  );

  if (!cleanedHints.length) {
    return base;
  }

  const topQuestions = cleanedHints.slice(0, 8);
  return [
    base,
    "",
    "Priority questions user wants answered:",
    ...topQuestions.map((question, index) => `${index + 1}. ${question}`),
  ].join("\n");
}
