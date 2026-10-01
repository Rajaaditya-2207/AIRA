---
name: desktop-packaging-optimization
category: devops
trigger: Use when packaging a Next.js + Electron desktop app and the installer size grows unexpectedly or exceeds expectations.
description: >
  Reduce Electron/NSIS installer payload by stripping non-runtime artifacts from Next.js
  standalone output and excluding production node_modules from the asar. Techniques apply
  to any Next + Electron build where the traced .next/standalone folder accumulates repo junk
  across builds, and where electron-builder silently packages production node_modules into the
  asar (~650MB dead weight) despite the server resolving deps from resources/next-app/node_modules.
--->

# Desktop Packaging & Size Optimization

**When:** Building a Next.js + Electron desktop app with `next build` + `electron-builder`.

**Why:** Next's output tracer copies the **entire repo root** into `.next/standalone`, including previous build outputs (`dist-desktop/`, `build/`, old installers). Each subsequent build nests the previous one, causing installer size to grow exponentially (1GB → 5GB+). Additionally, electron-builder silently packages all production `node_modules` into the asar (~650MB dead weight) even though the server resolves deps from `resources/next-app/node_modules`.

## 1. Staging cleanup (`scripts/prepare-desktop.cjs`)

After copying `.next/standalone` → `build/next-app`, strip non-runtime directories the tracer unnecessarily carried from the repo root:

```bash
# Directories to strip (kept only from the repo root copy, not runtime):
- dist-desktop       # previous installer outputs
- dist-electron      # electron main sources (ships via asar)
- build              # this staging folder itself
- electron           # electron entry points
- prisma             # migrations dir (baseline sql copied separately)
- scripts            # build/packaging scripts
- src                # app sources
- .hermes            # plans/notes
- .next/cache        # build caches
```

Also strip loose root files that aren't runtime deps, keeping only:
- `package.json`, `package-lock.json` (Next reads them)
- `server.js` (the standalone entry point)

Then copy browser static assets, public files, and the baseline SQL migration for first-run bootstrap.

## 2. asar junk control (`electron-builder.yml`)

**Fix:** Exclude production `node_modules` from the `files` list and rely on `extraResources` (verbatim copy via `scripts/prepare-desktop.cjs`) for the traced tree:

```yaml
files:
  - dist-electron/**
  - package.json
  - "!**/node_modules/**"   # ← keep node_modules OUT of asar
  - "!**/dist-desktop/**"
  - "!**/build/**"
  - "!**/.next/**"
  - "!**/src/**"
  - "!**/scripts/**"
  - "!**/electron/**"
  - "!**/prisma/**"

extraResources:
  - from: build/next-app
    to: next-app
# electron-builder ships this folder verbatim, avoiding all its node_modules
# rewriting (which breaks the traced tree).
```

**Result:** asar stays ~43KB (only Electron entry); node_modules live in `resources/next-app/node_modules` on the unpacked app, resolved at runtime.

## 3. QA override (visual verification)

Added `?theme=light|dark` URL param to the theme pre-paint script in `layout.tsx`, enabling light-theme screenshots against the dev server (previously the app always rendered in the OS dark theme, making light-theme QA impossible).

## 4. Typical size impact

| Metric | Before fix | After fix |
|--------|-----------|-----------|
| `.next/standalone` size | 1GB+ (with recursive nesting) | 54MB (clean, stripped) |
| asar contents | ~430MB (includes dead node_modules) | ~43KB (Electron entry only) |
| NSIS installer | 1GB+ | 236MB |
| Unpacked app size | ~9.9GB (exploded 10x) | ~60MB (clean) |

## Pitfalls section

- **Never run `prepare-desktop.cjs` twice** on the same `.next/standalone` — the strip logic assumes a single pass; re-running may delete directories the second copy still needs.
- If you swap the `better-sqlite3` ABI (`scripts/swap-native.cjs`), re-run `prepare-desktop.cjs` afterward; the tracer sometimes re-introduces old build artifacts after a swap.
- The `?theme=light` URL override only works on the dev server (`next dev`). The packaged app uses the OS theme preference stored in `localStorage`; the URL param has no effect in the exe.

## Recommended workflow

1. `AIRA_PACKAGE=1 next build` (first run may take ~2min)
2. `node scripts/prepare-desktop.cjs` (verifies `.next/standalone` is clean)
3. `npm run desktop:build` (electron-builder; washes any remaining staging junk)
4. Validate unpacked size: `du -sh dist-desktop/win-unpacked/resources/next-app` should be 40–60MB
5. Launch and verify: `./AIRA-Setup-0.1.0.exe /S && "$LOCALAPPDATA/Programs/AIRA/AIRA.exe"` should start in <10s

## Support files

- `scripts/prepare-desktop.cjs` — full staging cleanup script
- `electron-builder.yml` — builder config with `!**/node_modules/**` exclusion
- `scripts/swap-native.cjs` — electron ABI swap (better-sqlite3)
- `prisma/migrations/0001_baseline_sqlite/migration.sql` — first-run DB bootstrap