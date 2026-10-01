# AIRA Desktop App + UI Overhaul — Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task. Load `test-driven-development` for code tasks, `webapp-testing`/`verify` for validation phases, `shadcn-ui-modernization` + `frontend-design` + `ux-copy` for Phase 4, `code-review` after each phase.

**Goal:** Turn the AIRA (CallAgent) Next.js web app into a local-first **Windows desktop app** (Electron shell, SQLite storage, zero Docker) with a substantially improved UI where **recordings and transcripts are first-class citizens**, while keeping the existing freeform intake (context + phone numbers) exactly as-is.

**Architecture:** Electron main process owns lifecycle: it ensures the SQLite DB exists (runs a baseline migration on first launch), spawns the Next.js **standalone** production server as a child process (`ELECTRON_RUN_AS_NODE=1`) bound to `127.0.0.1:<random free port>`, polls a new `/api/health` route, then swaps a splash screen for the app window. All data (DB file, recording cache, settings) lives under `%APPDATA%/AIRA`. The renderer is the existing Next.js UI, upgraded phase-by-phase. Telephony (LiveKit/Twilio/Gemini) stays cloud-based — only *data* becomes local.

**Tech Stack:** Electron 38 · electron-builder (NSIS) · Next.js 16 standalone output · Prisma 7 + `@prisma/adapter-better-sqlite3` (replaces Postgres/pg adapter) · Vitest · existing shadcn/ui + Tailwind v4 stack.

**Skills selected for execution:** `subagent-driven-development` (dispatch), `test-driven-development` (every logic task), `systematic-debugging` (failures), `webapp-testing` + `verify` (runtime validation), `frontend-design` + `shadcn-ui-modernization` (Phase 4 visuals), `ux-copy` (error/empty states), `code-review` (post-phase gate).

---

## Current Context (verified in this session)

- Repo root: `E:\Aditya\College Work\MICROPROJECT\AIRA` — **no git repo yet**; pristine state verified (lockfile md5 `4632f54f…`).
- Known blockers from audit: `"@livekit/rtc-node-darwin-arm64"` breaks `npm install` on Windows; `.env.example` missing; `src/lib/db.ts` instantiates PrismaClient at module scope (breaks `next build` without `DATABASE_URL`).
- Schema uses Postgres features SQLite can't store: 4 enums, 3 `Json` columns (`ExtractedFinding.rules/raw`, `EventLog.payload`). Fresh install ⇒ **no data migration needed**; we replace migrations with a SQLite baseline.
- Recordings today: LiveKit egress → GCS; metadata JSON in `process.cwd()/.callagent-recordings`; played via `/api/recordings/[callId]` proxy. Legacy fallback: `public/recordings/<callId>.mp3`.
- Transcripts exist per call (`TranscriptEvent`) but are only visible on the Live page — **not** on Results.
- UI gaps (from screenshot inspection): broken mobile layout (moot for fixed desktop window, but grids still get fixed), read-only intake preview, dead-end error states, Live page lies ("running" forever, no connection indicator, no elapsed time), Results hides price/availability/fit and has no transcript/audio access.
- User directives: keep intake flow (context + numbers) unchanged; recordings + transcripts must be prominently available; data must stay on-device; desktop app "like OpenCode-class apps".

## Assumptions

1. Windows-only packaging first (user's machine). macOS/Linux left to a future plan.
2. No production data exists to preserve — clean SQLite baseline is acceptable.
3. Brand name settles on **AIRA** (navbar/tab renamed from "Zeppy"); flagged as open question below.
4. GCS remains **optional**: without it, new calls have no cloud recording; the app surfaces that honestly. A local recording *cache* makes playback work offline after first download.

---

## Phase 0 — Safety Net & Fast Wins

### Task 0.1: Initialize git and baseline commit

**Files:** none created (repo-level).

1. Run: `git init && git add -A && git commit -m "chore: baseline before desktop migration"`
2. Verify: `git log --oneline` shows 1 commit; `git status` clean.

### Task 0.2: Fix Windows install + add `.env.example`

**Files:**
- Modify: `package.json` (dependencies block)
- Create: `.env.example`

**Step 1:** Delete the line `"@livekit/rtc-node-darwin-arm64": "^0.13.24",` from `package.json` dependencies.

**Step 2:** Create `.env.example`:

```dotenv
# Database (desktop build sets this automatically; only needed for web-dev against Docker)
DATABASE_URL="postgresql://callagent:callagent@localhost:5432/callagent"

# --- AI ---
GEMINI_API_KEY=""
GEMINI_INTAKE_MODEL="gemini-3-pro-preview"
GEMINI_REALTIME_MODEL="gemini-2.5-flash-native-audio-preview-12-2025"
GEMINI_REALTIME_VOICE="Puck"

# --- Telephony (LiveKit SIP + Twilio trunk) ---
LIVEKIT_URL="wss://your-project.livekit.cloud"
LIVEKIT_API_KEY=""
LIVEKIT_API_SECRET=""
LIVEKIT_SIP_TRUNK_ID=""
LIVEKIT_SIP_NUMBER=""
LIVEKIT_AGENT_NAME="aira-telephony-agent"
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_SIP_TRUNK_SID=""

# --- Call control ---
CALL_SESSION_TIMEOUT_SECONDS="120"
CALLAGENT_LOG_LEVEL="info"

# --- Recordings (optional, GCS) ---
RECORDING_PROVIDER="gcp"
RECORDING_GCP_BUCKET=""
RECORDING_GCP_PREFIX="aira/recordings"
RECORDING_GCP_CREDENTIALS_B64=""
```

**Step 3:** Run: `npm install --no-audit --no-fund`
Expected: completes with **no** `notsup Valid os: darwin` error.

**Step 4:** Commit: `git commit -am "fix: drop darwin-only rtc dep, add env template"`

### Task 0.3: Lazy Prisma init (fixes bare `next build`)

**Files:** Modify: `src/lib/db.ts`

Replace file contents:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured.");
  }
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });
}

// Lazy singleton: safe to import at module scope in routes/pages,
// throws only when a query is actually attempted without config.
function getDb(): PrismaClient {
  if (!globalThis.prisma) {
    globalThis.prisma = createPrismaClient();
  }
  return globalThis.prisma;
}

export const db = new Proxy({} as PrismaClient, {
  get(_t, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

if (process.env.NODE_ENV !== "production") {
  // keep a direct handle for dev HMR reuse
  try { globalThis.prisma ??= undefined; } catch {}
}
```

**Verify:** `npx next build` (without `DATABASE_URL`) → succeeds; `DATABASE_URL=postgresql://x:x@localhost:5432/x npx next build` also succeeds.
**Commit:** `fix: lazy prisma client so builds don't require DATABASE_URL`

---

## Phase 1 — Local-First Data Layer (SQLite)

### Task 1.1: JSON column helpers (TDD)

**Files:**
- Create: `src/lib/dbjson.ts`
- Test: `src/lib/dbjson.test.ts`

**Step 1 — failing test** (`vitest` picks up `*.test.ts`):

```ts
import { describe, expect, it } from "vitest";
import { fromJsonText, toJsonText } from "./dbjson";

describe("dbjson helpers", () => {
  it("round-trips objects", () => {
    const value = { a: 1, b: ["x"], c: null };
    expect(fromJsonText(toJsonText(value))).toEqual(value);
  });
  it("returns fallback for null/undefined/garbage", () => {
    expect(fromJsonText<string[] | null>(null, null)).toBeNull();
    expect(fromJsonText("{oops", { d: 1 })).toEqual({ d: 1 });
  });
  it("serializes undefined arrays safely", () => {
    expect(toJsonText(undefined)).toBe("null");
  });
});
```

Run: `npx vitest run src/lib/dbjson.test.ts` → FAIL (module missing).

**Step 2 — implementation**:

```ts
export function toJsonText(value: unknown): string {
  return JSON.stringify(value ?? null);
}

export function fromJsonText<T>(text: string | null | undefined, fallback?: T): T {
  if (text === null || text === undefined || text === "") {
    return fallback as T;
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    return fallback as T;
  }
}
```

Run again → PASS. **Commit:** `feat: json-text helpers for sqlite json columns`

### Task 1.2: Swap schema to SQLite

**Files:**
- Modify: `prisma/schema.prisma`
- Delete: `prisma/migrations/**` (Postgres history — fresh baseline instead)
- Create: `prisma/migrations/0001_baseline_sqlite/migration.sql`
- Update: `prisma/migrations/migration_lock.toml` → `provider = "sqlite"`

**Step 1:** Rewrite schema — enums → `String` defaults, `Json` → `String`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Investigation {
  id                    String    @id @default(cuid())
  requirement           String
  status                String    @default("DRAFT")
  concurrency           Int       @default(3)
  startedAt             DateTime?
  completedAt           DateTime?
  recommendationSummary String?
  bestCallId            String?
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  contacts        Contact[]        @relation("InvestigationContacts")
  calls           Call[]           @relation("InvestigationCalls")
  recommendations Recommendation[]
  actionItems     ActionItem[]
  eventLogs       EventLog[]
  bestCall        Call?            @relation("InvestigationBestCall", fields: [bestCallId], references: [id])

  @@index([status, createdAt])
}

model Contact {
  id              String   @id @default(cuid())
  investigationId String
  name            String
  phone           String
  language        String   @default("english")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  investigation Investigation @relation("InvestigationContacts", fields: [investigationId], references: [id], onDelete: Cascade)
  calls         Call[]

  @@index([investigationId])
}

model Call {
  id                 String   @id @default(cuid())
  investigationId    String
  contactId          String
  status             String   @default("QUEUED")
  livekitRoomName    String?
  livekitParticipant String?
  livekitSipCallId   String?
  score              Float?
  failureReason      String?
  startedAt          DateTime?
  endedAt            DateTime?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  investigation         Investigation      @relation("InvestigationCalls", fields: [investigationId], references: [id], onDelete: Cascade)
  contact               Contact            @relation(fields: [contactId], references: [id], onDelete: Cascade)
  transcriptEvents      TranscriptEvent[]
  extractedFinding      ExtractedFinding?
  recommendation        Recommendation?
  eventLogs             EventLog[]
  bestForInvestigations Investigation[]    @relation("InvestigationBestCall")

  @@unique([investigationId, contactId])
  @@index([investigationId, status])
}

model TranscriptEvent {
  id          String   @id @default(cuid())
  callId      String
  speaker     String
  contactName String
  text        String
  createdAt   DateTime @default(now())

  call Call @relation(fields: [callId], references: [id], onDelete: Cascade)

  @@index([callId, createdAt])
}

model ExtractedFinding {
  id           String   @id @default(cuid())
  callId       String   @unique
  monthlyPrice Int?
  locationFit  String?
  availability String?
  rules        String? // JSON text
  confidence   Float?
  summary      String?
  raw          String? // JSON text
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  call Call @relation(fields: [callId], references: [id], onDelete: Cascade)
}

model Recommendation {
  id              String   @id @default(cuid())
  investigationId String
  callId          String   @unique
  rank            Int
  score           Float
  summary         String
  reasoning       String?
  monthlyPrice    Int?
  availability    String?
  locationFit     String?
  isBest          Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  investigation Investigation @relation(fields: [investigationId], references: [id], onDelete: Cascade)
  call          Call          @relation(fields: [callId], references: [id], onDelete: Cascade)

  @@unique([investigationId, rank])
  @@index([investigationId, score])
}

model ActionItem {
  id              String   @id @default(cuid())
  investigationId String
  priority        String   @default("MEDIUM")
  title           String
  detail          String
  done            Boolean  @default(false)
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  investigation Investigation @relation(fields: [investigationId], references: [id], onDelete: Cascade)

  @@index([investigationId, priority])
}

model EventLog {
  id              Int      @id @default(autoincrement())
  investigationId String
  callId          String?
  eventType       String
  payload         String // JSON text
  createdAt       DateTime @default(now())

  investigation Investigation @relation(fields: [investigationId], references: [id], onDelete: Cascade)
  call          Call?         @relation(fields: [callId], references: [id], onDelete: SetNull)

  @@index([investigationId, id])
  @@index([callId, id])
}
```

**Step 2:** Baseline SQL at `prisma/migrations/0001_baseline_sqlite/migration.sql` — translate the models above to `CREATE TABLE` (TEXT ids, `INTEGER` booleans/ints, `DATETIME` stored as Prisma's ms-integer convention is handled by Prisma itself — use plain `DATETIME`; JSON columns `TEXT`):

```sql
-- Prisma migrate baseline for SQLite (generated shape must match schema.prisma exactly;
-- author tables with prisma migrate diff --from-empty --to-schema-datamodel schema.prisma --script)
```

> **Do NOT hand-type this file.** Generate it deterministically:
> Run: `npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script > prisma/migrations/0001_baseline_sqlite/migration.sql`
> Then create `prisma/migrations/migration_lock.toml` with `provider = "sqlite"`.
> Apply: `set DATABASE_URL=file:./prisma/dev.db&& npx prisma migrate deploy` (bash: `DATABASE_URL="file:./prisma/dev.db" npx prisma migrate deploy`)
> Expected: `1 migration applied`.

**Step 3:** Typecheck fallout — enum imports break in `src/lib/mappers.ts` (imports `CallStatus`, `InvestigationStatus`, `TranscriptSpeaker` from `@prisma/client`). Replace with local string-literal types matching existing casts:

```ts
// top of mappers.ts — replaces the @prisma/client enum imports
type DbCallStatus = "QUEUED" | "DIALING" | "RINGING" | "CONNECTED" | "ANALYZING" | "COMPLETED" | "FAILED";
type DbInvestigationStatus = "DRAFT" | "RUNNING" | "COMPLETED" | "FAILED";
type DbTranscriptSpeaker = "AGENT" | "CONTACT" | "SYSTEM";
```

All `toDb*`/`fromDb*` bodies stay identical (they already cast strings).

**Step 4:** Fix `Json` consumers:
- `src/lib/events/log.ts`: `persistEvent` → `payload: toJsonText(payload)`; `getInvestigationSnapshot` unchanged except nothing reads JSON; `getEventsSince` → `payload: fromJsonText<SSEEventPayload>(row.payload)`. Import helpers from `@/lib/dbjson`. Change `payload: payload as unknown as object` typing accordingly (`String`).
- `src/lib/calls/state.ts` `saveExtractedFinding`: `rules: toJsonText(input.extracted.rules)`, `raw: toJsonText({ transcript: input.transcriptText, extraction: input.extracted })` (both create & update branches).
- `src/app/api/investigations/[id]/results/route.ts`: `extractFindings(item.call.extractedFinding?.raw)` → pass `fromJsonText<Record<string, unknown>>(item.call.extractedFinding?.raw ?? null)`; delete now-unused `isRecord` guard on raw entry point (keep helpers used elsewhere).
- `src/lib/analysis/recommend.ts`: `CandidateCall.extractedFinding.rules` is now `string | null` → map to `fromJsonText<string[]>(finding.rules, [])` where consumed (only used in scoring? it isn't — rules unused in scoring; just relax the Pick type to `"rules"` removal or keep with string type; choose: remove `rules` from the `Pick` since unused).

**Step 5:** Full verify:
- `npx tsc --noEmit` → 0 errors
- `npx vitest run` → all pass (route test mocks `$transaction`, unaffected)
- Smoke: `DATABASE_URL="file:./prisma/dev.db" npx tsx -e "import{db}from'./src/lib/db';db.investigation.create({data:{requirement:'smoke'}}).then(r=>console.log('created',r.id)).then(()=>process.exit(0))"` → prints an id.
  (Note: `src/lib/db.ts` still uses pg adapter in web-dev mode — see Task 1.3 to make adapter selectable.)

**Commit:** `feat!: sqlite data layer (enums->text, json->text, baseline migration)`

### Task 1.3: Selectable driver adapter (pg for web-dev, sqlite for desktop)

**Files:**
- Modify: `src/lib/db.ts`
- Modify: `package.json` (add `@prisma/adapter-better-sqlite3@^7.4.0`, `better-sqlite3@^11`)

**Step 1:** In `createPrismaClient()` choose adapter by URL scheme:

```ts
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "@prisma/client";

function createAdapter(databaseUrl: string) {
  if (databaseUrl.startsWith("file:")) {
    return new PrismaBetterSqlite3({ source: databaseUrl });
  }
  return new PrismaPg({ connectionString: databaseUrl });
}
```

(rest of Task 0.3 file unchanged otherwise)

**Step 2:** Install, then rerun the Task 1.2 smoke through the app path:
`DATABASE_URL="file:./prisma/dev.db" npx tsx -e "…same smoke…"` → works via better-sqlite3.

**Commit:** `feat: dual prisma adapters (pg | better-sqlite3 by DATABASE_URL scheme)`

### Task 1.4: Demo seed script (unblocks ALL UI work without telephony)

**Files:**
- Create: `scripts/seed-demo.ts`
- Modify: `package.json` scripts → `"db:seed": "tsx scripts/seed-demo.ts"`

Behavior (complete logic, ~120 lines — implementer writes following this contract exactly):
1. Reads `DATABASE_URL` (must be `file:` for the demo DB).
2. Wipes tables (`deleteMany` in FK-safe order: eventLogs, transcripts, recommendations, actionItems, extractedFindings, calls, contacts, investigations).
3. Creates investigation `DEMO1`: requirement *"Need a PG in Koramangala under 15k with food."*, status `COMPLETED`, `startedAt/completedAt` set.
4. Creates 3 contacts + calls: **Asha Homes** (COMPLETED, score 86, tamil), **City Stay** (COMPLETED, score 74, english), **Ravi Mess** (FAILED, failureReason `No transcript captured from the live call.`).
5. For each completed call: `ExtractedFinding` (prices 13000/14500, availability strings, fit summaries, `rules`/`raw` via `toJsonText`), 2 `Recommendation` rows (rank 1 isBest=true / rank 2), 8–12 `TranscriptEvent` lines alternating `agent`/`contact` with realistic PG questions, staggered `createdAt` (use `new Date(Date.now()-n*6000)`), 3 `ActionItem` rows, one `investigation.completed` `EventLog` (payload via `toJsonText`).
6. **Local recording fixture**: write a valid 2-second silent **WAV** (44-byte RIFF header + zero PCM data — generate with a tiny helper in the script; deterministic, no binaries committed) to `<AIRA_RECORDINGS_DIR or ./recordings-demo>/<callId>.wav`, and metadata JSON `{provider:"local", location:"<abs wav path>", egressId:"demo", createdAt}` to `.callagent-recordings/<callId>.json` (cwd-relative, matching current `recording-store`).
7. Console-tables what it created.

**Verify:** `npm run db:seed` → exits 0; rerunning is idempotent.
**Commit:** `feat: demo seed for UI development without telephony`

### Task 1.5: Serve local-provider recordings (+ Range support)

**Files:**
- Modify: `src/lib/calls/recording-store.ts` — `RecordingMetadata.provider` becomes `"gcp" | "local"`
- Modify: `src/app/api/recordings/[callId]/route.ts`

**Step 1:** In the route, before the GCS branch:

```ts
if (metadata.provider === "local") {
  const filePath = path.resolve(metadata.location);
  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "Recording file missing." }, { status: 404 });
  }
  const stat = await fs.promises.stat(filePath);
  const mime = filePath.endsWith(".wav") ? "audio/wav" : "audio/mpeg";
  const range = request.headers.get("range");
  if (range) {
    const m = /bytes=(\d*)-(\d*)/.exec(range);
    const start = m?.[1] ? Number(m[1]) : 0;
    const end = m?.[2] ? Math.min(Number(m[2]), stat.size - 1) : stat.size - 1;
    const chunk = fs.readFileSync(filePath).subarray(start, end + 1);
    return new Response(new Uint8Array(chunk), {
      status: 206,
      headers: {
        "content-type": mime,
        "content-range": `bytes ${start}-${end}/${stat.size}`,
        "accept-ranges": "bytes",
        "cache-control": "private, max-age=3600",
      },
    });
  }
  const buf = fs.readFileSync(filePath);
  return new Response(new Uint8Array(buf), {
    headers: { "content-type": mime, "accept-ranges": "bytes", "cache-control": "private, max-age=3600" },
  });
}
```

(import `fs`, `path` from `node:*`; route already `runtime="nodejs"`)
**Step 2:** GCS branch additionally gains a **write-through disk cache**: after a successful `file.download()`, write bytes to `process.env.AIRA_RECORDINGS_DIR ?? path.join(process.cwd(), ".callagent-recordings", "cache")` as `<callId>.mp3`, and on future requests check that cache **before** hitting GCS. (Keeps desktop playback fast/offline.)

**Verify:** seed → `curl -s -o /dev/null -w "%{http_code} %{content_type}" http://localhost:3000/api/recordings/<completedCallId>` → `200 audio/wav`; repeat with `-H "Range: bytes=0-99"` → `206`.
**Commit:** `feat: local recording provider + range requests + gcs disk cache`

### Task 1.6: Health endpoint + richer calls/transcripts APIs

**Files:**
- Create: `src/app/api/health/route.ts`
- Create: `src/app/api/calls/[callId]/transcript/route.ts`
- Create: `src/app/api/investigations/[id]/calls/route.ts`
- Test: `src/app/api/health/route.test.ts`

**Health** (used by Electron readiness poll):

```ts
import { NextResponse } from "next/server";
export const runtime = "nodejs";
export async function GET() {
  return NextResponse.json({ ok: true, ts: Date.now() });
}
```

Test asserts 200 + `{ok:true}` shape (mirror mocking style of `route.test.ts`).

**Transcript route:** validates `callId` cuid (reuse `z.string().cuid()`), loads `db.transcriptEvent.findMany({ where:{callId}, orderBy:{createdAt:"asc"} })`, maps with `mapTranscriptToLine`, returns `{ callId, lines }`; 404 when call doesn't exist.

**Investigation calls route:** returns per-call detail for the Results "Evidence" UI:

```ts
{ investigationId, status, calls: Array<{
  id, contactName, phone, language, status, score, failureReason,
  startedAt: string|null, endedAt: string|null,
  recordingUrl: string|null,          // via getCallRecordingUrlIfExists
  finding: { summary:string|null, monthlyPrice:number|null, availability:string|null,
             locationFit:string|null, confidence:number|null,
             rules:string[], keyFacts:string[], actionItems:string[] } | null,
}> }
```

(keyFacts/actionItems parsed out of `raw.extraction` via `fromJsonText`; rules via `fromJsonText`.)

**Verify:** `npx tsc --noEmit` clean; seed + `curl` each endpoint against demo ids.
**Commit:** `feat: health, per-call transcript, per-investigation call-detail APIs`

---

## Phase 2 — Electron Desktop Shell

### Task 2.1: Electron scaffolding

**Files:**
- Modify: `package.json` — add `"main": "dist-electron/main.js"`, scripts:

```json
"desktop:dev": "concurrently -k \"next dev -p 3057\" \"cross-env AIRA_DEV=1 electron .\"",
"desktop:build": "next build && tsc -p electron/tsconfig.json && electron-builder --win",
```

and devDeps: `electron@^38`, `electron-builder@^25`, `cross-env@^7`; add deps: none new besides Task 1.3.
- Create: `electron/tsconfig.json` (`module":"commonjs"`, `outDir:"../dist-electron"`, `types":["node"]`)
- Create: `electron/preload.ts`
- Modify: `next.config.ts` → `const nextConfig: NextConfig = { output: "standalone" };`
- Create: `electron-builder.yml`:

```yaml
appId: app.aira.desktop
productName: AIRA
directories:
  output: dist-desktop
files:
  - dist-electron/**
  - .next/standalone/**
  - .next/static/**
  - public/**
  - prisma/migrations/0001_baseline_sqlite/migration.sql
asarUnpack:
  - "**/node_modules/better-sqlite3/**"
  - ".next/standalone/**"
win:
  target: nsis
nsis:
  oneClick: false
  allowToChangeInstallationDirectory: true
```

**Verify:** `npx tsc -p electron/tsconfig.json` compiles stub main (below) to `dist-electron/`.

Stub `electron/main.ts` for this task:

```ts
import { app, BrowserWindow } from "electron";
import path from "node:path";

const isDev = !!process.env.AIRA_DEV;

async function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 800, minWidth: 1024, minHeight: 680,
    autoHideMenuBar: true, backgroundColor: "#ffffff", title: "AIRA",
  });
  await win.loadURL(isDev ? "http://localhost:3057" : "about:blank");
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
```

**Commit:** `feat: electron scaffolding (dev window over next dev)`

### Task 2.2: Production server lifecycle in main process

**Files:** Modify: `electron/main.ts` (replace stub body; keep exports minimal)

Implement exactly these pieces (complete code):

```ts
import { app, BrowserWindow, ipcMain, shell } from "electron";
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import path from "node:path";

const isDev = !!process.env.AIRA_DEV;
let serverProc: ChildProcess | null = null;
let serverPort = 0;
let mainWindow: BrowserWindow | null = null;

const dataDir = () => {
  const d = path.join(app.getPath("userData"), "data");
  fs.mkdirSync(d, { recursive: true });
  return d;
};
const recordingsDir = () => {
  const d = path.join(dataDir(), "recordings");
  fs.mkdirSync(d, { recursive: true });
  return d;
};
const settingsFile = () => path.join(app.getPath("userData"), "settings.json");

type Settings = Record<string, string>;
function readSettings(): Settings {
  try { return JSON.parse(fs.readFileSync(settingsFile(), "utf8")) as Settings; }
  catch { return {}; }
}

export const ALLOWED_SETTING_KEYS = [
  "GEMINI_API_KEY", "GEMINI_INTAKE_MODEL", "GEMINI_REALTIME_MODEL", "GEMINI_REALTIME_VOICE",
  "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_SIP_TRUNK_ID",
  "LIVEKIT_SIP_NUMBER", "LIVEKIT_AGENT_NAME",
  "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_SIP_TRUNK_SID",
  "CALL_SESSION_TIMEOUT_SECONDS", "CALLAGENT_LOG_LEVEL",
  "RECORDING_PROVIDER", "RECORDING_GCP_BUCKET", "RECORDING_GCP_PREFIX", "RECORDING_GCP_CREDENTIALS_B64",
] as const;

function freePort(): Promise<number> {
  return new Promise((resolve) => {
    const srv = net.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const p = (srv.address() as net.AddressInfo).port;
      srv.close(() => resolve(p));
    });
  });
}

function serverEnv(port: number): NodeJS.ProcessEnv {
  const dbPath = path.join(dataDir(), "aira.db").replace(/\\/g, "/");
  return {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    PORT: String(port),
    HOSTNAME: "127.0.0.1",
    DATABASE_URL: `file:${dbPath}`,
    AIRA_DATA_DIR: dataDir(),
    AIRA_RECORDINGS_DIR: recordingsDir(),
    ...Object.fromEntries(
      Object.entries(readSettings()).filter(([k]) => (ALLOWED_SETTING_KEYS as readonly string[]).includes(k)),
    ),
  };
}

function spawnServer(port: number) {
  const standaloneEntry = path.join(
    process.resourcesPath, "app.asar.unpacked", ".next", "standalone", "server.js",
  );
  const log = fs.openStreamSync ?? null; // not used; simple append below
  serverProc = spawn(process.execPath, [standaloneEntry], {
    env: serverEnv(port),
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  const logFile = path.join(dataDir(), "server.log");
  serverProc.stdout?.on("data", (c: Buffer) => fs.appendFileSync(logFile, c));
  serverProc.stderr?.on("data", (c: Buffer) => fs.appendFileSync(logFile, c));
  serverProc.on("exit", (code) => {
    fs.appendFileSync(logFile, `\n[server exited ${code}]\n`);
    serverProc = null;
  });
}

function stopServer() {
  if (!serverProc) return;
  const pid = serverProc.pid;
  serverProc.kill();
  if (pid && process.platform === "win32") {
    spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true });
  }
  serverProc = null;
}

function waitHealthy(port: number, timeoutMs = 60000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: "127.0.0.1", port, path: "/api/health", timeout: 1500 }, (res) => {
        res.resume();
        if (res.statusCode === 200) return resolve();
        retry();
      });
      req.on("error", retry);
      req.on("timeout", () => { req.destroy(); retry(); });
    };
    const retry = () => {
      if (Date.now() > deadline) return reject(new Error("Server did not become healthy in time."));
      setTimeout(tick, 400);
    };
    tick();
  });
}

function ensureDatabase() {
  const dbPath = path.join(dataDir(), "aira.db");
  if (fs.existsSync(dbPath)) return;
  const baseline = path.join(
    process.resourcesPath, "app.asar", "prisma", "migrations", "0001_baseline_sqlite", "migration.sql",
  );
  // better-sqlite3 is unpacked (see electron-builder.yml asarUnpack)
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require(path.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "better-sqlite3"));
  const db = new Database(dbPath);
  db.exec(fs.readFileSync(process.env.AIRA_DEV ? "prisma/migrations/0001_baseline_sqlite/migration.sql" : baseline, "utf8"));
  db.pragma("user_version = 1");
  db.close();
}
```

Startup sequence in `app.whenReady()`:

```ts
await app.whenReady();
ensureDatabase();
const SPLASH = `data:text/html;charset=utf-8,${encodeURIComponent(
  `<body style="font-family:system-ui;background:#fff;color:#166534;display:grid;place-items:center;height:100vh;margin:0"><div><h1 style="font-weight:600">AIRA</h1><p>Starting local engine…</p></div></body>`,
)}`;
mainWindow = new BrowserWindow({ /* Task 2.1 options */ });
await mainWindow.loadURL(SPLASH);
if (isDev) {
  await mainWindow.loadURL("http://localhost:3057");
} else {
  serverPort = await freePort();
  spawnServer(serverPort);
  try {
    await waitHealthy(serverPort);
    await mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
  } catch (err) {
    await mainWindow.loadURL(
      `data:text/html;charset=utf-8,${encodeURIComponent(`<pre style="padding:24px">${String(err)} — see ${path.join(dataDir(), "server.log")}</pre>`)}`,
    );
  }
}
app.on("before-quit", stopServer);
```

**Verify (dev):** `npm run desktop:dev` → Electron window opens showing the Next app; typing into the briefing textarea works; closing the window exits cleanly (no orphan `node` processes: check Task Manager).
**Commit:** `feat: electron manages standalone next server lifecycle`

### Task 2.3: Preload bridge + Settings IPC

**Files:**
- Create: `electron/preload.ts`:

```ts
import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("aira", {
  getSettings: () => ipcRenderer.invoke("aira:get-settings"),
  saveSettings: (s: Record<string, string>) => ipcRenderer.invoke("aira:save-settings", s),
  restartEngine: () => ipcRenderer.invoke("aira:restart-engine"),
  revealDataFolder: () => ipcRenderer.invoke("aira:reveal-data"),
});
```

- Modify: `electron/main.ts` — register handlers:

```ts
ipcMain.handle("aira:get-settings", () => readSettings());
ipcMain.handle("aira:save-settings", (_e, incoming: Record<string, string>) => {
  const clean: Settings = {};
  for (const k of ALLOWED_SETTING_KEYS) {
    const v = incoming[k];
    if (typeof v === "string" && v.length > 0) clean[k] = v;
  }
  fs.writeFileSync(settingsFile(), JSON.stringify(clean, null, 2));
  return { ok: true };
});
ipcMain.handle("aira:restart-engine", async () => {
  if (isDev || !mainWindow) return { ok: false };
  stopServer();
  serverPort = await freePort();
  spawnServer(serverPort);
  await waitHealthy(serverPort);
  await mainWindow.loadURL(`http://127.0.0.1:${serverPort}`);
  return { ok: true };
});
ipcMain.handle("aira:reveal-data", () => { shell.openPath(dataDir()); });
```

- Create global type shim `src/types/aira.d.ts` declaring `window.aira` (optional members, so web-dev still works).

**Verify:** in DevTools console of the Electron window: `await window.aira.getSettings()` returns `{}`; save a dummy key then get returns it.
**Commit:** `feat: settings ipc bridge (get/save/restart/reveal)`

### Task 2.4: Package a Windows installer (smoke gate)

1. Run: `npm run desktop:build`
   Expected: `.next/standalone/server.js` exists; `dist-desktop/AIRA Setup <ver>.exe` produced.
2. Launch the exe. Expected: splash → app; create a demo investigation via UI (parser will error without Gemini key — that's fine, error UI appears); close app; relaunch → DB persisted (previous attempt row visible on `/investigations`).
3. Check `%APPDATA%/AIRA/data/` contains `aira.db`, `recordings/`, `server.log`.
4. Commit any packaging fixes: `fix: packaging issues found in smoke test`

---

## Phase 3 — UI Overhaul (usability core)

> All UI work verifies against the **seeded demo DB**: `npm run db:seed` + `npm run desktop:dev` (or web `next dev` with `DATABASE_URL=file:./prisma/dev.db`). Screenshots at 1280×800.

### Task 3.1: Human-readable error mapper (TDD)

**Files:** Create `src/lib/errors.ts` + `src/lib/errors.test.ts`

```ts
const MAP: Array<{ test: RegExp; title: string; hint: string }> = [
  { test: /GEMINI_API_KEY/i, title: "AI parser isn't configured", hint: "Open Settings and add your Gemini API key." },
  { test: /DATABASE_URL|P1001|ECONNREFUSED/i, title: "Local database isn't ready", hint: "Restart AIRA. If it persists, open Settings → Reveal data folder and check server.log." },
  { test: /LIVEKIT|TWILIO|trunk/i, title: "Calling isn't configured yet", hint: "Add your LiveKit + Twilio keys in Settings to place real calls." },
];

export function humanizeError(message: string): { title: string; hint: string; raw: string } {
  for (const m of MAP) if (m.test.test(message)) return { ...m, raw: message };
  return { title: "Something went wrong", hint: "", raw: message };
}
```

Test: 3 cases (gemini key, db down, passthrough). RED→GREEN→commit `feat: humanized error mapper`.

### Task 3.2: Shared `ErrorState` + skeletons + `ScoreBar` components

**Files:**
- Create: `src/components/state/error-state.tsx` — dashed-border card: bold `title`, muted `hint`, collapsible `<details>` with `raw`, primary button `onRetry` labeled "Try again".
- Create: `src/components/state/card-skeleton.tsx` — pulse placeholder matching Card metrics.
- Create: `src/components/results/score-bar.tsx`:

```tsx
const tone = score >= 75 ? "bg-primary" : score >= 50 ? "bg-amber-500" : "bg-red-500";
// renders: <div class="flex items-center gap-2"><Progress value={score}/><span>{score}</span></div> with tone applied to indicator
```

Wire `humanizeError` wherever `error` text is rendered today (home form, results page, list page).
**Verify:** visually with Gemini-key-missing parse attempt (home) and bad-id results page.
**Commit:** `feat: shared error/skeleton/score-bar components`

### Task 3.3: Home — editable preview (fulfills "review before launch")

**Files:**
- Modify: `src/app/page.tsx`
- Revive/adapt: `src/components/contacts/contact-row.tsx` → editable row (name input, phone input, language input with `list=` `<datalist>` fed by `PREFERRED_LANGUAGES`, remove ✕ button; props `(contact, index, onChange, onRemove, canRemove)`)
- Create: `src/components/intake/question-hints-editor.tsx` — chip list with per-chip ✕ and an "Add question" input

Contract:
- After successful parse, `preview` state stays; each contact edit updates `preview.contacts[i]` immutably.
- "＋ Add contact" appends `{name:"",phone:"",language:"english"}`; submit-time client validation via `createInvestigationStructuredSchema.safeParse` — invalid rows get red borders and block launch with a single summary message.
- Voice Agent Name label gains red asterisk + helper text "Required — how the AI introduces itself"; error shown inline (no more surprise alert on click).
- Placeholder textarea gains a "Load example brief" ghost button that fills the example text (keeps placeholder short).
- Launch button remains gated on valid schema + agentName non-empty.

**Verify:** seed-independent manual: parse demo text (needs Gemini key in Settings for Electron; for web-dev put key in `.env.local`) → edit name, fix a digit, remove a contact, add a question → launch → Live page reflects edits.
**Commit:** `feat: editable intake preview with validation`

### Task 3.4: Live Ops truthfulness + liveness

**Files:**
- Create: `src/hooks/use-investigation-stream.ts` — extracts the page's EventSource effect; tracks:

```ts
type StreamState = "connecting" | "live" | "stale" | "closed";
// onopen -> live; onerror -> stale + schedule reconnect (new EventSource after 2s backoff, max 5 tries) unless 404
// every payload bumps lastEventAt; a 20s interval flips live->stale when quiet
```

Returns `{state, snapshot…}`; page consumes.
- Modify: `src/app/investigations/[id]/live/page.tsx`:
  - Header badge shows stream state (`live` green dot pulsing / `reconnecting…` amber / `offline` grey) instead of lying "running" when nothing arrived; if snapshot 404 → full-page `ErrorState` "This investigation doesn't exist" + link home (detect via first fetch of `/api/investigations/[id]/calls` returning 404).
  - Per-call **elapsed timer** (mm:ss ticking while status ∈ dialing/ringing/connected) using new `startedAt` — add `startedAt: string | null` to `CallProgressItem` (`src/lib/domain.ts`), populate in `mapCallToProgressItem` from `call.startedAt?.toISOString() ?? null`.
  - Buttons: **Retry** on failed rows, **Cancel investigation** (danger, confirm dialog) in header.
  - Status badges gain icons: queued `Clock`, dialing `PhoneOutgoing`, ringing `BellRing animate-pulse`, connected `PhoneCall animate-pulse`, analyzing `Loader2 animate-spin`, completed `CircleCheckBig`, failed `XCircle`.
  - Fake per-status progress bars removed; replaced by the elapsed column (honest signal).
- Backend for buttons:
  - Create `src/lib/calls/control.ts`:

```ts
export async function cancelInvestigation(investigationId: string) {
  // 1) flip investigation -> FAILED, completedAt now
  // 2) calls in QUEUED/DIALING/RINGING/CONNECTED: hangup via stored room/participant (best-effort),
  //    status=FAILED, failureReason="Cancelled by user"
  // 3) persistEvent {type:"investigation.failed", reason:"cancelled"}
}
export async function retryCall(investigationId: string, callId: string) {
  // reset call -> DIALING happens inside runner; here: status=QUEUED, failureReason=null
  // then void executeSingleCall(...) (see Task 3.5) wrapped in the same catch/mark-failed pattern
}
```

  - Create routes `src/app/api/investigations/[id]/cancel/route.ts` (POST) and `src/app/api/investigations/[id]/retry/[callId]/route.ts` (POST).
- Modify `src/lib/calls/orchestrator.ts`: extract the per-call job body (lines ~41–167) into `export async function runSingleCall(investigationId: string, callId: string, options?: RunInvestigationOptions)`; `runInvestigation` maps its calls onto it (behavior identical). Retry endpoint reuses `runSingleCall`; guard: refuse when investigation `RUNNING` (409).

**TDD targets:** `control.ts` unit tests with mocked `db` (pattern from `route.test.ts`): cancel flips only non-terminal calls; retry rejects when RUNNING.

**Verify (seeded):** Live page on DEMO1 shows completed/failed rows with durations frozen, Retry enabled on failed row; cancel button hidden on COMPLETED investigations.
**Commits:** `feat: extract runSingleCall`, `feat: cancel+retry endpoints`, `feat: live ops stream state, timers, actions`

### Task 3.5: Results — Decision Brief that decides

**Files:**
- Modify: `src/app/investigations/[id]/results/page.tsx`
- Rewrite: `src/components/results/ranking-cards.tsx` → split into:
  - `src/components/results/comparison-table.tsx` (primary view): columns `Contact | Score (ScoreBar) | Price ₹ | Availability | Location fit | Evidence`; `Evidence` cell has 📄 Transcript (expand) and ▶ audio (inline `<audio controls preload="none">`, src = recordingUrl). Rows sorted by rank; failed calls pinned bottom with failureReason tooltip.
  - `src/components/results/transcript-drawer.tsx` — expanding row panel; lazily fetches `/api/calls/[callId]/transcript`; renders chat bubbles reusing TranscriptPane bubble styles; timestamps as **mm:ss offsets** from call `startedAt` (helper `formatOffset(startIso, lineIso)` in `src/lib/time.ts`, unit-tested).
  - Executive Summary card unchanged above table; Action Items below gain checkboxes wired to a new `PATCH /api/action-items/[id]` route (`z.object({done:boolean})`) with optimistic update.
- Auto-refresh: while `status !== "COMPLETED"`, poll `/api/investigations/[id]/calls` every 4s and swap skeletons in; on transition to completed, refetch results once.

**Verify (seeded):** DEMO1 shows Asha ₹13,000 / City Stay ₹14,500 / Ravi failed; transcript drawer opens with 10+ bubbles; audio plays the seeded WAV; checking an action item survives reload.
**Commits:** `feat: action-item toggle api`, `feat: results comparison table + transcript drawer`

### Task 3.6: Settings dialog (renderer)

**Files:**
- Create: `src/components/settings/settings-dialog.tsx` — Dialog with grouped sections (AI / Telephony / Recordings), password-type inputs for secrets, Save → `window.aira.saveSettings` → toast → `window.aira.restartEngine` (when available) with "Restarting engine…" state; "Reveal data folder" link.
- Modify: `src/components/app/app-navbar.tsx` — right side gains gear icon-button opening the dialog; brand text changed `Zeppy` → `AIRA`.
- Modify: `src/app/layout.tsx` metadata titles → `AIRA` / `%s | AIRA`.
- Web-dev fallback: when `window.aira` undefined, dialog renders read-only notice "Settings are environment variables when running as a web app."

**Verify:** in packaged build: paste a real Gemini key → Save → engine restarts → home parse works end-to-end.
**Commit:** `feat: in-app settings with engine restart`

### Task 3.7: Grid/overflow hygiene sweep

Even though desktop windows are fixed-size, fix the audited layout sins so narrow windows behave:
- `src/app/globals.css`: add `html, body { overflow-x: clip; }`
- Home grid: `grid gap-6 lg:grid-cols-[1.1fr_0.9fr]` → add `min-w-0` on children (placeholder text was forcing blowout)
- Tables wrap in `overflow-x-auto` containers.
**Verify:** resize window to min size — no horizontal scrollbar anywhere.
**Commit:** `fix: overflow/min-width hygiene`

---

## Phase 4 — Polish & Final Verification

### Task 4.1: Copy pass (`ux-copy` skill)
Audit every user-visible string: buttons verb-first, empty states tell the user what to do next, no raw error codes in primary copy. Update placeholders to match editable reality ("Fix anything the AI misheard, then launch.").

### Task 4.2: Test & quality gates
Run and make green, in order:
1. `npx tsc --noEmit` → 0 errors
2. `npx vitest run` → all pass (old 5 + new: dbjson, errors, time-offset, control.cancel/retry, health route)
3. `npx eslint .` → 0 issues
4. `npm run desktop:build` → installer artifact
5. Manual smoke checklist (document results in PR description):
   - Cold install → splash → home
   - Settings: enter Gemini key → restart → parse demo brief
   - Editable preview edits survive to Live page
   - Live: stream badge transitions, timer ticks, retry works on failed call (needs LiveKit creds; without creds assert graceful failure path)
   - Results: table values, transcript drawer, audio scrubbing (Range), action-item toggle persists
   - Relaunch → data persisted; `%APPDATA%/AIRA/data` holds db + recordings + log
   - Uninstall/reinstall → fresh DB (documented behavior)

### Task 4.3: Docs
- Rewrite `README.md`: desktop-first quickstart (installer + dev mode), architecture diagram (Electron ↔ standalone Next ↔ SQLite), where data lives, how telephony config works, web-dev mode retained.
- Create/update `PROGRESS.md` at repo root: phase checklist with dates and verification evidence (matches user's cross-session tracking convention).

**Commit:** `docs: desktop architecture readme + progress log`

---

## Files Likely to Change (summary)

| Area | Files |
|---|---|
| Infra | `package.json`, `next.config.ts`, `.env.example`, `electron/*` (new), `electron-builder.yml` (new) |
| Data | `prisma/schema.prisma`, `prisma/migrations/0001_baseline_sqlite/*` (new), `src/lib/db.ts`, `src/lib/dbjson.ts` (new), `src/lib/mappers.ts`, `src/lib/events/log.ts`, `src/lib/calls/state.ts`, `src/lib/calls/recording-store.ts`, results route |
| New APIs | `/api/health`, `/api/calls/[callId]/transcript`, `/api/investigations/[id]/calls`, `/api/investigations/[id]/cancel`, `/api/investigations/[id]/retry/[callId]`, `PATCH /api/action-items/[id]` |
| Engine | `src/lib/calls/orchestrator.ts` (extract `runSingleCall`), `src/lib/calls/control.ts` (new) |
| UI | `src/app/page.tsx`, `live/page.tsx`, `results/page.tsx`, `layout.tsx`, `globals.css`, new `components/{state,intake,results,settings,hooks}` |
| Docs | `README.md`, `PROGRESS.md` |

## Risks & Tradeoffs

| Risk | Mitigation |
|---|---|
| `better-sqlite3` native module vs Electron ABI | electron-builder rebuilds deps + `asarUnpack`; fallback: swap to `@prisma/adapter-libsql` (N-API, no rebuild) — isolated to `db.ts` adapter factory |
| Standalone + Turbopack packaging quirks | Task 2.4 smoke gate early; `server.log` captures boot failures |
| Windows file-URL edge cases (`file:C:/…`) | Verified explicitly in Task 1.2/1.3 smokes before proceeding |
| Unsigned installer → SmartScreen warning | Documented in README; signing cert deferred (open question) |
| Recording availability still requires GCS for *new* calls (egress uploads cloud-side) | Honest UI states; disk cache improves replay; local WAV provider covers demos/seeds |
| Cancel races with in-flight orchestrator promises | Best-effort semantics documented: DB flipped + hangup issued; runner fails fast on empty transcript; retry path exists |
| Scope creep toward mobile | Explicitly dropped: fixed desktop window is the target; overflow hygiene only |

## Open Questions

1. **Brand:** settle on "AIRA" everywhere (folder) vs keep "Zeppy"? Plan assumes AIRA.
2. Code-signing certificate for the installer now or later?
3. Should the tray icon + "minimize to tray" behavior be included in v1 (common desktop expectation)?
4. Keep web-dev mode documented publicly, or internal-only?

---

*Estimated effort: Phases 0–2 ≈ one focused session; Phase 3 ≈ one to two sessions; Phase 4 ≈ half a session.*
