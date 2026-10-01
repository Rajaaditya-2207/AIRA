import { contextBridge, ipcRenderer } from "electron";

/**
 * Secure bridge between the renderer (Next.js UI) and the Electron main
 * process. The renderer never gets Node access — only these explicit calls.
 */
const api = {
  getSettings: (): Promise<Record<string, string>> => ipcRenderer.invoke("aira:get-settings"),
  saveSettings: (settings: Record<string, string>): Promise<{ ok: boolean }> =>
    ipcRenderer.invoke("aira:save-settings", settings),
  restartEngine: (): Promise<{ ok: boolean; reason?: string }> =>
    ipcRenderer.invoke("aira:restart-engine"),
  revealDataFolder: (): Promise<{ ok: boolean }> => ipcRenderer.invoke("aira:reveal-data"),
};

contextBridge.exposeInMainWorld("aira", api);

export type AiraApi = typeof api;
