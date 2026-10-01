# AIRA — Progress Log

Cross-session tracking. Newest first. Each entry: what changed + how it was verified.

## 2026-10-01 — Hardening: dev-server exposure, dead settings, stale docs ✅

Follow-up to the audit items left open after the reliability fix.

### LAN exposure (the one that mattered)
`next dev` bound **0.0.0.0** while `POST /api/investigations/[id]/start` places real billable calls and
`/transcript` + `/recordings` return phone numbers, transcripts and call audio — with **no auth**.
First attempt set `hostname` in `next.config.ts`; that was **ineffective** — Next 16 rejects the key
(`⚠ Unrecognized key(s) in object: 'hostname'`) and binds all interfaces regardless. Measured both ways:
with the config key, LAN probes still returned `true`. Reverted it and fixed the real mechanism —
`next dev -H 127.0.0.1` / `next start -H 127.0.0.1` in the npm scripts.

**Verified by socket probe:** loopback `true`; `169.254.44.134` and `192.168.0.102` now `false`
(was `true` before the fix). Desktop is unaffected — Electron already spawns the standalone server with
`HOSTNAME=127.0.0.1`.

### Settings that lied to the user
`GEMINI_TEMPERATURE_INTAKE` / `GEMINI_TEMPERATURE_REALTIME` were declared in the config schema and
rendered in the UI but read **nowhere** (`env.ts` grep = 0), and weren't in the Electron allowlist so
they'd have been stripped on desktop anyway. Now: parsed in `env.ts` (`readTemperature`, clamped 0–2),
consumed by the intake parser and the realtime session, surfaced in Settings → AI, allowlisted in
electron/main.ts. A test caught a real bug while wiring it — `Number("")` is `0`, so a blank field
silently pinned temperature to 0; empty/whitespace now falls back to the default.

### Docs / templates corrected
- `.env.example` shipped `postgresql://…@localhost:5432` + `docker compose up -d postgres` for a
  SQLite-only, Docker-free app → now `file:./prisma/dev.db`
- `RECORDING_PROVIDER="gcp"` in that same file **threw** on an empty bucket (`Missing required env var
  RECORDING_GCP_BUCKET`), breaking local-only recording for web-dev users → now empty by default
- Default GCS prefix was the pre-rebrand `zeppy/recordings` → `aira/recordings`
- README logo pointed at `build/icon.svg`, which is gitignored (404s on a fresh clone) → `public/icon.svg`

**Verified:** tsc 0 (src + electron) · eslint 0 errors · vitest 11 files / 63 tests · installer rebuilt
· LAN socket probe confirms the dev server is loopback-only.

---

## 2026-09-30 — Full-codebase audit → 6-phase reliability fix ✅

Plan: `.hermes/plans/2026-09-30_aira-reliability-and-live-models.md`
Context: 6 subagents mapped data layer / call pipeline / API / frontend / packaging / tests.

### P0 — the packaged app could not place a working call
`electron-builder.yml` shipped only `dist-electron` + `build/next-app`; `src/agent/telephony-agent.ts`
was excluded (`"!**/src/**"`) and nothing spawned it (`dev:agent` ran only under `dev:all`). Production
dispatched to an unregistered agent → phone rang, nobody answered → 3 retries × timeout. Compounding
it, the worker read `process.env` while the desktop injects keys from `settings.json` into the *server*
child only.

**Fix:** new `scripts/build-agent.cjs` bundles the worker with esbuild (9.8 MB) and stages native
`.node` addons; wired into `desktop:build` as `build:agent`; `electron/main.ts` gains
`spawnAgent()`/`stopAgent()` sharing the server's settings.json env, called on startup, engine restart
and quit; `extraResources` now ships `build/agent` → `agent`.

### Live model discovery (Settings → AI)
Orphaned half-built subsystem (untracked, 6 tsc errors) rewritten onto the **public SDK**
`ai.models.list()` instead of `client.interactions._client` internals. `/api/ai/models` no longer takes
`?apiKey=` (query strings leak into logs/Referer/history) — reads `GEMINI_API_KEY` server-side. Cache is
now **per-API-key** (was one shared module-level cache leaking key A's list to key B). Dialog fetches on
open with a Refresh button, falls back to the curated list on failure, keeps Custom… escape hatch.

### Lifecycle correctness
- **Cancel now cancels:** orchestrator re-reads status before finalizing instead of writing
  `COMPLETED` unconditionally (it previously kept dialing after cancel, then overwrote the cancel).
- **Retry now settles:** `finalizeInvestigation()` extracted and called after a retry — the old
  `.catch` was unreachable (`runSingleCall` never rejects), so investigations stuck in RUNNING and
  retried findings were never re-ranked.
- **History call count:** API now flattens `_count.calls` → `callCount` (UI read `callCount`, so every
  row rendered "undefined calls").
- Deleted dead simulation module `gemini-live.ts` (fake transcripts + non-existent model id).
- Retry returns 404 (not 409) for a missing investigation.

### Security / resilience
- Recordings route: **path containment** under the recordings root (was arbitrary local file read),
  **GCS-only host allow-list** for remote fetches (was unrestricted SSRF) + 64 MB body cap,
  correct suffix-range parsing (`bytes=-500` returned the *first* 501 bytes), directory guard.
- SSE: heartbeat and poll both guard `active` and catch enqueue-after-close (heartbeat could throw an
  uncaught TypeError inside `setInterval` → crash the server process).

### Also
- `vitest.config.ts` now excludes `.next/dist/build` — the 48/14 counts were inflated by compiled
  copies in `.next/standalone`; real baseline was 24.
- Added `CALL_SESSION_TIMEOUT_SECONDS` / `AIRA_LOG_LEVEL` metadata (keys existed with no UI entry).
- Gates: **tsc 0 · eslint 0 errors · vitest 10 files / 58 tests** (was 24 real / 6 broken subsystems).

---

## 2026-08-24 (later) — Model dropdowns + deterministic font highlight ✅

Follow-ups on the same report, shipped after the root-cause fix below:

- **Highlight bug**: active-font detection used 12-char substring probes; Bricolage's stack embeds Sora as its fallback → Sora always matched first and the wrong card lit up. Now identifies the applied stack by its unique leading `var(--font-*)` token (`use-display-font.ts`) — Bricolage highlights Bricolage.
- **Model dropdowns** (user request): Settings → AI — Intake model & Voice model are Radix selects of known-good Gemini ids (defaults from `env.ts` included), plus **Custom…** which unlocks free-text entry (with a "List" button to return). Saved values outside the list auto-open in custom mode.

**Verified:** tsc 0 · eslint 0 · vitest 48/48 · installer rebuilt (`BUILD_EXIT:0`, 15:23) · reinstalled + launched: health 200 · `__custom__` dropdown code present in installed chunks (`d285fbcada8c0fc4.js`)

---

## 2026-08-24 — Font system root-cause fix + Appearance Save & Apply ✅

**User report after uninstall/reinstall:** fonts don't change on screen; Appearance tab still shows "changes apply live" instead of a working button.

**Root cause (CSS variable scope):** font CSS vars (`--font-sora`, `--font-bricolage`, `--font-inter`) were attached to `<body>` by `next/font`, but the picker/pre-paint script writes `--aira-font-display` onto `<html>`, and `globals.css` resolves `.font-display` from `:root`. Custom properties inherit downward only → `<html>` couldn't see body-scoped vars → every picked stack resolved empty → silent Geist fallback.

**Fixes (commit `fix(ui): …`):**
- `layout.tsx`: font variables moved to `<html className=…>` (+ explanatory comment)
- `settings-dialog.tsx`: real **Save & Apply** on Appearance too ("Settings saved.", no engine restart); dialog load now restores the font from `settings.json` when localStorage was wiped
- `use-display-font.ts`: picking a font mirrors `AIRA_DISPLAY_FONT` into `settings.json` (survives reinstalls/data loss, not just browser profile)
- `electron/main.ts`: `AIRA_DISPLAY_FONT` added to settings allowlist; **writeSettings now merges** over existing values (single-key saves no longer wipe all other keys — latent data-loss bug found while wiring persistence)

**Verified:** tsc 0 · eslint 0 · vitest 48/48 · rebuilt installer (`BUILD_EXIT:0`, 125MB) · reinstalled · served HTML has all four font var classes on `<html>` · "changes apply live" gone from installed chunks · Save & Apply + AIRA_DISPLAY_FONT present in installed renderer + electron main · health `{ok:true}`, 5 processes

---

## 2026-08-24 — UI Identity Overhaul ("The Signal Room") ✅

**User-reported UI fixes (commit `0509ef4`):**
- Settings: **Appearance is now a real 4th tab** (was a fake label glued to the field sections)
- **Bricolage Grotesque / Inter now actually load** — added via `next/font` in layout, stacks point at CSS vars (previously referenced but never fetched → selection did nothing)
- Shimmer button: icon+text **inline on one line** (`inline-flex gap-2` wrapper); disabled state no longer `opacity-55` (that was the light-theme "fade") — uses saturate/brightness instead
- Headline: **"AIRA" is gradient**, "find out" and rest are solid ink (user request)
- Navbar: signal-strip moved **out of the logo link** (no more duplicate glyph after the AIRA wordmark)
- Added `?theme=light|dark` URL override for visual QA

**QA method note:** Playwright MCP isn't available in this environment — visual verification done via headless Chrome screenshots against the dev server + vision review (light+dark, home+results).

**Shipped (commits `d7c875a`→`f994f04`):**
- **Brand**: "Airwave A" logo authored as SVG → full icon pipeline (16–512px PNGs, .ico, favicon); taskbar/explorer/installer now branded
- **Tokens**: Signal Room palette (graphite surfaces, indigo signal, amber voice), Sora display font + mono telemetry eyebrows, hidden scrollbars app-wide, fluid `clamp()` gutters
- **Shell**: navbar with brand mark + live signal strip (polls running investigations), underline active indicators
- **Home**: briefing console — Sora headline, char counter, advanced row for agent name, "Launch Investigation"
- **Live Ops**: SignalWave header, call cards with language-colored initial discs + mono timers, amber(human)/indigo(agent) transcript bubbles with directional slide-in, smart scroll pinning, LISTEN BACK player
- **Results**: verdict board — ranked evidence panels (#1 crowned + elevated), SVG arc gauges, inline transcripts, PLAY RECORDING, confidence readout
- **History**: ledger rows with status rails, empty-state invitation, **delete investigations** (TDD route + confirm dialog + recording cleanup)
- **Settings**: tabbed (AI/Calling/Recordings) + Appearance tab with **display font picker** (Sora/Bricolage/Inter/System, persisted + instant swap)
- **Docs**: README rewritten dual-mode (desktop primary / web fallback no-Docker), roadmap section added, VISION.md kept standalone; dead svgs removed

**Verified:** tsc 0 · eslint 0 · vitest 24/24 · screenshots (home+results) reviewed · installer rebuilt with branded icon (1.0GB, includes full traced tree) · fresh install boots: DB bootstrap → server ready → health 200 → home 200

**Fixes during QA:** list endpoint accepts lowercase `status` param; POST restored after GET overwrite; cjs scripts lint-ignored; apostrophe escapes; ABI swap before/after packaging (node vs electron runtimes)

---

## 2026-08-23 — Desktop migration + UI overhaul (this session)

**Phase 0 — Safety net ✅**
- `git init`, baseline commit `b6cb2aa`
- Removed `@livekit/rtc-node-darwin-arm64` → `npm install` works on Windows (verified, no overrides)
- `.env.example` created; lazy Prisma init → bare `next build` passes without env (verified)

**Phase 1 — Local data layer ✅**
- Postgres/Docker → SQLite: schema swapped (enums→text unions, Json→JSON-text helpers), baseline generated via `prisma migrate diff`, applied & verified (8 tables)
- `dbjson.ts` TDD 4/4; dual adapter (`file:`→better-sqlite3, `postgresql://`→pg) in `src/lib/db.ts`
- **Docker removed**: `docker-compose.yml` deleted, `db:up/down` scripts removed
- Demo seed `npm run db:seed`: 3 contacts / 22 transcripts / 2 recommendations / 2 WAV recordings (verified)
- Local recording provider + HTTP Range (verified: valid WAV download, `206` on Range)
- New APIs live-verified against seed: `/api/health`, `/api/calls/[id]/transcript`, `/api/investigations/[id]/calls`
- Commits: `63de358`, `1c5f158`

**Phase 2 — Electron shell ✅**
- `electron/main.ts` (server spawn on free port, health poll, splash→app swap, first-run DB bootstrap, settings IPC, taskkill tree cleanup), `preload.ts` bridge, builder config
- Dev smoke passed: Electron window loaded AIRA UI over `next dev`
- ⚠️ Packaged installer build still pending final run — see "Next up"
- Commit: `a2fef21`

**Phase 3 — UI overhaul ✅**
- **Rebrand Zeppy→AIRA** everywhere incl. internals (`aira-*` rooms/headers/agent/log var/package name)
- **Signal Indigo palette** (#4f46e5→#06b6d4 gradient), status colors semantically separated (success/warning/info/danger tokens), working dark mode with pre-paint script + navbar toggle — screenshot-verified
- Humanized error states (`errors.ts` TDD 4/4) + `ErrorState`/`CardSkeleton`/`ScoreBar`
- **Editable intake preview**: fix names/digits/language, add/remove contacts, edit requirement + question chips, inline validation, "Load example brief", required-agent-name marked
- **Live Ops rebuilt**: Live/Reconnecting/Offline/Not-found stream badge (no more fake eternal "running"), mm:ss elapsed timers ticking while in-flight, status icons, Cancel run (confirm dialog), Retry per failed call; fake progress bars removed
- **Results = Decision Brief**: comparison table (score bars w/ semantic color, ₹ prices, availability, fit, crown on best, failed pinned bottom w/ reason), transcript drawers (lazy fetch, chat bubbles, mm:ss offsets from call start — `time.ts` TDD 3/3), inline audio players (Range-enabled), checkable action items w/ optimistic persistence, auto-refresh every 4s while running — screenshot-verified against seeded demo
- Settings dialog (gear icon): keys stored in `%APPDATA%/AIRA/settings.json`, Save & restart engine, reveal-data-folder
- Commits: `3257ace`, `2f6048e`, `fad8f01`, `fe2f342`

**Phase 4 — Docs ✅ / Packaging ⏳**
- README rewritten desktop-first (install, in-app settings, architecture, data locations)
- Gates at last full run: tsc 0 · eslint clean · vitest 21/21

### Next up
1. ~~Run `npm run desktop:build` → verify `dist-desktop/AIRA-Setup-*.exe`~~ ✅ 2026-08-23
2. ~~Install the exe, confirm first-run bootstrap + relaunch persistence~~ ✅ 2026-08-23 (verified: splash → engine ready → health OK, aira.db auto-created)
3. Optional: app icon asset, code-signing, tray behavior, DPAPI-encrypted settings (see VISION.md horizons)

### Packaging war notes (2026-08-23, resolved)
- `@livekit/rtc-node-darwin-arm64` broke Windows install → removed
- electron-rebuild needs Visual Studio → replaced by `scripts/swap-native.cjs` swapping better-sqlite3 to official Electron-ABI prebuilds (`npmRebuild: false`)
- better-sqlite3 pinned `12.11.1` — first version with `electron-v139` prebuilds
- electron-builder mangles Next's traced `node_modules` through asar/`files` globs → standalone shipped verbatim via `extraResources: build/next-app` (`scripts/prepare-desktop.cjs`)
- `bindings`/`file-uri-to-path` must resolve next to the unpacked native module → bootstrap + server now load from `next-app/node_modules`
- Standalone server requires its own dir as cwd → spawn sets `cwd`

---

## Historical context

### 2026-08-22 — Audit session (read-only)
- Full audit delivered in chat: architecture map, verification (tsc/tests/lint/build all pass after client gen), findings C1–C6/S1–S5/Q1–Q10
- UI inspection via screenshots: mobile overflow P0, read-only preview P0, dead-end errors P1, spectator Live Ops P1, results gaps P2
- Product vision captured to `VISION.md`; implementation plan saved to `.hermes/plans/2026-08-22_195500-aira-desktop-app-and-ui-overhaul.md`
