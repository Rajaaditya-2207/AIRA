import { NextResponse } from "next/server";
import { z } from "zod";

import { cancelInvestigation } from "@/lib/calls/control";
import { investigationParamsSchema } from "@/lib/validation/common";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ id: string }>;
};

const bodySchema = z.object({}).partial().optional();

export async function POST(request: Request, { params }: RouteContext) {
  const parsedParams = investigationParamsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid investigation id." }, { status: 400 });
  }
  await request.json().catch(() => null); // body optional; ignore contents
  void bodySchema;

  try {
    const result = await cancelInvestigation(parsedParams.data.id);
    if (!result.cancelled) {
      if (result.reason === "not-found") {
        return NextResponse.json({ error: "Investigation not found." }, { status: 404 });
      }
      return NextResponse.json({ error: result.reason }, { status: 409 });
    }
    return NextResponse.json({ ok: true, callsAffected: result.callsAffected });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cancel failed." },
      { status: 500 },
    );
  }
}
