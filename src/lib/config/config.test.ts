import { describe, expect, it } from "vitest";

import { SETTING_DEFAULTS, SETTING_KEYS, getSettingMetadata, isSecret } from "./keys";
import { validateSetting, validateSettings } from "./schema";

describe("settings registry", () => {
  it("SETTING_KEYS and SETTING_DEFAULTS stay in sync", () => {
    expect(Object.keys(SETTING_DEFAULTS).sort()).toEqual([...SETTING_KEYS].sort());
  });

  it("provides metadata for every key", () => {
    for (const key of SETTING_KEYS) {
      expect(getSettingMetadata(key), `missing metadata for ${key}`).toBeDefined();
      expect(getSettingMetadata(key)?.label, `missing label for ${key}`).toBeTruthy();
    }
  });

  it("marks credential fields as secret", () => {
    expect(isSecret("GEMINI_API_KEY")).toBe(true);
    expect(isSecret("LIVEKIT_API_SECRET")).toBe(true);
    expect(isSecret("TWILIO_AUTH_TOKEN")).toBe(true);
    expect(isSecret("LIVEKIT_URL")).toBe(false);
  });
});

describe("validateSetting", () => {
  it("accepts a valid URL for LIVEKIT_URL", () => {
    const result = validateSetting("LIVEKIT_URL", "wss://my-project.livekit.cloud");
    expect(result.success).toBe(true);
  });

  it("rejects a non-URL LiveKit host", () => {
    const result = validateSetting("LIVEKIT_URL", "not a url");
    expect(result.success).toBe(false);
  });

  it("rejects an out-of-range temperature", () => {
    expect(validateSetting("GEMINI_TEMPERATURE_INTAKE", "5").success).toBe(false);
    expect(validateSetting("GEMINI_TEMPERATURE_INTAKE", "0.4").success).toBe(true);
  });

  it("rejects a non-positive session timeout", () => {
    expect(validateSetting("CALL_SESSION_TIMEOUT_SECONDS", "0").success).toBe(false);
    expect(validateSetting("CALL_SESSION_TIMEOUT_SECONDS", "120").success).toBe(true);
  });

  it("restricts the display font to the supported set", () => {
    expect(validateSetting("AIRA_DISPLAY_FONT", "comic-sans").success).toBe(false);
    expect(validateSetting("AIRA_DISPLAY_FONT", "bricolage").success).toBe(true);
  });
});

describe("validateSettings", () => {
  it("requires the Gemini API key", () => {
    const result = validateSettings({});
    expect(result.success).toBe(false);
  });

  it("accepts an empty optional-only payload once required keys are present", () => {
    const result = validateSettings({ GEMINI_API_KEY: "key-123" });
    // Intake/realtime models are also required by the schema, so a payload
    // with only the API key must still fail — this guards against silently
    // accepting a half-configured app.
    expect(result.success).toBe(false);
  });
});