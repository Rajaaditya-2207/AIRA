import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Model discovery contract. The client must:
 *  - read models through the PUBLIC SDK surface (`ai.models.list()`),
 *  - never leak one API key's cached list to another key,
 *  - degrade to stale cache rather than throwing when a refresh fails.
 */

const listMock = vi.fn();

vi.mock("@google/genai", () => ({
  GoogleGenAI: vi.fn(function GoogleGenAI(options: { apiKey: string }) {
    return { apiKey: options.apiKey, models: { list: listMock } };
  }),
}));

import { clearModelCache, fetchAllModels, getModels } from "./client";

function model(overrides: Record<string, unknown> = {}) {
  return {
    name: "models/gemini-2.5-flash",
    displayName: "Gemini 2.5 Flash",
    description: "fast",
    supportedActions: ["generateContent"],
    inputTokenLimit: 1_000_000,
    outputTokenLimit: 8192,
    version: "001",
    ...overrides,
  };
}

async function* pager(items: unknown[]) {
  for (const item of items) yield item;
}

beforeEach(() => {
  clearModelCache();
  listMock.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("fetchAllModels", () => {
  it("maps SDK Model fields onto the internal shape", async () => {
    listMock.mockResolvedValue(pager([model()]));

    const [first] = await fetchAllModels("key-a");

    expect(first).toMatchObject({
      name: "models/gemini-2.5-flash",
      displayName: "Gemini 2.5 Flash",
      supportedGenerationMethods: ["generateContent"],
      inputTokenLimit: 1_000_000,
    });
  });

  it("uses the public models.list() API, not SDK internals", async () => {
    listMock.mockResolvedValue(pager([]));

    await fetchAllModels("key-a");

    expect(listMock).toHaveBeenCalledTimes(1);
  });

  it("tolerates sparse models without throwing", async () => {
    listMock.mockResolvedValue(pager([{ name: "models/bare" }]));

    const [first] = await fetchAllModels("key-a");

    expect(first.displayName).toBe("models/bare");
    expect(first.supportedGenerationMethods).toEqual([]);
    expect(first.inputTokenLimit).toBe(0);
  });
});

describe("getModels", () => {
  it("splits models into intake and realtime buckets", async () => {
    listMock.mockResolvedValue(
      pager([
        model({ name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash" }),
        model({
          name: "models/gemini-2.5-flash-native-audio-preview",
          displayName: "Gemini Native Audio",
        }),
      ]),
    );

    const result = await getModels("key-a");

    expect(result.intakeModels.map((m) => m.id)).toContain("gemini-2.5-flash");
    expect(result.realtimeModels.map((m) => m.id)).toContain(
      "gemini-2.5-flash-native-audio-preview",
    );
    expect(result.fromCache).toBe(false);
  });

  it("caches per API key so one key never sees another's list", async () => {
    listMock.mockResolvedValueOnce(pager([model({ displayName: "Key A Model" })]));
    const first = await getModels("key-a");

    // A different key must trigger its own fetch, not reuse key-a's cache.
    listMock.mockResolvedValueOnce(pager([model({ displayName: "Key B Model" })]));
    const second = await getModels("key-b");

    expect(listMock).toHaveBeenCalledTimes(2);
    expect(first.intakeModels[0]?.name).toBe("Key A Model");
    expect(second.intakeModels[0]?.name).toBe("Key B Model");
    expect(second.fromCache).toBe(false);
  });

  it("serves the cached list within the TTL", async () => {
    listMock.mockResolvedValue(pager([model()]));

    await getModels("key-a");
    const second = await getModels("key-a");

    expect(listMock).toHaveBeenCalledTimes(1);
    expect(second.fromCache).toBe(true);
  });

  it("bypasses the cache when forceRefresh is set", async () => {
    listMock.mockResolvedValue(pager([model()]));

    await getModels("key-a");
    await getModels("key-a", true);

    expect(listMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to stale cache when a refresh fails", async () => {
    listMock.mockResolvedValueOnce(pager([model()]));
    await getModels("key-a");

    listMock.mockRejectedValueOnce(new Error("network down"));
    const stale = await getModels("key-a", true);

    expect(stale.fromCache).toBe(true);
    expect(stale.intakeModels.length).toBeGreaterThan(0);
  });

  it("throws when there is no cache to fall back on", async () => {
    listMock.mockRejectedValue(new Error("invalid key"));

    await expect(getModels("key-a")).rejects.toThrow("invalid key");
  });
});