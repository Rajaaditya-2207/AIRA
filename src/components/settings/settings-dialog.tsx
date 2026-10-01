"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw, Settings } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DISPLAY_FONTS, useDisplayFont, type DisplayFontId } from "@/hooks/use-display-font";
import { cn } from "@/lib/utils";

type SettingsDialogProps = {
  trigger?: React.ReactNode;
};

type FieldDef = {
  key: string;
  label: string;
  secret?: boolean;
  options?: string[];
  description?: string;
};

type ModelOptions = {
  intakeModels: string[];
  realtimeModels: string[];
  loading: boolean;
  error: string | null;
  stale: boolean;
  refresh: () => void;
};

/** Known-good Gemini models per slot; "Custom…" unlocks free-text entry. */
const TAB_FIELDS: Record<string, FieldDef[]> = {
  AI: [
    { key: "GEMINI_API_KEY", label: "Gemini API key", secret: true },
    {
      key: "GEMINI_INTAKE_MODEL",
      label: "Intake model",
      options: [
        "gemini-3-pro-preview",
        "gemini-2.5-pro",
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
        "gemini-2.0-flash",
      ],
    },
    {
      key: "GEMINI_REALTIME_MODEL",
      label: "Voice model (realtime)",
      options: [
        "gemini-2.5-flash-native-audio-preview-12-2025",
        "gemini-2.5-flash-native-audio-preview-09-2025",
        "gemini-2.0-flash-live-001",
      ],
    },
    { key: "GEMINI_REALTIME_VOICE", label: "Voice" },
    {
      key: "GEMINI_TEMPERATURE_INTAKE",
      label: "Intake temperature",
      description: "0–2. Lower = more literal brief parsing. Default 0.2.",
    },
    {
      key: "GEMINI_TEMPERATURE_REALTIME",
      label: "Voice temperature",
      description: "0–2. Lower = more scripted calls. Default 0.4.",
    },
  ],
  Calling: [
    { key: "LIVEKIT_URL", label: "LiveKit URL" },
    { key: "LIVEKIT_API_KEY", label: "LiveKit API key", secret: true },
    { key: "LIVEKIT_API_SECRET", label: "LiveKit API secret", secret: true },
    { key: "LIVEKIT_SIP_TRUNK_ID", label: "SIP trunk ID" },
    { key: "LIVEKIT_SIP_NUMBER", label: "Caller number (optional)" },
    { key: "TWILIO_ACCOUNT_SID", label: "Twilio Account SID" },
    { key: "TWILIO_AUTH_TOKEN", label: "Twilio Auth Token", secret: true },
    { key: "TWILIO_SIP_TRUNK_SID", label: "Twilio SIP Trunk SID" },
  ],
  Recordings: [
    { key: "RECORDING_PROVIDER", label: "Provider (gcp)" },
    { key: "RECORDING_GCP_BUCKET", label: "GCS bucket" },
    { key: "RECORDING_GCP_PREFIX", label: "Object prefix" },
    { key: "RECORDING_GCP_CREDENTIALS_B64", label: "Service account (base64)", secret: true },
  ],
};

const TABS = ["AI", "Calling", "Recordings", "Appearance"] as const;
type Tab = (typeof TABS)[number];

export function SettingsDialog({ trigger }: SettingsDialogProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("AI");
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restarting, setRestarting] = useState(false);
  const [savedNote, setSavedNote] = useState<string | null>(null);
  const [customModelKeys, setCustomModelKeys] = useState<Record<string, boolean>>({});
  const [modelOptions, setModelOptions] = useState<ModelOptions>({
    intakeModels: [],
    realtimeModels: [],
    loading: false,
    error: null,
    stale: false,
    refresh: () => {},
  });
  const { fontId, setFontId } = useDisplayFont();
  const isDesktop = typeof window !== "undefined" && !!window.aira;

  // Live model discovery. Falls back to the static lists in TAB_FIELDS when
  // the Gemini API is unreachable, so the dropdown is never empty.
  const fetchModels = useCallback(async (force = false) => {
    setModelOptions((current) => ({ ...current, loading: true, error: null }));
    try {
      const response = await fetch(`/api/ai/models${force ? "?refresh=true" : ""}`);
      const payload = (await response.json()) as {
        intakeModels?: { id: string }[];
        realtimeModels?: { id: string }[];
        fromCache?: boolean;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error ?? "Could not load models");
      }
      setModelOptions((current) => ({
        ...current,
        intakeModels: (payload.intakeModels ?? []).map((model) => model.id),
        realtimeModels: (payload.realtimeModels ?? []).map((model) => model.id),
        loading: false,
        stale: Boolean(payload.fromCache),
        error: null,
      }));
    } catch (error) {
      setModelOptions((current) => ({
        ...current,
        loading: false,
        error: error instanceof Error ? error.message : "Could not load models",
      }));
    }
  }, []);

  useEffect(() => {
    if (!open || tab !== "AI") return;
    void fetchModels();
  }, [open, tab, fetchModels]);

  useEffect(() => {
    setModelOptions((current) => ({ ...current, refresh: () => void fetchModels(true) }));
  }, [fetchModels]);

  const load = async () => {
    if (!window.aira) return;
    setLoading(true);
    try {
      const saved = await window.aira.getSettings();
      setValues(saved);
      // localStorage is the primary font store; if it was wiped (cleared
      // profile, fresh OS user) but settings.json remembers the choice,
      // restore it so the preference survives reinstalls.
      const persisted = saved.AIRA_DISPLAY_FONT as DisplayFontId | undefined;
      let known = false;
      try {
        known = !!localStorage.getItem("aira-font-id");
      } catch {
        /* storage unavailable */
      }
      if (persisted && !known && DISPLAY_FONTS.some((font) => font.id === persisted)) {
        setFontId(persisted);
      }
    } finally {
      setLoading(false);
    }
  };

  const onOpenChange = async (next: boolean) => {
    setOpen(next);
    if (next) {
      setSavedNote(null);
      await load();
    }
  };

  const save = async () => {
    if (!window.aira) return;
    setSaving(true);
    setSavedNote(null);
    try {
      await window.aira.saveSettings(values);
      // Appearance needs no engine restart — the font picker applies live
      // and persists itself (localStorage + settings.json mirror).
      if (tab === "Appearance") {
        setSavedNote("Settings saved.");
        setSaving(false);
        return;
      }
      setRestarting(true);
      const result = await window.aira.restartEngine();
      setRestarting(false);
      setSavedNote(
        result.ok
          ? "Settings saved. Engine restarted with the new configuration."
          : "Settings saved. Restart AIRA to apply them.",
      );
    } catch {
      setRestarting(false);
      setSavedNote("Settings saved.");
    } finally {
      setSaving(false);
    }
  };

  const revealData = async () => {
    await window.aira?.revealDataFolder();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Open settings"
          >
            <Settings className="size-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[85dvh] flex-col gap-0 overflow-hidden sm:max-w-lg">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle className="font-display">Settings</DialogTitle>
          <DialogDescription>
            Keys are stored locally on this machine and never leave it except to call
            Gemini/LiveKit/Twilio directly.
          </DialogDescription>
        </DialogHeader>

        {/* Tab rail — Appearance is a first-class tab */}
        <div className="flex gap-1 border-b border-border px-5 pt-3">
          {TABS.map((entry) => (
            <button
              key={entry}
              type="button"
              onClick={() => setTab(entry)}
              aria-selected={tab === entry}
              role="tab"
              className={cn(
                "relative px-3 pb-2.5 text-sm font-medium transition-colors",
                tab === entry ? "text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {entry}
              {tab === entry ? (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />
              ) : null}
            </button>
          ))}
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {tab === "Appearance" ? (
            <div className="space-y-3">
              <div>
                <Label className="text-sm">Display font</Label>
                <p className="text-xs text-muted-foreground">
                  Used for headings and titles across AIRA. Applies immediately.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {DISPLAY_FONTS.map((font) => (
                  <button
                    key={font.id}
                    type="button"
                    onClick={() => setFontId(font.id)}
                    aria-pressed={fontId === font.id}
                    className={cn(
                      "rounded-lg border px-3 py-2.5 text-left transition-colors",
                      fontId === font.id
                        ? "border-primary/60 bg-primary/10"
                        : "border-border/70 hover:border-primary/30",
                    )}
                  >
                    <span style={{ fontFamily: font.stack }} className="block text-base font-semibold">
                      {font.label}
                    </span>
                    <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">
                      {fontId === font.id ? "ACTIVE" : "select to preview"}
                    </span>
                  </button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">
                Bricolage Grotesque and Inter load from Google Fonts on first selection — a short
                delay is normal the first time.
              </p>
            </div>
          ) : !isDesktop ? (
            <p className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              Keys come from environment variables in web mode. Launch the AIRA desktop app to edit
              them here.
            </p>
          ) : loading ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading settings…
            </div>
          ) : (
            <div className="space-y-3.5">
              {TAB_FIELDS[tab].map((field) => {
                const value = values[field.key] ?? "";
                // Prefer the live list for model slots; fall back to the
                // curated list so the control still works offline.
                const liveOptions =
                  field.key === "GEMINI_INTAKE_MODEL"
                    ? modelOptions.intakeModels
                    : field.key === "GEMINI_REALTIME_MODEL"
                      ? modelOptions.realtimeModels
                      : null;
                const options = liveOptions?.length ? liveOptions : field.options;
                const isCustom =
                  customModelKeys[field.key] === true ||
                  (!!options && !!value && !options.includes(value));
                if (!options) {
                  return (
                    <div key={field.key} className="space-y-1.5">
                      <Label htmlFor={`settings-${field.key}`}>{field.label}</Label>
                      <Input
                        id={`settings-${field.key}`}
                        type={field.secret ? "password" : "text"}
                        value={value}
                        onChange={(event) =>
                          setValues((current) => ({ ...current, [field.key]: event.target.value }))
                        }
                        placeholder={field.secret ? "••••••••" : ""}
                        autoComplete="off"
                      />
                    </div>
                  );
                }
                return (
                  <div key={field.key} className="space-y-1.5">
                    <Label htmlFor={`settings-${field.key}`}>{field.label}</Label>
                    {isCustom ? (
                      <div className="flex gap-2">
                        <Input
                          id={`settings-${field.key}`}
                          type="text"
                          value={value}
                          onChange={(event) =>
                            setValues((current) => ({
                              ...current,
                              [field.key]: event.target.value,
                            }))
                          }
                          placeholder="model id from Google AI Studio"
                          autoComplete="off"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="shrink-0 self-stretch"
                          onClick={() =>
                            setCustomModelKeys((current) => ({ ...current, [field.key]: false }))
                          }
                        >
                          List
                        </Button>
                      </div>
                    ) : (
                      <Select
                        value={value}
                        onValueChange={(next) => {
                          if (next === "__custom__") {
                            setValues((current) => ({ ...current, [field.key]: "" }));
                            setCustomModelKeys((current) => ({ ...current, [field.key]: true }));
                            return;
                          }
                          setValues((current) => ({ ...current, [field.key]: next }));
                        }}
                      >
                        <SelectTrigger id={`settings-${field.key}`} className="w-full">
                          <SelectValue placeholder="Select a model…" />
                        </SelectTrigger>
                        <SelectContent>
                          {options.map((option) => (
                            <SelectItem key={option} value={option}>
                              {option}
                            </SelectItem>
                          ))}
                          <SelectItem value="__custom__">Custom…</SelectItem>
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                );
              })}
              {tab === "AI" ? (
                <div className="flex items-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs"
                    onClick={modelOptions.refresh}
                    disabled={modelOptions.loading}
                  >
                    {modelOptions.loading ? (
                      <>
                        <Loader2 className="size-3 animate-spin" /> Loading models…
                      </>
                    ) : (
                      "Refresh model list"
                    )}
                  </Button>
                  {modelOptions.stale ? (
                    <span className="font-mono text-[10px] text-muted-foreground">
                      cached list
                    </span>
                  ) : null}
                  {modelOptions.error ? (
                    <span className="text-[11px] text-muted-foreground">
                      {modelOptions.error} — showing built-in list.
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          )}

          {tab !== "Appearance" ? (
            <button
              type="button"
              className="text-xs text-muted-foreground underline-offset-4 hover:underline"
              onClick={revealData}
            >
              Reveal data folder (database, recordings, logs)
            </button>
          ) : null}

          {savedNote ? (
            <p className="rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
              {savedNote}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border bg-surface/80 px-5 py-3 backdrop-blur">
          {(saving || restarting) && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="size-3 animate-spin" />
              {restarting ? "Saved · Restarting engine…" : "Saving…"}
            </span>
          )}
          <span className="flex-1" />
          <Button onClick={save} disabled={saving || restarting || !isDesktop}>
            {saving || restarting ? "Saving…" : "Save & apply"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
