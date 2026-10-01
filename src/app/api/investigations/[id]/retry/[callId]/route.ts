import { NextResponse } from "next/server";
import { z } from "zod";

import { assertInvestigationAcceptsRetries } from "@/lib/calls/control";
import { finalizeInvestigation, runSingleCall } from "@/lib/calls/orchestrator";
import { persistEvent } from "@/lib/events/log";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string; callId: string }>;
};

const paramsSchema = z.object({
  id: z.string().cuid(),
  callId: z.string().cuid(),
});

export async function POST(_request: Request, { params }: RouteContext) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid id." }, { status: 400 });
  }
  const { id, callId } = parsedParams.data;

  try {
    await assertInvestigationAcceptsRetries(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Retry not allowed.";
    // A missing investigation is a 404, not a 409 — every other failure here
    // is a genuine "wrong state to retry from" conflict.
    return NextResponse.json(
      { error: message },
      { status: /not found/i.test(message) ? 404 : 409 },
    );
  }

  const call = await db.call.findUnique({
    where: { id: callId },
    include: { contact: true, investigation: { select: { requirement: true } } },
  });
  if (!call || call.investigationId !== id) {
    return NextResponse.json({ error: "Call not found in this investigation." }, { status: 404 });
  }

  // Mark RUNNING so the UI shows live progress; single-call runs reuse the
  // orchestrator's per-call pipeline including retries and analysis.
  await db.investigation.update({
    where: { id },
    data: { status: "RUNNING", startedAt: call.startedAt ?? new Date(), completedAt: null },
  });
  await persistEvent({
    investigationId: id,
    payload: {
      type: "call.status",
      investigationId: id,
      call: {
        id: call.id,
        contactName: call.contact.name,
        phone: call.contact.phone,
        language: call.contact.language,
        status: "dialing",
        score: call.score,
        startedAt: call.startedAt ? call.startedAt.toISOString() : null,
        failureReason: null,
        updatedAt: new Date().toISOString(),
      },
    },
  });

  // runSingleCall persists per-call state and never rejects, so the previous
  // `.catch(...)` here was unreachable: the investigation stayed RUNNING
  // forever and the retried call was never re-ranked. Finalize explicitly.
  void (async () => {
    try {
      await runSingleCall(id, call, call.investigation.requirement);
    } catch (error) {
      appendRetryFailure(id, error);
    }
    await finalizeInvestigation(id);
  })();

  return NextResponse.json({ ok: true, callId }, { status: 202 });
}

function appendRetryFailure(investigationId: string, error: unknown): Promise<void> {
  return persistEvent({
    investigationId,
    payload: {
      type: "investigation.failed",
      investigationId,
      reason: error instanceof Error ? error.message : "Retry failed.",
    },
  }).catch(() => undefined);
}
