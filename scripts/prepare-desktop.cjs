#!/usr/bin/env node
/**
 * Assembles build/next-app — a self-contained folder the packaged app serves:
 *   .next/standalone/**   (server.js + traced node_modules)
 *   + .next/static        (browser assets)
 *   + public/             (static files)
 *   + prisma-baseline.sql (first-run DB bootstrap)
 *
 * electron-builder ships this folder verbatim via extraResources, avoiding
 * all of its node_modules rewriting (which breaks the traced tree).
 *
 * IMPORTANT: Next's output tracing copies the whole repo root into
 * .next/standalone (including previous build outputs like dist-desktop/ and
 * build/). Shipping those verbatim makes each installer nest the previous
 * one inside itself (resources/next-app/dist-desktop/...). So after copying,
 * we strip everything that isn't needed to RUN the server.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const dest = path.join(root, "build", "next-app");

const standaloneDir = path.join(root, ".next", "standalone");
if (!fs.existsSync(path.join(standaloneDir, "server.js"))) {
  console.error("Missing .next/standalone/server.js — run `AIRA_PACKAGE=1 next build` first.");
  process.exit(1);
}

fs.rmSync(dest, { recursive: true, force: true });
fs.mkdirSync(dest, { recursive: true });

// 1. Standalone server + traced node_modules.
fs.cpSync(standaloneDir, dest, { recursive: true });

// 2. Strip non-runtime directories the tracer copied from the repo root.
//    These are build inputs/outputs — shipping them bloats the installer and
//    causes recursive nesting across builds.
const STRIP = [
  "dist-desktop",   // previous installer outputs
  "dist-electron",  // electron entry (ships via asar, not the server)
  "build",          // this staging folder itself + icons
  "electron",       // electron main sources
  "prisma",         // migrations dir (baseline sql is copied separately)
  "scripts",        // build/packaging scripts
  "src",            // app sources
  ".hermes",        // plans/notes
  ".next/cache",    // build caches
];
for (const entry of STRIP) {
  fs.rmSync(path.join(dest, entry), { recursive: true, force: true });
}

// Loose root files that aren't runtime deps. Keep: package manifests (Next
// reads them) + server.js (the standalone entry point).
for (const entry of fs.readdirSync(dest, { withFileTypes: true })) {
  if (entry.isFile() && !/^(package\.json|package-lock\.json|server\.js)$/.test(entry.name)) {
    fs.rmSync(path.join(dest, entry.name), { force: true });
  }
}

// 3. Browser static assets (standalone omits them).
fs.cpSync(
  path.join(root, ".next", "static"),
  path.join(dest, ".next", "static"),
  { recursive: true },
);

// 4. Public assets.
if (fs.existsSync(path.join(root, "public"))) {
  fs.cpSync(path.join(root, "public"), path.join(dest, "public"), { recursive: true });
}

// 5. Baseline SQL for first-run bootstrap.
fs.copyFileSync(
  path.join(root, "prisma", "migrations", "0001_baseline_sqlite", "migration.sql"),
  path.join(dest, "prisma-baseline.sql"),
);

console.log(`[prepare-desktop] ready: ${dest}`);
