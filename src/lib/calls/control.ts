import { db } from "@/lib/db";
import { persistEvent } from "@/lib/events/log";
import { logger } from "@/lib/logger";

const ACTIVE_CALL_STATUSES = ["QUEUED", "DIALING", "RINGING", "CONNECTED"] as const;

export type CancelResult =
  | { cancelled: true; callsAffected: number }
  | { cancelled: false; reason: "not-found" | string };

/**
 * Cancels an in-flight investigation:
 * - investigation -> FAILED (completedAt now)
 * - every non-terminal call -> FAILED with a user-visible reason (bulk)
 * - LiveKit hangup is best-effort per call (room/participant may be gone)
 */
export async function cancelInvestigation(investigationId: string): Promise<CancelResult> {
  const investigation = await db.investigation.findUnique({
    where: { id: investigationId },
    include: {
      calls: {
        where: { status: { in: [...ACTIVE_CALL_STATUSES] } },
      },
    },
  });

  if (!investigation) {
    return { cancelled: false, reason: "not-found" };
  }
  if (investigation.status === "COMPLETED") {
    return { cancelled: false, reason: "Investigation already finished." };
  }

  await db.investigation.update({
    where: { id: investigationId },
    data: { status: "FAILED", completedAt: new Date() },
  });

  const flipped = await db.call.updateMany({
    where: {
      investigationId,
      status: { in: [...ACTIVE_CALL_STATUSES] },
    },
    data: {
      status: "FAILED",
      failureReason: "Cancelled by user.",
      endedAt: new Date(),
    },
  });

  // Best-effort hangups after the DB flip so the UI reacts immediately.
  await Promise.all(
    investigation.calls
      .filter((call) => call.livekitRoomName && call.livekitParticipant)
      .map(async (call) => {
        try {
          const { hangupLiveKitParticipant } = await import("./livekit");
          await hangupLiveKitParticipant(call.livekitRoomName!, call.livekitParticipant!);
        } catch (error) {
          logger.warn("control.cancel.hangupFailed", {
            callId: call.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }),
  );

  await persistEvent({
    investigationId,
    payload: {
      type: "investigation.failed",
      investigationId,
      reason: "Cancelled by user.",
    },
  });
  logger.info("control.cancel.done", { investigationId, calls: flipped.count });

  return { cancelled: true, callsAffected: flipped.count };
}

/**
 * Guard used by the retry endpoint: retries are allowed on FAILED or
 * COMPLETED investigations (re-run one call), never while RUNNING.
 */
export async function assertInvestigationAcceptsRetries(investigationId: string): Promise<boolean> {
  const investigation = await db.investigation.findUnique({
    where: { id: investigationId },
    select: { status: true },
  });
  if (!investigation) {
    throw new Error("Investigation not found.");
  }
  if (investigation.status === "RUNNING") {
    throw new Error("Investigation is still running — cancel it before retrying individual calls.");
  }
  return true;
}
