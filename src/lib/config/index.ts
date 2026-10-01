/**
 * AIRA Config — Centralized configuration system
 * 
 * Import from here:
 *   import { SETTING_KEYS, SETTING_DEFAULTS, SETTING_METADATA } from "@/lib/config";
 *   import { settingsSchema, validateSettings } from "@/lib/config";
 */

export * from "./schema";
// `keys.ts` re-declares SettingKey as the source of truth (derived from
// SETTING_KEYS); re-export it explicitly so the two don't collide.
export {
  SETTING_KEYS,
  SETTING_DEFAULTS,
  SETTING_METADATA,
  getSettingMetadata,
  isSecret,
  getFallbackOptions,
  getCustomOptionValue,
} from "./keys";
export type { SettingKey } from "./keys";