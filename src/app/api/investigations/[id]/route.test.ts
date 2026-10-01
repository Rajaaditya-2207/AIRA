import { beforeEach, describe, expect, it, vi } from "vitest";

const { db, fsMock } = vi.hoisted(() => ({
  db: {
    investigation: { findUnique: vi.fn(), delete: vi.fn() },
    call: { findMany: vi.fn() },
  },
  fsMock: {
    existsSync: vi.fn(),
    unlinkSync: vi.fn(),
    rmSync: vi.fn(),
  },
}));

vi.mock("@/lib/db", () => ({ db }));
vi.mock("node:fs", () => fsMock);

import { DELETE } from "./route";

const INV_ID = "c0000000000000000000000001";

function makeRequest(): Request {
  return new Request(`http://localhost/api/investigations/${INV_ID}`, { method: "DELETE" });
}

describe("DELETE /api/investigations/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fsMock.existsSync.mockReturnValue(false);
  });

  it("deletes the investigation and reports affected calls", async () => {
    db.investigation.findUnique.mockResolvedValue({ id: INV_ID, status: "COMPLETED", calls: [{ id: "c00000000000000000000000ca" }, { id: "c00000000000000000000000cb" }] });
    db.investigation.delete.mockResolvedValue({});

    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: INV_ID }) });
    const payload = (await response.json()) as { ok: boolean; calls: number };

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.calls).toBe(2);
    expect(db.investigation.delete).toHaveBeenCalledWith({ where: { id: INV_ID } });
  });

  it("returns 404 for unknown investigation", async () => {
    db.investigation.findUnique.mockResolvedValue(null);

    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: INV_ID }) });

    expect(response.status).toBe(404);
    expect(db.investigation.delete).not.toHaveBeenCalled();
  });

  it("rejects invalid ids", async () => {
    const response = await DELETE(makeRequest(), { params: Promise.resolve({ id: "not-a-cuid" }) });
    expect(response.status).toBe(400);
  });
});
