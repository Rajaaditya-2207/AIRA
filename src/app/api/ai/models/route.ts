import { NextRequest, NextResponse } from "next/server";
import { getModels } from "@/lib/ai/client";
import { getEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/ai/models
 * 
 * Returns filtered Gemini model lists for intake and realtime use.
 * 
 * Query Parameters:
 * - refresh: "true" to force cache bypass (optional)
 *
 * The API key is NEVER accepted as a query parameter — query strings land in
 * access logs, Referer headers and browser history. It is read from the
 * server-side environment/settings instead.
 * 
 * Response:
 * {
 *   intakeModels: IntakeModelOption[],
 *   realtimeModels: RealtimeModelOption[],
 *   fetchedAt: number,
 *   fromCache: boolean,
 *   warning?: string
 * }
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const refresh = searchParams.get("refresh") === "true";

  const apiKey = getEnv().GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "No Gemini API key configured. Add it in Settings → AI." },
      { status: 400 }
    );
  }

  try {
    const result = await getModels(apiKey, refresh);

    // Add warning if using stale cache
    const response: {
      intakeModels: typeof result.intakeModels;
      realtimeModels: typeof result.realtimeModels;
      fetchedAt: number;
      fromCache: boolean;
      warning?: string;
    } = {
      intakeModels: result.intakeModels,
      realtimeModels: result.realtimeModels,
      fetchedAt: result.fetchedAt,
      fromCache: result.fromCache,
    };

    if (result.fromCache && !refresh) {
      response.warning = "Using cached model list (5 min TTL).";
    }

    return NextResponse.json(response, {
      headers: { "Cache-Control": "private, max-age=60" },
    });
  } catch (error) {
    console.error("[API /ai/models] Error:", error);
    
    const message = error instanceof Error ? error.message : "Unknown error";
    
    // Check for common error types
    if (message.includes("API key not valid") || message.includes("INVALID_ARGUMENT")) {
      return NextResponse.json(
        { error: "Invalid Gemini API key. Please check your key in Settings → AI." },
        { status: 401 }
      );
    }
    
    if (message.includes("429") || message.includes("rate limit")) {
      return NextResponse.json(
        { error: "Rate limited by Gemini API. Please try again later." },
        { status: 429 }
      );
    }

    return NextResponse.json(
      { error: `Failed to fetch models: ${message}` },
      { status: 500 }
    );
  }
}