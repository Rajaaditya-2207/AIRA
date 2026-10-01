// Global type declarations for the AIRA desktop bridge.
// Optional members keep web-dev mode working (window.aira is undefined there).

export {};

declare global {
  interface Window {
    aira?: {
      getSettings(): Promise<Record<string, string>>;
      saveSettings(settings: Record<string, string>): Promise<{ ok: boolean }>;
      restartEngine(): Promise<{ ok: boolean; reason?: string }>;
      revealDataFolder(): Promise<{ ok: boolean }>;
    };
  }
}
