import { z } from "zod";

/**
 * Centralized Zod schemas for all AIRA settings.
 * Single source of truth for validation, defaults, and metadata.
 */

// ============================================================================
// Setting Value Schemas
// ============================================================================

export const geminiApiKeySchema = z.string().min(1, "Gemini API key is required");

export const geminiIntakeModelSchema = z.string().min(1);
export const geminiRealtimeModelSchema = z.string().min(1);
export const geminiRealtimeVoiceSchema = z.string().min(1);

export const livekitUrlSchema = z.string().url("Must be a valid WebSocket URL (wss://...)").optional().or(z.literal(""));
export const livekitApiKeySchema = z.string().optional().or(z.literal(""));
export const livekitApiSecretSchema = z.string().optional().or(z.literal(""));
export const livekitSipTrunkIdSchema = z.string().optional().or(z.literal(""));
export const livekitSipNumberSchema = z.string().optional().or(z.literal(""));
export const livekitAgentNameSchema = z.string().optional().or(z.literal(""));

export const twilioAccountSidSchema = z.string().optional().or(z.literal(""));
export const twilioAuthTokenSchema = z.string().optional().or(z.literal(""));
export const twilioSipTrunkSidSchema = z.string().optional().or(z.literal(""));

export const callSessionTimeoutSchema = z
  .string()
  .regex(/^\d+$/, "Must be a positive integer")
  .transform((val) => parseInt(val, 10))
  .refine((val) => val > 0 && val <= 3600, "Timeout must be between 1 and 3600 seconds")
  .optional()
  .or(z.literal(""));

export const logLevelSchema = z.enum(["debug", "info", "warn", "error"]).optional().or(z.literal(""));

export const recordingProviderSchema = z.enum(["gcp"]).optional().or(z.literal(""));
export const recordingGcpBucketSchema = z.string().optional().or(z.literal(""));
export const recordingGcpPrefixSchema = z.string().optional().or(z.literal(""));
export const recordingGcpCredentialsSchema = z.string().optional().or(z.literal(""));

export const displayFontSchema = z
  .enum(["sora", "bricolage", "inter", "system"])
  .optional()
  .or(z.literal(""));

export const geminiTemperatureSchema = z
  .string()
  .regex(/^\d*\.?\d+$/, "Must be a number")
  .transform((val) => parseFloat(val))
  .refine((val) => val >= 0 && val <= 2, "Temperature must be between 0 and 2")
  .optional()
  .or(z.literal(""));

// ============================================================================
// Combined Settings Schema (for validation)
// ============================================================================

export const settingsSchema = z.object({
  GEMINI_API_KEY: geminiApiKeySchema,
  GEMINI_INTAKE_MODEL: geminiIntakeModelSchema,
  GEMINI_REALTIME_MODEL: geminiRealtimeModelSchema,
  GEMINI_REALTIME_VOICE: geminiRealtimeVoiceSchema,
  GEMINI_TEMPERATURE_INTAKE: geminiTemperatureSchema,
  GEMINI_TEMPERATURE_REALTIME: geminiTemperatureSchema,

  LIVEKIT_URL: livekitUrlSchema,
  LIVEKIT_API_KEY: livekitApiKeySchema,
  LIVEKIT_API_SECRET: livekitApiSecretSchema,
  LIVEKIT_SIP_TRUNK_ID: livekitSipTrunkIdSchema,
  LIVEKIT_SIP_NUMBER: livekitSipNumberSchema,
  LIVEKIT_AGENT_NAME: livekitAgentNameSchema,

  TWILIO_ACCOUNT_SID: twilioAccountSidSchema,
  TWILIO_AUTH_TOKEN: twilioAuthTokenSchema,
  TWILIO_SIP_TRUNK_SID: twilioSipTrunkSidSchema,

  CALL_SESSION_TIMEOUT_SECONDS: callSessionTimeoutSchema,
  AIRA_LOG_LEVEL: logLevelSchema,

  RECORDING_PROVIDER: recordingProviderSchema,
  RECORDING_GCP_BUCKET: recordingGcpBucketSchema,
  RECORDING_GCP_PREFIX: recordingGcpPrefixSchema,
  RECORDING_GCP_CREDENTIALS_B64: recordingGcpCredentialsSchema,

  AIRA_DISPLAY_FONT: displayFontSchema,
});

export type Settings = z.infer<typeof settingsSchema>;
export type SettingKey = keyof Settings;

// ============================================================================
// Validation Helpers
// ============================================================================

export function validateSettings(input: Record<string, unknown>): { success: true; data: Settings } | { success: false; errors: z.ZodIssue[] } {
  const result = settingsSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}

export function validateSetting<K extends SettingKey>(
  key: K,
  value: unknown,
): { success: true; data: Settings[K] } | { success: false; errors: z.ZodIssue[] } {
  const schema = settingsSchema.shape[key] as z.ZodType<Settings[K]>;
  const result = schema.safeParse(value);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, errors: result.error.issues };
}