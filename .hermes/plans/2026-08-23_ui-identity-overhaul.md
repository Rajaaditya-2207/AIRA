# AIRA UI Identity Overhaul — Design & Implementation Plan

> **For Hermes:** Use subagent-driven-development to implement task-by-task. Load `frontend-design` (design direction), `shadcn-ui-modernization` + `web-design-guidelines` (component quality gates), `ux-copy` (all interface copy), `code-review` after each phase.

**Goal:** Transform AIRA from "clean shadcn prototype" into a product with its own unmistakable identity — a designed logo/icon replacing the default Electron one, a signature visual language across every screen, and micro-interactions that make the desktop app feel native-grade — while keeping both run modes (desktop primary, web fallback) fully working and untouched functionally.

**Architecture:** No backend changes. Pure presentation-layer work: design tokens → brand assets → shell (navbar/layout) → per-screen redesign → icon pipeline → verification. All existing components keep their props/behavior; this is reskinning + composition + motion on top of the Phase-3 foundation.

**Tech Stack:** Tailwind v4 tokens · shadcn/ui primitives · lucide-react icons only (zero emojis) · CSS keyframes + tailwindcss-animate · SVG-first logo authored as code · `@electron/rebuild`-free packaging unchanged · electron-builder `icon` config for win/mac/linux assets

---

## Current Context

- Working tree clean at `161c650`; 21/21 tests; tsc/eslint clean; packaged installer verified working
- Theme: "Signal Indigo" (`--primary #4f46e5`, cyan `#06b6d4` gradient accents), dark mode shipped with pre-paint script
- Screens: Home (intake+editable preview), Live Ops (stream badge/timers/cancel/retry), Results (comparison table/drawers/audio), History list, Settings dialog — all functional but visually stock-shadcn
- Brand asset situation: **none** — Electron default icon on taskbar/window/installer; navbar is a plain dot + gradient text
- Known prototype tells: identical card chrome everywhere, no type hierarchy personality, static screens (no motion life), empty states are plain text, table-heavy results lacks data-viz warmth
- Fonts currently Geist Sans/Mono (fine base, unassertive)

## Assumptions

1. Logo direction below can be revised before implementation if user dislikes it — one revision cycle budgeted.
2. No new npm deps required beyond `electron-icon-builder`-class dev tooling for the icon pipeline (or hand-authored multi-size PNGs via sharp).
3. Motion respects `prefers-reduced-motion` everywhere (quality floor).
4. Web mode must remain pixel-consistent with desktop (same codebase, same UI).

---

## Design Direction (the plan IS the design)

### Concept — "The Signal Room"

AIRA makes phone calls — invisible conversations happening somewhere out there — and turns them into evidence you can see. The identity borrows from **air-traffic control / radio operations rooms**: dark radar surfaces, signal traces, live transmission indicators, monospaced telemetry labels. Every screen answers one question: *"what is the airwaves telling us right now?"*

This is NOT: generic SaaS dashboard, cream-serif editorial, or acid-green-on-black hacker default. It's an operations-room aesthetic softened for daily use — calm graphite surfaces, indigo signal color, warm amber for human voices.

### Color tokens (extends current Signal Indigo — evolution, not revolution)

| Token | Light | Dark | Role |
|---|---|---|---|
| `--background` | `#F7F7F9` cool paper | `#0B0C10` deep space | Canvas |
| `--surface` | `#FFFFFF` | `#14161D` | Cards/panels |
| `--surface-2` | `#EDEEF2` | `#1B1E27` | Nested panels, table headers |
| `--line` | `#E3E4EA` | `#262A35` | Hairline borders |
| `--ink` | `#101218` | `#E8EAF0` | Primary text |
| `--ink-dim` | `#5B6070` | `#8B90A0` | Secondary text |
| `--signal` | `#4F46E5` indigo | `#6E68FF` | AIRA's voice, actions, agent bubbles |
| `--signal-hot` | `#06B6D4` cyan | `#22D3EE` | Live/active states, gradients |
| `--voice` | `#B45309` amber-700 | `#F5B84C` warm amber | Contact/human speech bubbles ← NEW |
| `--ok` | `#0E8A5F` | `#34D399` | Completed/verified |
| `--warn` | `#B45309` | `#FBBF24` | Reconnecting/attention |
| `--bad` | `#DC2626` | `#F87171` | Failed/cancelled |

**Key move:** agent speech stays signal-indigo, but **human contact speech becomes warm amber** — in transcripts and audio waveforms you'll *see* who was talking by temperature alone. This is the accessibility win too (color ≠ decoration, it encodes speaker).

### Typography — three voices

| Role | Face | Usage |
|---|---|---|
| Display | **Sora** (geometric, techy-humanist) | Page titles, big numbers, empty-state headlines — used sparingly, tight tracking |
| Body/UI | **Geist Sans** (already loaded) | Everything interactive |
| Telemetry | **Geist Mono** (already loaded) | Timestamps, durations, scores, phone numbers, status codes, section eyebrows |

Signature type move: **every operational datum gets mono** — `00:42`, `₹13,000`, `+91 98••• ••111`, `86/100`. Numbers stop being body text and become instrument readouts. Eyebrow labels (`LIVE TRANSMISSION`, `DECISION BRIEF`) in mono caps with wide tracking become wayfinding.

### Layout system

- **12-col max-w-[1200px]** content well, generous 32px gutters
- Cards lose their uniform look: **panel hierarchy via surface levels** (surface vs surface-2 vs transparent wells) instead of border-everything
- Hairlines (`--line`) replace most solid borders; radius ladder: 8px controls, 12px cards, 16px hero panels, full for pills
- Home becomes asymmetric: intake form 7 cols, preview 5 cols, connected by a subtle vertical signal line (the "wire" that carries your brief to the calls)
- Results table rows expand into full-width evidence panels — drawer becomes inline expansion, feels like pulling a file from a rack

### The Signature — "Live Signal Strip" 📡

One memorable element carried through everything: a **thin animated waveform strip** that appears wherever a call is live:

- In the navbar: tiny 3-bar equalizer next to the AIRA mark when any investigation is running (app-level pulse — you always know AIRA is on the phone even from another tab)
- On Live Ops page header: full-width strip under the title, bars animating with call activity
- Inside agent voice bubbles while streaming: mini waveform before text settles
- On the app icon itself: the waveform motif (below)

Implementation: pure CSS `@keyframes` on 3–5 rounded bars, `animation-delay` staggered, `prefers-reduced-motion` → static bars. Zero JS cost.

### App Icon / Logo — "The Airwave A"

SVG concept, authored as code:

```
Rounded-square tile (squircle-ish, 22% radius):
  Dark graphite field (#14161D) with subtle diagonal sheen
  Center: stylized "A" formed by THREE ascending signal bars
    - Bar heights: short / tall / medium (like a waveform frozen mid-call)
    - Bars in gradient: indigo #4F46E5 → cyan #06B6D4 (bottom-to-top)
    - Third bar carries a small dot above it (the "live" ping)
  Reads as: letter A + equalizer + antenna tower, all at once
```

Why it works: it's the Live Signal Strip motif compressed into a glyph; legible at 16px favicon and 512px installer art; not a generic chat bubble or robot head.

Assets generated: `icon.svg` master → 256/128/64/48/32/16 PNGs → `.ico` (win) → 512px PNG (installer sidebar) → macOS `.icns` if ever needed. Pipeline: author `build/icon.svg`, convert via sharp script (`scripts/generate-icons.mjs`), wire `electron-builder.yml` (`icon: build/icon.png`) + `layout.tsx` metadata icons + web manifest favicon set.

### Motion vocabulary (restrained)

| Moment | Motion |
|---|---|
| Page enter | 120ms fade-rise of main content blocks, 40ms stagger (once) |
| Status change | Badge crossfade + single bar-blink on signal strip |
| Transcript line arrival | Slide-in from speaker side (agent right, contact left), 160ms |
| Drawer expansion | Height ease-out 200ms, chevron rotates |
| Score bar fill | Width animates on mount, 400ms ease-out |
| Hover | Border brightens to signal/40 + 1px lift on interactive cards |
| Reduced motion | All of the above become instant/static |

### Copy voice (per ux-copy skill)

Operational-calm, sentence case, verb-first CTAs: "Launch investigation", "Retry this call", "Cancel run". Empty states invite action: *"No investigations yet. Your first brief is one paste away."* Errors state fact + fix, never apologize. Mono eyebrows label zones, not decorate: `BRIEF`, `CONTACTS`, `TRANSMISSION`, `VERDICT`.

---

## Anti-generic critique (required pass)

- ❌ Default answer would be: gradient hero text + 3 feature cards + green badges. **Changed:** operations-room concept, amber-vs-indigo speaker temperature, mono telemetry layer, waveform signature.
- ❌ Generic icon would be: robot head or chat bubble. **Changed:** waveform-A glyph.
- ❌ Template motion: fade-in-everything. **Changed:** motion only where signal changes (arrivals, status flips), nothing decorative.
- Numbered markers: used ONLY where sequence is real (retry attempts `ATTEMPT 2/3`, priority ranks) — nowhere decorative.

---

## Implementation Plan

### Task 1: Token migration + typography load

**Files:** Modify `src/app/globals.css`, `src/app/layout.tsx`

- Add Sora via `next/font/google` (`variable: --font-display`, weights 500/600/700)
- Replace palette block with token table above; map into existing `--primary/--secondary/...` shadcn vars so ALL existing components inherit (no component rewrites needed)
- Add `--font-display` utility class `.font-display`; add `.text-eyebrow` (mono, 11px, tracking .12em, uppercase, ink-dim)
- Keep dark-mode pre-paint script intact

**Verify:** `npx tsc --noEmit` 0 errors; eyeball home page — colors shifted, nothing broken.

### Task 2: Icon pipeline + brand assets

**Files:** Create `build/icon.svg`, `scripts/generate-icons.mjs`; Modify `electron-builder.yml` (+`icon: build/icon.png`), `src/app/layout.tsx` (metadata.icons), delete default `public/*.svg` Next artifacts

- Author the Airwave-A SVG per spec above
- Script renders PNGs (sharp, already in dep tree via Next) into `build/icons/{16,32,48,64,128,256,512}.png` + `build/icon.ico`
- Wire favicon set + apple-touch + Windows shortcut icon

**Verify:** open `build/icons/256.png` — legible glyph; rebuild installer later shows new exe icon (task 7).

### Task 3: Shell redesign — navbar + layout frame

**Files:** Modify `src/components/app/app-navbar.tsx`, create `src/components/brand/aira-mark.tsx`, `src/components/brand/signal-strip.tsx`, modify `src/app/globals.css`

- Navbar: height 56px, surface w/ bottom hairline, AIRA mark (mini icon SVG) + wordmark in Sora semibold, nav pills get active underline indicator (2px signal bar) instead of bg pill, theme/settings icons right-aligned with tooltips
- `SignalStrip`: 5-bar CSS equalizer, `data-active` prop; navbar subscribes to a lightweight `/api/investigations?status=running` check (reuse existing events infra — poll every 30s, cheap)
- Content frame: swap `min-h-screen bg-background` wrapper to layered background (radial signal glow top-center at 4% opacity, mono eyebrow breadcrumb zone optional)
- **Fluid full-bleed (user req. B):** all page shells drop `max-w-6xl mx-auto` → `w-full` + `padding-inline: clamp(16px, 4vw, 64px)`; grids use fr units; `min-h-dvh` frames so fullscreen has zero dead gutters
- **Hidden scrollbars (user req. A):** global CSS — `* { scrollbar-width: none } *::-webkit-scrollbar { display:none }` scoped to app root (not `html` overlays needed since Electron); scrollability unaffected; Settings dialog scroll area included

**Verify:** screenshot light+dark; reduced-motion strips are static.

### Task 4: Home — Briefing console redesign

**Files:** Modify `src/app/page.tsx`, restyle `contact-row.tsx`, `question-hints-editor.tsx`, create `src/components/intake/brief-wire.tsx`

- Hero collapses: headline in Sora 28px, subcopy 1 line, feature pills removed (prototype clutter) — replaced by 3 mono stats under headline showing real counts once seeded (`CALLS MADE`, `LANGUAGES`, `AVG DURATION` — static "—" pre-data acceptable)
- Intake card: eyebrow `BRIEF`, textarea gets focus-ring glow + char counter (mono) bottom-right; example loader becomes ghost chip row
- Preview panel: header `REVIEW & LAUNCH` eyebrow + signal-line connector animating on parse success (the "wire"); contact rows compact to single-line grid with mono phone numbers; launch button full-width shimmer kept but recolored signal gradient
- Voice Agent Name moves into a collapsible "Advanced" row (defaults `assistant`) — removes the only required-field friction from main flow

**Verify:** parse→edit→launch happy path unaffected; mobile 1024px min-width still clean.

### Task 5: Live Ops — Transmission monitor

**Files:** Modify `live/page.tsx`, `progress-timeline.tsx`, `transcript-pane.tsx`, `elapsed-timer.tsx`

- Header: `LIVE TRANSMISSION` eyebrow + SignalStrip (active when streamState=live/stale) + status cluster right
- Table → **call cards list**: each call = horizontal card (avatar-initial disc colored by language, name+mono number, status pill w/ icon, mono elapsed timer, retry icon-button). Selected card gets signal left-border 2px
- Transcript bubbles: agent = signal-indigo filled, contact = amber-tinted surface, system = centered mono caption; arrival slide-in animation; auto-scroll keeps pinned bottom unless user scrolled up (add scroll-anchor logic fix)
- Recording player: custom slim control — mono duration readout + progress hairline (native `<audio>` hidden, custom buttons) OR keep native but styled container with `LISTEN BACK` eyebrow — choose native-styled for scope safety

**Verify:** seed data walkthrough; timers tick; cancel confirm dialog copy updated ("Cancel this investigation? In-flight calls hang up immediately…").

### Task 6: Results — Verdict board

**Files:** Modify `results/page.tsx`, `comparison-table.tsx`, `transcript-drawer.tsx`, `ranking-cards.tsx`(delete—superseded), `score-bar.tsx`

- Header: `DECISION BRIEF` eyebrow + requirement as display quote + confidence badge (avg score) in mono
- Comparison table → **ranked evidence panels**: rank #1 card elevated (signal border + crown), rows inside show mono price/availability columns; score rendered as mono readout + thin arc gauge (SVG circle, 270° sweep, signal gradient stroke) replacing linear bars — more instrument-like
- Transcript drawers become inline expanding sections INSIDE each panel (no separate stack below); audio player per panel with `PLAY RECORDING` mono button
- Action items: checkbox cards with priority as mono tag `[HIGH]`, done state strikes + dims; "Next Actions" → eyebrow `NEXT MOVES`

**Verify:** seeded DEMO1 renders all states; audio plays from packaged path too.

### Task 7: History + Settings + delete + dialogs polish

**Files:** Modify `investigations/page.tsx`, `settings-dialog.tsx`; Create `src/app/api/investigations/[id]/route.ts` (DELETE), `src/components/investigations/delete-investigation-button.tsx`; Test `route.test.ts` for DELETE

- History rows: status pill left-rail colored, requirement truncated w/ mono timestamp right; hover reveals arrow affordance; empty state uses display font invitation
- **Delete (user req. C):** trash icon on each History row (and on Results/Live headers for finished runs) → AlertDialog confirm → `DELETE /api/investigations/[id]` → optimistic row removal. Route deletes investigation (FK cascade handles calls/transcripts/findings/recommendations/actionItems/eventLogs) + best-effort removal of local recording files/metadata; 404 if missing; TDD both paths
- Settings dialog: **tabs** (AI / Calling / Recordings) + **Appearance section** with Display-font picker (Sora / Bricolage Grotesque / Inter / System — persisted to settings.json + localStorage, applied by swapping `--font-display` on `<html>`), sticky footer save-state machine ("Saved · Restarting engine…")
- Global dialog polish: consistent 16px radius, backdrop blur, focus trap verified; inner scroll areas get hidden scrollbars per req. A

**Verify:** settings save→restart flow works in packaged build; font picker swaps immediately; delete removes row + files + survives relaunch.

### Task 8: Cleanup + README dual-mode rewrite + vision merge (remembered items)

**Files:** Delete stray artifacts (unused `public/*.svg`, `components/results/ranking-cards.tsx`, any regenerated `tsconfig.tsbuildinfo`); Modify `README.md`; **keep `VISION.md` standalone** (per user decision 3), add cross-link from README

- **Cleanup sweep:** remove files with no build/runtime role; verify each removal against `next build` + `desktop:build` after
- **README rewrite (remembered items 2+3):** Hero (logo svg + one-liner) → **Two ways to run**: Desktop (primary, installer) / Web fallback (`npm run dev` — **explicitly no Docker, SQLite-only**, `db:migrate`+`db:seed`+`dev` steps) → Architecture diagram → Data & Settings safety → Scripts table → **Roadmap** section condensing VISION.md (pillars + horizons, link out to full doc) → License
- **VISION.md:** stays as-is standalone; README Roadmap links to it for the full version

**Verify:** links resolve; `npm run desktop:build` end-to-end still exits 0 with new icon; fresh install shows branded exe icon + splash; `npm run dev` works with zero Docker on a clean checkout.

### Task 9: Full verification gate

- Gates: tsc 0 · eslint clean (incl. no-emoji rule scan) · vitest 21+ (now includes DELETE route tests) · `next build` 0 · `desktop:build` 0
- Visual QA matrix: {home, live, results, history} × {light, dark} × {seeded, empty} screenshots reviewed (vision check each)
- **Resize sweep (user req. B):** drag window 1024→2560px wide; confirm content stretches edge-to-edge, no centered dead zones, no overflow at any width
- Accessibility floor: keyboard-only walkthrough of core loop; focus-visible rings on all interactives; contrast spot-check amber-on-dark ≥ 4.5:1 for text usage
- Reinstall packaged exe; verify icon in taskbar/explorer, splash, settings persistence (incl. font choice), demo playback, delete flow end-to-end

---

## Files Likely to Change

| Area | Files |
|---|---|
| Tokens/type | `globals.css`, `layout.tsx` |
| Brand | `build/icon.svg`, `scripts/generate-icons.mjs`, `components/brand/*` (new) |
| Shell | `app-navbar.tsx`, page frames |
| Screens | `page.tsx`, `live/page.tsx` + live components, `results/page.tsx` + results components, `investigations/page.tsx`, `settings-dialog.tsx` |
| Removals | `ranking-cards.tsx`, default Next svgs, `VISION.md` (merged) |
| Config | `electron-builder.yml`, `package.json` scripts |

## Risks & Tradeoffs

| Risk | Mitigation |
|---|---|
| Amber voice-color may clash in light mode | Amber-700 tuned for light (AA on white), amber-400 family for dark; validated in Task 9 matrix |
| Arc gauge SVG complexity | Fallback: keep ScoreBar linear if gauge overruns budget — isolated component swap |
| Custom audio player scope creep | Decision recorded: style native `<audio>` in styled container (Task 5 note) |
| Navbar running-check adds requests | 30s poll of indexed query; negligible; skipped entirely when SSE already open elsewhere |
| Icon generation tooling gaps on CI | Icons committed as files; script only needed when changing source SVG |
| Hidden scrollbars hurt discoverability of scrollable areas | Scrollability fully preserved; cards/panes get visible fade-out masks at scroll edges where content clips |
| Fluid layout breaks at extreme widths | `clamp()` gutters + fr grids tested 1024→2560 in Task 9 resize sweep; Electron min-width 1024 enforced |
| Delete removes recordings irreversibly | Confirm dialog names exactly what's removed; only investigation-scoped files touched |

## Decisions (confirmed by user)

1. **Logo:** proceed with "Airwave A" concept.
2. **Display font:** Sora default, **user-switchable in Settings** (Sora / Bricolage Grotesque / Inter / System) — persisted like theme, applied via CSS var swap.
3. **VISION.md:** merge content into README Roadmap **and keep VISION.md as standalone file** (no deletion).

## Additional requirements (user-added, same scope)

| # | Requirement | Approach |
|---|---|---|
| A | **Hide scrollbars** app-wide | Custom scroll styling: overlay-style invisible scrollbars (scrollability preserved, wheel/touch/keyboard intact). `scrollbar-width: none` + `::-webkit-scrollbar { display: none }` on app containers; visible focus/hover cues replace the scrollbar affordance. Settings dialog inner scroll too (visible in user's screenshot). |
| B | **Full-bleed fluid layout** — pages fill the window edge-to-edge, adapt to ANY size, no centered max-width gap when fullscreen | Remove `max-w-6xl` page shells → fluid grid using `clamp()` gutters (`padding-inline: clamp(16px, 4vw, 64px)`), `w-full` content, `min-h-dvh` frames; grids go `lg:grid-cols-*` with fr units so columns stretch; tables/cards flex-fill. Desktop min-width 1024 stays enforced by Electron; web keeps mobile stacking. |
| C | **Delete investigations** | `DELETE /api/investigations/[id]` (cascade delete via existing FK relations + wipe EventLog, recordings metadata/files best-effort); History rows get trash icon → confirm dialog ("Delete this investigation? Removes its calls, transcripts and recordings. Can't be undone."); also offered on Results/Live pages for finished runs. TDD: route test for 404 + happy path. |
| D | **Remembered items folded in** (from earlier session directive) | Task 8 already covers: (1) project cleanup of unwanted files, (2) web app kept as documented fallback **without Docker** (SQLite-only flow), (3) README improved for dual-mode, (4) vision merged into README + VISION.md kept standalone. |


