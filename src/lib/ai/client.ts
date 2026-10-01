/**
 * AI Client Wrapper
 * 
 * Provides a clean interface for interacting with Google GenAI,
 * including model listing with proper filtering and error handling.
 */

import { GoogleGenAI } from "@google/genai";
import type {
  ModelInfo,
  IntakeModelOption,
  RealtimeModelOption,
  ListModelsResponse,
} from "./types";

interface AiClientOptions {
  apiKey: string;
}

interface CachedModels {
  intakeModels: IntakeModelOption[];
  realtimeModels: RealtimeModelOption[];
  fetchedAt: number;
}

// In-memory cache (server-side), keyed per API key. A single shared cache
// would serve key A's model list to a request authenticated with key B.
const modelCacheByKey = new Map<string, CachedModels>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Creates a GoogleGenAI client configured for model listing
 */
function createClient(options: AiClientOptions): GoogleGenAI {
  return new GoogleGenAI({ apiKey: options.apiKey });
}

/**
 * Fetches all models from Gemini API
 */
export async function fetchAllModels(apiKey: string): Promise<ModelInfo[]> {
  const client = createClient({ apiKey });

  // Public SDK API (verified against @google/genai 1.41.0 typings):
  // `ai.models.list()` returns a Pager<Model> of every model the key can use.
  // The previous implementation reached into `client.interactions._client`,
  // which does not exist — that is why this module failed to compile.
  const pager = await client.models.list();
  const models: ModelInfo[] = [];
  for await (const model of pager) {
    models.push({
      name: model.name ?? "",
      displayName: model.displayName ?? model.name ?? "",
      description: model.description ?? "",
      // The SDK's Model exposes `supportedActions` (not the REST field name
      // `supportedGenerationMethods`) and does not surface output modalities —
      // realtime detection therefore falls back to name/displayName matching.
      supportedGenerationMethods: (model.supportedActions ??
        []) as ModelInfo["supportedGenerationMethods"],
      inputTokenLimit: model.inputTokenLimit ?? 0,
      outputTokenLimit: model.outputTokenLimit ?? 0,
      version: model.version,
    });
  }
  return models;
}

/**
 * Filters and transforms models for intake (text generation) use
 */
function filterIntakeModels(models: ModelInfo[]): IntakeModelOption[] {
  return models
    .filter((m) => m.supportedGenerationMethods.includes("generateContent"))
    .map((m) => ({
      id: m.name.replace(/^models\//, ""),
      name: m.displayName,
      description: m.description,
      inputTokenLimit: m.inputTokenLimit,
      outputTokenLimit: m.outputTokenLimit,
      capabilities: m.supportedGenerationMethods,
    }))
    .sort((a, b) => {
      // Sort: pro models first, then flash, then by name
      const aPro = a.name.toLowerCase().includes("pro");
      const bPro = b.name.toLowerCase().includes("pro");
      if (aPro && !bPro) return -1;
      if (!aPro && bPro) return 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Filters and transforms models for realtime (voice/live) use
 */
function filterRealtimeModels(models: ModelInfo[]): RealtimeModelOption[] {
  return models
    .filter((m) => {
      const name = m.name.toLowerCase();
      const displayName = m.displayName.toLowerCase();
      const modalities = m.outputModalities ?? [];
      
      return (
        m.supportedGenerationMethods.includes("generateContent") &&
        (name.includes("live") ||
          name.includes("native-audio") ||
          displayName.includes("live") ||
          displayName.includes("native audio") ||
          modalities.includes("AUDIO"))
      );
    })
    .map((m) => ({
      id: m.name.replace(/^models\//, ""),
      name: m.displayName,
      description: m.description,
      inputTokenLimit: m.inputTokenLimit,
      outputTokenLimit: m.outputTokenLimit,
      supportsNativeAudio: 
        m.name.toLowerCase().includes("native-audio") ||
        m.displayName.toLowerCase().includes("native audio") ||
        (m.outputModalities ?? []).includes("AUDIO"),
      supportsLive: 
        m.name.toLowerCase().includes("live") ||
        m.displayName.toLowerCase().includes("live"),
    }))
    .sort((a, b) => {
      // Sort: native audio first, then live, then by name
      if (a.supportsNativeAudio && !b.supportsNativeAudio) return -1;
      if (!a.supportsNativeAudio && b.supportsNativeAudio) return 1;
      if (a.supportsLive && !b.supportsLive) return -1;
      if (!a.supportsLive && b.supportsLive) return 1;
      return a.name.localeCompare(b.name);
    });
}

/**
 * Gets models with caching (server-side only)
 * Returns cached data if within TTL, otherwise fetches fresh
 */
export async function getModels(
  apiKey: string,
  forceRefresh = false
): Promise<{
  intakeModels: IntakeModelOption[];
  realtimeModels: RealtimeModelOption[];
  fetchedAt: number;
  fromCache: boolean;
}> {
  const now = Date.now();
  const cached = modelCacheByKey.get(apiKey);

  // Return cached if valid and not forcing refresh
  if (!forceRefresh && cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return {
      intakeModels: cached.intakeModels,
      realtimeModels: cached.realtimeModels,
      fetchedAt: cached.fetchedAt,
      fromCache: true,
    };
  }

  // Fetch fresh
  try {
    const allModels = await fetchAllModels(apiKey);
    
    const intakeModels = filterIntakeModels(allModels);
    const realtimeModels = filterRealtimeModels(allModels);
    
    modelCacheByKey.set(apiKey, {
      intakeModels,
      realtimeModels,
      fetchedAt: now,
    });
    
    return {
      intakeModels,
      realtimeModels,
      fetchedAt: now,
      fromCache: false,
    };
  } catch (error) {
    // If we have stale cache, return it with warning
    if (cached) {
      return {
        intakeModels: cached.intakeModels,
        realtimeModels: cached.realtimeModels,
        fetchedAt: cached.fetchedAt,
        fromCache: true, // Indicate stale cache
      };
    }
    throw error;
  }
}

/**
 * Clears the model cache (useful for testing or after API key change)
 */
export function clearModelCache(): void {
  modelCacheByKey.clear();
}

/**
 * Gets a single model by ID
 */
export async function getModelById(apiKey: string, modelId: string): Promise<ModelInfo | null> {
  const { intakeModels, realtimeModels } = await getModels(apiKey);
  
  // Search in both lists
  const allOptions = [
    ...intakeModels.map((m) => ({ ...m, type: "intake" as const })),
    ...realtimeModels.map((m) => ({ ...m, type: "realtime" as const })),
  ];
  
  const found = allOptions.find((m) => m.id === modelId);
  if (!found) return null;
  
  // Fetch full model info
  const allModels = await fetchAllModels(apiKey);
  return allModels.find((m) => m.name.replace(/^models\//, "") === modelId) ?? null;
}