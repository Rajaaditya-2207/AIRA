/**
 * AIRA desktop entry point.
 *
 * Lifecycle (packaged mode):
 *   1. Ensure %APPDATA%/AIRA/data exists; bootstrap SQLite DB from the
 *      bundled baseline migration on first launch.
 *   2. Spawn the bundled Next.js standalone server as a child process on a
 *      random free localhost port (ELECTRON_RUN_AS_NODE=1).
 *   3. Poll /api/health until ready (splash screen shown meanwhile).
 *   4. Load the app into the window. On quit, kill the child server tree.
 *
 * Dev mode (AIRA_DEV=1): expects `next dev` already running on :3057 and
 * loads it directly — no child process, no DB bootstrap.
 */
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const isDev = !!process.env.AIRA_DEV;
const DEV_SERVER_URL = "http://localhost:3057";

let mainWindow: BrowserWindow | null = null;
let serverProc: ChildProcess | null = null;
// Voice-agent worker process (see spawnAgent below).
let agentProc: ChildProcess | null = null;
let quitting = false;

// ---------------------------------------------------------------------------
// Paths & settings
// ---------------------------------------------------------------------------

function dataDir(): string {
  const dir = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function recordingsDir(): string {
  const dir = path.join(dataDir(), "recordings");
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

const SETTINGS_KEYS = [
  "GEMINI_API_KEY",
  "GEMINI_INTAKE_MODEL",
  "GEMINI_REALTIME_MODEL",
  "GEMINI_REALTIME_VOICE",
  "GEMINI_TEMPERATURE_INTAKE",
  "GEMINI_TEMPERATURE_REALTIME",
  "LIVEKIT_URL",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "LIVEKIT_SIP_TRUNK_ID",
  "LIVEKIT_SIP_NUMBER",
  "LIVEKIT_AGENT_NAME",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_SIP_TRUNK_SID",
  "CALL_SESSION_TIMEOUT_SECONDS",
  "AIRA_LOG_LEVEL",
  "RECORDING_PROVIDER",
  "RECORDING_GCP_BUCKET",
  "RECORDING_GCP_PREFIX",
  "RECORDING_GCP_CREDENTIALS_B64",
  "AIRA_DISPLAY_FONT",
] as const;

type Settings = Record<string, string>;

function settingsFile(): string {
  return path.join(app.getPath("userData"), "settings.json");
}

function readSettings(): Settings {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsFile(), "utf8")) as Settings;
    const clean: Settings = {};
    for (const key of SETTINGS_KEYS) {
      if (typeof raw[key] === "string") clean[key] = raw[key];
    }
    return clean;
  } catch {
    return {};
  }
}

function writeSettings(incoming: unknown): { ok: true } {
  const source = (incoming ?? {}) as Record<string, unknown>;
  // Merge over existing values: callers may save a single key (e.g. the
  // display-font picker) without accidentally wiping every other setting.
  const merged = readSettings();
  for (const key of SETTINGS_KEYS) {
    const value = source[key];
    if (typeof value === "string" && value.length > 0) merged[key] = value;
  }
  fs.writeFileSync(settingsFile(), JSON.stringify(merged, null, 2), "utf8");
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Database bootstrap (first launch)
// ---------------------------------------------------------------------------

function appendLog(line: string): void {
  try {
    fs.appendFileSync(path.join(dataDir(), "server.log"), `${new Date().toISOString()} ${line}\n`);
  } catch {
    /* best effort */
  }
}

function ensureDatabase(): void {
  if (isDev) return; // dev DB lives at prisma/dev.db, managed by migrations
  const dbPath = path.join(dataDir(), "aira.db");
  if (fs.existsSync(dbPath)) return;

  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require(path.join(
    process.resourcesPath,
    "next-app",
    "node_modules",
    "better-sqlite3",
  )) as typeof import("better-sqlite3");

  const baselinePath = path.join(process.resourcesPath, "next-app", "prisma-baseline.sql");
  const sql = fs.readFileSync(baselinePath, "utf8");
  const db = new Database(dbPath);
  try {
    db.exec(sql);
    db.pragma("user_version = 1");
  } finally {
    db.close();
  }
  appendLog(`[db] bootstrapped ${dbPath}`);
}

// ---------------------------------------------------------------------------
// Bundled Next.js server lifecycle
// ---------------------------------------------------------------------------

async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const address = srv.address() as net.AddressInfo;
      srv.close(() => resolve(address.port));
    });
  });
}

function spawnServer(port: number): void {
  const standaloneEntry = path.join(process.resourcesPath, "next-app", "server.js");
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: `file:${path.join(dataDir(), "aira.db").replace(/\\/g, "/")}`,
    AIRA_DATA_DIR: dataDir(),
    AIRA_RECORDINGS_DIR: recordingsDir(),
    NODE_ENV: "production",
    ...readSettings(),
  };

  serverProc = spawn(process.execPath, [standaloneEntry], {
    env,
    cwd: path.dirname(standaloneEntry), // standalone expects its own dir as cwd
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  appendLog(`[server] spawned pid=${serverProc.pid} port=${port}`);
  serverProc.stdout?.on("data", (chunk: Buffer) => appendLog(`[out] ${chunk.toString().trimEnd()}`));
  serverProc.stderr?.on("data", (chunk: Buffer) => appendLog(`[err] ${chunk.toString().trimEnd()}`));
  serverProc.on("exit", (code) => {
    appendLog(`[server] exited code=${code}`);
    serverProc = null;
  });
}

function stopServer(): void {
  if (!serverProc) return;
  const pid = serverProc.pid;
  serverProc.kill();
  if (pid && process.platform === "win32") {
    // Kill the whole child tree (standalone server may spawn workers).
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
  }
  serverProc = null;
}

// ---------------------------------------------------------------------------
// Voice agent worker
// ---------------------------------------------------------------------------

/**
 * The LiveKit voice agent is a SEPARATE process from the Next server. It used
 * to exist only as `npm run dev:agent`, which the packaged app never started —
 * so every dispatched call reached a real phone number with nobody answering.
 * It is now bundled (scripts/build-agent.cjs → build/agent) and spawned here.
 *
 * The worker reads credentials from its own environment, so the allowlisted
 * settings.json values must be injected here exactly as they are for the
 * server child process.
 */
function agentEntry(): string | null {
  const candidates = isDev
    ? [path.join(app.getAppPath(), "build", "agent", "telephony-agent.cjs")]
    : [path.join(process.resourcesPath, "agent", "telephony-agent.cjs")];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function spawnAgent(): void {
  const entry = agentEntry();
  if (!entry) {
    appendLog("[agent] SKIPPED — worker bundle not found (run npm run build:agent)");
    return;
  }
  if (!readSettings().GEMINI_API_KEY) {
    appendLog("[agent] SKIPPED — no Gemini API key configured yet (Settings → AI)");
    return;
  }

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    NODE_ENV: "production",
    ...readSettings(),
  };

  agentProc = spawn(process.execPath, [entry, "dev"], {
    env,
    cwd: path.dirname(entry),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });

  appendLog(`[agent] spawned pid=${agentProc?.pid ?? "?"} entry=${entry}`);
  agentProc?.stdout?.on("data", (chunk: Buffer) => appendLog(`[agent:out] ${chunk.toString().trimEnd()}`));
  agentProc?.stderr?.on("data", (chunk: Buffer) => appendLog(`[agent:err] ${chunk.toString().trimEnd()}`));
  agentProc?.on("exit", (code) => {
    appendLog(`[agent] exited code=${code}`);
    agentProc = null;
  });
}

function stopAgent(): void {
  if (!agentProc) return;
  const pid = agentProc.pid;
  agentProc.kill();
  if (pid && process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
  }
  agentProc = null;
}

function waitHealthy(port: number, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = (): void => {
      if (Date.now() > deadline) {
        reject(new Error(`Server did not become healthy within ${timeoutMs}ms`));
        return;
      }
      const req = http.get({ host: "127.0.0.1", port, path: "/api/health", timeout: 1500 }, (res) => {
        res.resume();
        if (res.statusCode === 200) {
          resolve();
          return;
        }
        setTimeout(attempt, 400);
      });
      req.on("error", () => setTimeout(attempt, 400));
      req.on("timeout", () => {
        req.destroy();
        setTimeout(attempt, 400);
      });
    };
    attempt();
  });
}

// ---------------------------------------------------------------------------
// Window & app wiring
// ---------------------------------------------------------------------------

const SPLASH_HTML = `data:text/html;charset=utf-8,${encodeURIComponent(
  `<body style="font-family:system-ui,-apple-system,sans-serif;background:#ffffff;color:#4f46e5;display:grid;place-items:center;height:100vh;margin:0">
     <div style="text-align:center">
       <h1 style="font-size:28px;font-weight:600;letter-spacing:-0.02em;margin:0">AIRA</h1>
       <p style="color:#71717a;margin-top:8px">Starting local engine…</p>
     </div>
   </body>`,
)}`;

const ERROR_HTML = (message: string): string =>
  `data:text/html;charset=utf-8,${encodeURIComponent(
    `<body style="font-family:monospace;padding:24px;color:#dc2626"><h2>AIRA failed to start</h2><pre>${message}</pre></body>`,
  )}`;

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 680,
    autoHideMenuBar: true,
    title: "AIRA",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.on("closed", () => {
    mainWindow = null;
  });
  return win;
}

function registerIpc(): void {
  ipcMain.handle("aira:get-settings", () => readSettings());
  ipcMain.handle("aira:save-settings", (_event, incoming: unknown) => writeSettings(incoming));
  ipcMain.handle("aira:reveal-data", async () => {
    await shell.openPath(dataDir());
    return { ok: true };
  });
  ipcMain.handle("aira:restart-engine", async () => {
    if (isDev || !mainWindow) return { ok: false, reason: "not-packaged" };
    stopServer();
    stopAgent();
    const port = await freePort();
    spawnServer(port);
    spawnAgent();
    try {
      await waitHealthy(port);
      await mainWindow.loadURL(`http://127.0.0.1:${port}`);
      return { ok: true };
    } catch (error) {
      appendLog(`[restart] failed: ${String(error)}`);
      return { ok: false, reason: String(error) };
    }
  });
}

async function start(): Promise<void> {
  registerIpc();
  await app.whenReady();

  mainWindow = createWindow();

  if (isDev) {
    await mainWindow.loadURL(DEV_SERVER_URL);
    return;
  }

  try {
    ensureDatabase();
    await mainWindow.loadURL(SPLASH_HTML);
    const port = await freePort();
    spawnServer(port);
    await waitHealthy(port);
    spawnAgent();
    appendLog("[app] ready");
    await mainWindow.loadURL(`http://127.0.0.1:${port}`);
  } catch (error) {
    appendLog(`[app] startup failed: ${String(error)}`);
    await mainWindow.loadURL(
      ERROR_HTML(`${String(error)}\n\nSee log: ${path.join(dataDir(), "server.log")}`),
    );
  }
}

app.on("before-quit", () => {
  if (quitting) return;
  quitting = true;
  stopServer();
  stopAgent();
});

app.on("window-all-closed", () => {
  app.quit();
});

void start().catch((error) => {
  appendLog(`[app] fatal: ${String(error)}`);
});
