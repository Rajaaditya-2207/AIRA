/**
 * AI/Google GenAI Type Definitions
 * 
 * Types for model listings, capabilities, and voice options.
 * Compatible with @google/genai v1.41.0+
 */

// ============================================================================
// Model Capabilities
// ============================================================================

export type ModelCapability =
  | "generateContent"
  | "countTokens"
  | "embedContent"
  | "batchPredict"
  | "tunedModels";

export interface ModelInfo {
  /** Full resource name, e.g., "models/gemini-1.5-pro" */
  name: string;
  /** Human-readable name, e.g., "Gemini 1.5 Pro" */
  displayName: string;
  /** Description of the model */
  description: string;
  /** Supported generation methods */
  supportedGenerationMethods: ModelCapability[];
  /** Maximum input tokens */
  inputTokenLimit: number;
  /** Maximum output tokens */
  outputTokenLimit: number;
  /** Supported output modalities */
  outputModalities?: string[];
  /** Input modalities supported */
  inputModalities?: string[];
  /** Model version */
  version?: string;
  /** Creation timestamp */
  createTime?: string;
  /** Update timestamp */
  updateTime?: string;
}

// ============================================================================
// Filtered Model Views (for UI)
// ============================================================================

export interface IntakeModelOption {
  id: string;           // e.g., "gemini-1.5-pro"
  name: string;         // e.g., "Gemini 1.5 Pro"
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  capabilities: ModelCapability[];
}

export interface RealtimeModelOption {
  id: string;
  name: string;
  description: string;
  inputTokenLimit: number;
  outputTokenLimit: number;
  /** Whether this model supports native audio output */
  supportsNativeAudio: boolean;
  /** Whether this model supports live streaming */
  supportsLive: boolean;
}

// ============================================================================
// Voice Options
// ============================================================================

export interface VoiceOption {
  id: string;
  name: string;
  description?: string;
  /** Gender if specified */
  gender?: "male" | "female" | "neutral";
  /** Language/accent hint */
  locale?: string;
}

export const KNOWN_VOICES: VoiceOption[] = [
  { id: "Puck", name: "Puck", description: "Upbeat, energetic", gender: "neutral" },
  { id: "Charon", name: "Charon", description: "Deep, authoritative", gender: "male" },
  { id: "Kore", name: "Kore", description: "Warm, friendly", gender: "female" },
  { id: "Fenrir", name: "Fenrir", description: "Strong, confident", gender: "male" },
  { id: "Aoede", name: "Aoede", description: "Melodic, expressive", gender: "female" },
  { id: "Leda", name: "Leda", description: "Calm, measured", gender: "female" },
  { id: "Orus", name: "Orus", description: "Clear, professional", gender: "male" },
  { id: "Zephyr", name: "Zephyr", description: "Light, breezy", gender: "neutral" },
];

// ============================================================================
// API Response Types
// ============================================================================

export interface ListModelsResponse {
  models: ModelInfo[];
  nextPageToken?: string;
}

export interface ModelsApiResponse {
  intakeModels: IntakeModelOption[];
  realtimeModels: RealtimeModelOption[];
  fetchedAt: number;
  fromCache: boolean;
}

// ============================================================================
// Filtering Helpers
// ============================================================================

export function isIntakeCapable(model: ModelInfo): boolean {
  return model.supportedGenerationMethods.includes("generateContent");
}

export function isRealtimeCapable(model: ModelInfo): boolean {
  const methods = model.supportedGenerationMethods;
  const modalities = model.outputModalities ?? [];
  const name = model.name.toLowerCase();
  const displayName = model.displayName.toLowerCase();

  // Check for explicit live/audio capabilities
  return (
    methods.includes("generateContent") &&
    (name.includes("live") ||
      name.includes("native-audio") ||
      displayName.includes("live") ||
      displayName.includes("native audio") ||
      modalities.includes("AUDIO"))
  );
}

export function supportsNativeAudio(model: ModelInfo): boolean {
  const name = model.name.toLowerCase();
  const displayName = model.displayName.toLowerCase();
  const modalities = model.outputModalities ?? [];

  return (
    name.includes("native-audio") ||
    displayName.includes("native audio") ||
    modalities.includes("AUDIO")
  );
}

export function supportsLive(model: ModelInfo): boolean {
  const name = model.name.toLowerCase();
  const displayName = model.displayName.toLowerCase();

  return name.includes("live") || displayName.includes("live");
}

export function toIntakeModelOption(model: ModelInfo): IntakeModelOption {
  return {
    id: model.name.replace(/^models\//, ""),
    name: model.displayName,
    description: model.description,
    inputTokenLimit: model.inputTokenLimit,
    outputTokenLimit: model.outputTokenLimit,
    capabilities: model.supportedGenerationMethods,
  };
}

export function toRealtimeModelOption(model: ModelInfo): RealtimeModelOption {
  return {
    id: model.name.replace(/^models\//, ""),
    name: model.displayName,
    description: model.description,
    inputTokenLimit: model.inputTokenLimit,
    outputTokenLimit: model.outputTokenLimit,
    supportsNativeAudio: supportsNativeAudio(model),
    supportsLive: supportsLive(model),
  };
}