import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, persistEvent } = vi.hoisted(() => ({
  db: {
    investigation: { findUnique: vi.fn(), update: vi.fn() },
    call: { updateMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
    eventLog: { create: vi.fn() },
  },
  persistEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("@/lib/events/log", () => ({ persistEvent }));

import { assertInvestigationAcceptsRetries, cancelInvestigation } from "./control";

describe("cancelInvestigation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  it("marks non-terminal calls as cancelled-failed", async () => {
    db.investigation.findUnique.mockResolvedValue({ id: "inv1", status: "RUNNING", calls: [] });
    db.investigation.update.mockResolvedValue({});
    db.call.updateMany.mockResolvedValue({ count: 2 });

    const result = await cancelInvestigation("inv1");

    expect(result.cancelled).toBe(true);
    expect(db.call.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          investigationId: "inv1",
          status: { in: ["QUEUED", "DIALING", "RINGING", "CONNECTED"] },
        }),
        data: expect.objectContaining({ status: "FAILED" }),
      }),
    );
  });

  it("refuses to cancel an already-completed investigation", async () => {
    db.investigation.findUnique.mockResolvedValue({ id: "inv2", status: "COMPLETED", calls: [] });

    const result = await cancelInvestigation("inv2");

    if (result.cancelled) {
      throw new Error("Expected cancellation to be refused");
    }
    expect(result.reason).toContain("already finished");
    expect(db.call.updateMany).not.toHaveBeenCalled();
  });

  it("reports missing investigations", async () => {
    db.investigation.findUnique.mockResolvedValue(null);
    const result = await cancelInvestigation("nope");
    if (result.cancelled) {
      throw new Error("Expected cancellation to be refused");
    }
    expect(result.reason).toBe("not-found");
  });
});

describe("assertInvestigationAcceptsRetries", () => {
  it("allows retries on FAILED investigations", async () => {
    db.investigation.findUnique.mockResolvedValue({ id: "inv3", status: "FAILED" });
    await expect(assertInvestigationAcceptsRetries("inv3")).resolves.toBe(true);
  });

  it("rejects retries while investigation is RUNNING", async () => {
    db.investigation.findUnique.mockResolvedValue({ id: "inv4", status: "RUNNING" });
    await expect(assertInvestigationAcceptsRetries("inv4")).rejects.toThrow(/still running/i);
  });
});
