/**
 * Single source of truth for all AIRA settings.
 * 
 * This file defines:
 * - SETTING_KEYS: All valid setting keys (used by electron/main.ts for allowlist)
 * - SETTING_DEFAULTS: Default values for each setting
 * - SETTING_METADATA: UI metadata (label, tab, secret, options, etc.)
 * 
 * ALL other files should import from here instead of defining their own lists.
 */

// ============================================================================
// Setting Keys (the canonical list)
// ============================================================================

export const SETTING_KEYS = [
  // AI / Gemini
  "GEMINI_API_KEY",
  "GEMINI_INTAKE_MODEL",
  "GEMINI_REALTIME_MODEL",
  "GEMINI_REALTIME_VOICE",
  "GEMINI_TEMPERATURE_INTAKE",
  "GEMINI_TEMPERATURE_REALTIME",

  // Telephony: LiveKit
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_SIP_TRUNK_ID",
  "LIVEKIT_SIP_NUMBER",
  "LIVEKIT_AGENT_NAME",

  // Telephony: Twilio
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_SIP_TRUNK_SID",

  // Call Control
  "CALL_SESSION_TIMEOUT_SECONDS",
  "AIRA_LOG_LEVEL",

  // Recordings
  "RECORDING_PROVIDER",
  "RECORDING_GCP_BUCKET",
  "RECORDING_GCP_PREFIX",
  "RECORDING_GCP_CREDENTIALS_B64",

  // Appearance
  "AIRA_DISPLAY_FONT",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

// ============================================================================
// Default Values
// ============================================================================

export const SETTING_DEFAULTS: Record<SettingKey, string> = {
  // AI / Gemini
  GEMINI_API_KEY: "",
  GEMINI_INTAKE_MODEL: "gemini-3-pro-preview",
  GEMINI_REALTIME_MODEL: "gemini-2.5-flash-native-audio-preview-12-2025",
  GEMINI_REALTIME_VOICE: "Puck",
  GEMINI_TEMPERATURE_INTAKE: "0.4",
  GEMINI_TEMPERATURE_REALTIME: "0.4",

  // Telephony: LiveKit
  LIVEKIT_URL: "",
  LIVEKIT_API_KEY: "",
  LIVEKIT_API_SECRET: "",
  LIVEKIT_SIP_TRUNK_ID: "",
  LIVEKIT_SIP_NUMBER: "",
  LIVEKIT_AGENT_NAME: "aira-telephony-agent",

  // Telephony: Twilio
  TWILIO_ACCOUNT_SID: "",
  TWILIO_AUTH_TOKEN: "",
  TWILIO_SIP_TRUNK_SID: "",

  // Call Control
  CALL_SESSION_TIMEOUT_SECONDS: "120",
  AIRA_LOG_LEVEL: "info",

  // Recordings
  RECORDING_PROVIDER: "gcp",
  RECORDING_GCP_BUCKET: "",
  RECORDING_GCP_PREFIX: "aira/recordings",
  RECORDING_GCP_CREDENTIALS_B64: "",

  // Appearance
  AIRA_DISPLAY_FONT: "sora",
};

// ============================================================================
// UI Metadata
// ============================================================================

export type SettingTab = "AI" | "Calling" | "Recordings" | "Appearance";

export interface SettingMetadata {
  key: SettingKey;
  label: string;
  tab: SettingTab;
  secret?: boolean;
  description?: string;
  // For select fields: static fallback options (used when live fetch unavailable)
  fallbackOptions?: string[];
  // For select fields: special value that triggers free-text mode
  customOptionValue?: string;
}

export const SETTING_METADATA: SettingMetadata[] = [
  // ---- Call control (no dedicated tab — surfaced on the Calling tab) ----
  {
    key: "CALL_SESSION_TIMEOUT_SECONDS",
    label: "Call timeout (seconds)",
    tab: "Calling",
    description:
      "Maximum length of a single call before AIRA hangs up (1–3600). Keeps runs moving.",
  },
  {
    key: "AIRA_LOG_LEVEL",
    label: "Log level",
    tab: "Calling",
    description: "Verbosity of server.log (debug | info | warn | error).",
    fallbackOptions: ["debug", "info", "warn", "error"],
  },
  // ---- AI Tab ----
  {
    key: "GEMINI_API_KEY",
    label: "Gemini API key",
    tab: "AI",
    secret: true,
    description: "Get your key from Google AI Studio (aistudio.google.com)",
  },
  {
    key: "GEMINI_INTAKE_MODEL",
    label: "Intake model",
    tab: "AI",
    description: "Used for parsing investigation briefs and extracting structured findings",
    fallbackOptions: [
      "gemini-3-pro-preview",
      "gemini-2.5-pro",
      "gemini-2.5-flash",
      "gemini-2.5-flash-lite",
      "gemini-2.0-flash",
    ],
    customOptionValue: "__custom__",
  },
  {
    key: "GEMINI_REALTIME_MODEL",
    label: "Voice model (realtime)",
    tab: "AI",
    description: "Used for live phone conversations via Gemini Live API",
    fallbackOptions: [
      "gemini-2.5-flash-native-audio-preview-12-2025",
      "gemini-2.5-flash-native-audio-preview-09-2025",
      "gemini-2.0-flash-live-001",
    ],
    customOptionValue: "__custom__",
  },
  {
    key: "GEMINI_REALTIME_VOICE",
    label: "Voice",
    tab: "AI",
    description: "Voice persona for realtime calls",
    fallbackOptions: [
      "Puck",
      "Charon",
      "Kore",
      "Fenrir",
      "Aoede",
      "Leda",
      "Orus",
      "Zephyr",
    ],
    customOptionValue: "__custom__",
  },
  {
    key: "GEMINI_TEMPERATURE_INTAKE",
    label: "Intake temperature",
    tab: "AI",
    description: "Creativity for intake parsing (0 = deterministic, 1 = creative)",
  },
  {
    key: "GEMINI_TEMPERATURE_REALTIME",
    label: "Realtime temperature",
    tab: "AI",
    description: "Creativity for live conversations (0 = deterministic, 1 = creative)",
  },

  // ---- Calling Tab ----
  {
    key: "LIVEKIT_URL",
    label: "LiveKit URL",
    tab: "Calling",
    description: "Your LiveKit Cloud WebSocket URL (wss://...)",
  },
  {
    key: "LIVEKIT_API_KEY",
    label: "LiveKit API key",
    tab: "Calling",
    secret: true,
  },
  {
    key: "LIVEKIT_API_SECRET",
    label: "LiveKit API secret",
    tab: "Calling",
    secret: true,
  },
  {
    key: "LIVEKIT_SIP_TRUNK_ID",
    label: "SIP trunk ID",
    tab: "Calling",
    description: "LiveKit SIP trunk identifier for outbound calling",
  },
  {
    key: "LIVEKIT_SIP_NUMBER",
    label: "Caller number (optional)",
    tab: "Calling",
    description: "Phone number to display as caller ID",
  },
  {
    key: "LIVEKIT_AGENT_NAME",
    label: "Agent name",
    tab: "Calling",
    description: "Name the AI agent uses when introducing itself",
  },
  {
    key: "TWILIO_ACCOUNT_SID",
    label: "Twilio Account SID",
    tab: "Calling",
  },
  {
    key: "TWILIO_AUTH_TOKEN",
    label: "Twilio Auth Token",
    tab: "Calling",
    secret: true,
  },
  {
    key: "TWILIO_SIP_TRUNK_SID",
    label: "Twilio SIP Trunk SID",
    tab: "Calling",
  },

  // ---- Recordings Tab ----
  {
    key: "RECORDING_PROVIDER",
    label: "Recording provider",
    tab: "Recordings",
    description: "Storage backend for call recordings",
    fallbackOptions: ["gcp"],
  },
  {
    key: "RECORDING_GCP_BUCKET",
    label: "GCS bucket",
    tab: "Recordings",
    description: "Google Cloud Storage bucket for recordings",
  },
  {
    key: "RECORDING_GCP_PREFIX",
    label: "Object prefix",
    tab: "Recordings",
    description: "Path prefix within the bucket (e.g., aira/recordings)",
  },
  {
    key: "RECORDING_GCP_CREDENTIALS_B64",
    label: "Service account (base64)",
    tab: "Recordings",
    secret: true,
    description: "Base64-encoded GCP service account JSON",
  },

  // ---- Appearance Tab ----
  {
    key: "AIRA_DISPLAY_FONT",
    label: "Display font",
    tab: "Appearance",
    description: "Font used for headings and titles",
    fallbackOptions: ["sora", "bricolage", "inter", "system"],
  },
];

// ============================================================================
// Helper Functions
// ============================================================================

export function getSettingMetadata(key: SettingKey): SettingMetadata | undefined {
  return SETTING_METADATA.find((m) => m.key === key);
}

export function getSettingsByTab(tab: SettingTab): SettingMetadata[] {
  return SETTING_METADATA.filter((m) => m.tab === tab);
}

export function getDefaultValue(key: SettingKey): string {
  return SETTING_DEFAULTS[key] ?? "";
}

export function isSecret(key: SettingKey): boolean {
  return getSettingMetadata(key)?.secret ?? false;
}

export function getFallbackOptions(key: SettingKey): string[] | undefined {
  return getSettingMetadata(key)?.fallbackOptions;
}

export function getCustomOptionValue(key: SettingKey): string | undefined {
  return getSettingMetadata(key)?.customOptionValue;
}

// Type guards (compile-time only): SETTING_KEYS must stay in sync with
// SETTING_DEFAULTS. `satisfies` keeps the readonly tuple from being widened.
const _keysMatchDefaults = SETTING_KEYS satisfies readonly (keyof typeof SETTING_DEFAULTS)[];
const _defaultsMatchKeys = Object.keys(SETTING_DEFAULTS) as SettingKey[];