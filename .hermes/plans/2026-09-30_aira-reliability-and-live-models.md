# AIRA — Reliability Fixes + Live Model Discovery

**Date:** 2026-09-30
**Status:** approved, executing
**Scope:** 6 phases. Fix broken mechanisms first, then live models, then rebuild/reinstall.

## Why this plan exists

Full-codebase analysis found:

1. **The packaged desktop app cannot place a working phone call.** `electron-builder.yml` ships only
   `dist-electron` + `build/next-app`; `src/agent/telephony-agent.ts` is excluded by `"!**/src/**"` and
   nothing spawns it (`dev:agent` runs only under `dev:all`). In production, LiveKit dispatches to an
   unregistered agent → the phone rings, nobody answers → 3 retries × session timeout → call failed.
   Secondary defect: the worker reads `process.env`, but the desktop injects keys from `settings.json`
   into the **child server's** env, so the worker would have no keys even if spawned.
2. **Cancel doesn't cancel.** `control.ts` writes `FAILED`; `orchestrator.ts` contains **zero**
   references to cancel and finishes with unconditional `status: "COMPLETED"` → AIRA keeps dialing real
   numbers, then overwrites the user's cancel.
3. **Retry never finalizes.** `runSingleCall` never rejects → `.catch` unreachable → investigation sticks
   `RUNNING` forever and retried findings are never re-ranked.
4. **History page renders "undefined calls"** — API returns Prisma `_count.calls`, UI reads `callCount`.
5. **Recordings route is unsafe** — `path.resolve(location)` with no containment (arbitrary file read);
   `http(s)://` locations are fetched and streamed back (unrestricted SSRF); bucket taken from the
   metadata file rather than config.
6. **SSE heartbeat can crash the server** — heartbeat interval lacks the `active` guard that `poll()` has,
   so a tick can `enqueue()` on a closed controller → uncaught `TypeError`.
7. **The gates are red.** `tsc` = 6 errors, `eslint` = 1 error — all inside three *untracked* directories
   created 2026-09-26: `src/lib/ai/`, `src/lib/config/`, `src/app/api/ai/`. This is a half-built
   "fetch models live" feature plus a settings registry. It reaches into SDK internals
   (`client.interactions._client`), which is why it doesn't compile.
8. **`vitest.config.ts` has no `exclude`** → the 48/14 test counts are inflated by `.next/standalone`
   duplicates. Real: 24 tests / 7 files.

## Key discovery driving the model work

`@google/genai@1.41.0` **does** expose the public API:

```ts
ai.models.list(): Promise<Pager<types.Model>>   // verified in node_modules/@google/genai/dist/genai.d.ts
```

The orphaned `src/lib/ai/client.ts` instead pokes `client.interactions._client.fetch` for `baseURL` /
`apiVersion`, which don't exist on that type. So the fix is a **clean rewrite against the public SDK**,
not a salvage of the internals hack.

Design decisions:
- **The API key must not travel in a query string** (`?apiKey=`) — it lands in access logs, `Referer`
  and history. Read it from server-side settings instead.
- **Per-key cache**, not one module-level cache shared across keys (current code leaks key A's model
  list to a request bearing key B).

---

## Phase 1 — Restore green gates (unblock everything else)

- `src/lib/config/schema.ts`: fix `validateSetting` generic return type (TS2322 at :110)
- `src/lib/config/keys.ts`: remove the duplicate local `SettingKey` (TS2440 at :1); fix the
  readonly-tuple → mutable-array assignments (TS4104 at :300)
- `src/lib/config/index.ts`: resolve the ambiguous `SettingKey` re-export (TS2308 at :10)
- `src/lib/ai/client.ts`: rewrite `fetchAllModels` onto public `ai.models.list()`; drop `AiClientOptions`
  (TS2339 ×2, lint error) or type it properly
- **Gate:** `npx tsc --noEmit` → 0 errors; `npx eslint .` → 0 errors

## Phase 2 — Honest test counts + safety net

- `vitest.config.ts`: add `exclude: ['**/node_modules/**', '**/.next/**', '**/dist*/**', '**/build/**']`
- Add tests for the new model client + config registry
- **Gate:** vitest reports the true count; all tests pass

## Phase 3 — Live model discovery, wired to Settings

- `src/app/api/ai/models/route.ts`: **remove the `?apiKey=` query param**; read `GEMINI_API_KEY` from
  server-side settings/env. Add `GET` cache headers + a manual `refresh` toggle that stays safe.
- `src/lib/ai/client.ts`: per-key cache keyed by a hash of the key; keep the 5-min TTL and stale-cache
  fallback (already good), but stop cross-key leakage.
- `settings-dialog.tsx`: replace the hardcoded model arrays with a fetch on dialog open (plus a manual
  **Refresh** button); render returned models in the existing Radix `Select`; keep **Custom…** so an
  unlisted model is always enterable; show a clear error + keep the previously-saved value if the fetch
  fails; disable the trigger until at least one model loads.
- **Gate:** dropdowns populate from the live API; saved custom values survive; failure degrades to
  current behaviour instead of an empty list.

## Phase 4 — Desktop can actually make a call (P0)

- Compile the agent worker for packaging (`electron/tsconfig.json` or a dedicated build step) and emit it
  into the packaged resources.
- `electron/main.ts`: spawn the worker alongside the Next server; kill it with the same lifecycle
  (`stopServer` / quit / engine restart).
- **Inject `settings.json` into the worker's env** (same allowlisted keys as the server child) — this is
  the reason the worker had no keys.
- `electron-builder.yml`: include the built worker in `extraResources`.
- **Gate:** fresh install launches; worker process present in the process list; log shows the agent
  registering; no "Ensure `npm run dev:agent` is running" dead-end.

## Phase 5 — Correctness of the run lifecycle

- `orchestrator.ts`: re-read investigation status before the final write; if cancelled/FAILED, leave it
  and stop dispatching further calls. Cancel now actually stops the run.
- Retry: after `runSingleCall` succeeds, **finalize the investigation and re-rank** via the same path
  `runInvestigation` uses, so results update and status settles.
- Remove the unreachable `.catch` or make it reachable.
- `investigations/route.ts`: return `callCount` (or have the UI read `_count.calls`) — pick one contract
  and test it.
- Delete `src/lib/calls/gemini-live.ts` (dead simulation code with a non-existent model id).

## Phase 6 — Security + resilience

- `recordings/[callId]/route.ts`: resolve and **assert containment** under the recordings root before
  reading; validate the stored location; **reject non-GCS http(s) URLs** (SSRF); fix suffix-range
  parsing (`bytes=-500` must mean *last* 500 bytes).
- `events/route.ts`: guard the heartbeat with `active`; clear the interval on close; avoid enqueueing
  after close.
- `/api/ai/models`: no key in the URL (Phase 3).

---

## Verification (run after every phase; nothing is called "done" without output)

1. `npx tsc --noEmit` → 0 errors
2. `npx eslint .` → 0 errors
3. `npx vitest run` → all pass, honest counts
4. `npm run desktop:build` → `BUILD_EXIT:0`
5. Reinstall + launch; assert: agent worker running, health 200, model dropdowns populated,
   cancel actually cancels, retry settles, History shows a real call count
6. `PROGRESS.md` updated + commit

## Out of scope (flagged, not fixed here)

- No auth/CSRF on routes; `next dev` binds 0.0.0.0 while placing billable calls — **user decision
  needed** (bind 127.0.0.1 in dev is the cheap mitigation)
- Duplicate `/results` polling while SSE exists
- No `React.memo` on the live-ops hot path
- `.env.example` still ships a Postgres/Docker URL for a SQLite-only app
- README references `build/icon.svg`, which is gitignored (404s on fresh clone)
- `GEMINI_TEMPERATURE_*` shown in Settings but never read by `env.ts` (dead settings)