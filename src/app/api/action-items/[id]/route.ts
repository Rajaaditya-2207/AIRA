import { NextResponse } from "next/server";
import { z } from "zod";

import { db } from "@/lib/db";

export const runtime = "nodejs";

const bodySchema = z.object({
  done: z.boolean(),
});

const paramsSchema = z.object({
  id: z.string().cuid(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, { params }: RouteContext) {
  const parsedParams = paramsSchema.safeParse(await params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: "Invalid action item id." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsedBody = bodySchema.safeParse(body);
  if (!parsedBody.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const updated = await db.actionItem.update({
      where: { id: parsedParams.data.id },
      data: { done: parsedBody.data.done },
    });
    return NextResponse.json({ id: updated.id, done: updated.done });
  } catch {
    return NextResponse.json({ error: "Action item not found." }, { status: 404 });
  }
}
