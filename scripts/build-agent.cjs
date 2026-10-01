/**
 * Bundles the LiveKit voice-agent worker for the packaged desktop app.
 *
 * Why: the worker (`src/agent/telephony-agent.ts`) is NOT part of the Next.js
 * server bundle — it runs as a standalone process on the LiveKit worker
 * runtime and depends on `@livekit/agents`, which Next's tracer never copies
 * into `build/next-app/node_modules`. Without this step the packaged app
 * dispatches to an unregistered agent: the phone rings, nobody answers, and
 * every call fails after the session timeout.
 *
 * Output: build/agent/telephony-agent.cjs (+ a marker file listing the files
 * electron/main.ts must copy next to it).
 *
 * Run via `npm run build:agent` (wired into `desktop:build`).
 */
const esbuild = require("esbuild");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "build", "agent");
const OUT_FILE = path.join(OUT_DIR, "telephony-agent.cjs");

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Native addons (.node) cannot be inlined. Copy each one into
  // build/agent/node_modules/<pkg>/ so the bundle's `require` can find it at
  // runtime, and record the path in the manifest for packaging.
  const nativeCopies = copyNativeAddons();
  const binaries = copyRuntimeBinaries();
  // Packages that ship a platform-specific native runtime which esbuild cannot
  // inline (sharp's @img/* prebuilds). They must exist on disk at runtime.
  const runtimePackages = stagePlatformPackages();

  const result = await esbuild.build({
    entryPoints: [path.join(ROOT, "src", "agent", "telephony-agent.ts")],
    outfile: OUT_FILE,
    bundle: true,
    platform: "node",
    target: "node20",
    format: "cjs",
    sourcemap: false,
    minify: false,
    // Native addons are handled by the `.node` copy loader + staging below.
    // Everything else must be INLINED: the packaged agent directory has no
    // node_modules, so leaving a require() external produces
    // "Cannot find module 'sharp'" at launch.
    external: [],
    define: {
      "import.meta.url": "__aira_agent_file_url__",
    },
    banner: {
      js: "const __aira_agent_file_url__ = require('node:url').pathToFileURL(__filename).href;",
    },
    logLevel: "info",
    metafile: true,
    loader: { ".node": "copy" },
  });

  // Record which real files must sit next to the bundle so electron/main.ts
  // can stage them (native .node binaries can't be inlined by esbuild).
  const externalRequires = collectExternalRequires(result.metafile, ROOT);
  fs.writeFileSync(
    path.join(OUT_DIR, "manifest.json"),
    JSON.stringify({ externalRequires, nativeCopies, binaries, runtimePackages }, null, 2),
    "utf8",
  );

  const bytes = fs.statSync(OUT_FILE).size;
  console.log(
    `[build-agent] wrote ${path.relative(ROOT, OUT_FILE)} (${(bytes / 1024 / 1024).toFixed(1)} MB)`,
  );
  console.log(`[build-agent] external requires: ${externalRequires.length}`);
  console.log(`[build-agent] native addons staged: ${nativeCopies.length}`);
  console.log(`[build-agent] runtime binaries staged: ${binaries.length}`);
  console.log(`[build-agent] platform packages staged: ${runtimePackages.length}`);
}

/**
 * Copy platform-native packages (sharp's `@img/*` prebuilds) verbatim so the
 * bundled worker can load them at runtime. Without these the bundle throws
 * "Could not load the 'sharp' module using the win32-x64 runtime".
 */
function stagePlatformPackages() {
  const copied = [];
  const rootModules = path.join(ROOT, "node_modules");
  // Only what the worker actually loads at runtime:
  //  - sharp + its @img/* prebuild (image/audio transform)
  //  - lightningcss + @next/* native binaries IF a module references them
  // @next/* and @tailwindcss/* are NOT needed — they are Next.js build-time
  // packages that added ~250MB to the installer for nothing.
  const targets = ["@img", "sharp", "lightningcss-win32-x64-msvc", "@unrs"];

  for (const target of targets) {
    const src = path.join(rootModules, target);
    if (!fs.existsSync(src)) continue;
    const dest = path.join(OUT_DIR, "node_modules", target);
    fs.cpSync(src, dest, {
      recursive: true,
      filter: (from) => {
        // Skip other platforms' binaries, source maps and docs to save size.
        const name = path.basename(from);
        if (/\.(map|md)$/i.test(name)) return false;
        if (/-(darwin|linux|arm|sunos|freebsd)(-|_)/i.test(name)) return false;
        if (/-(android|ios)-/i.test(name)) return false;
        return true;
      },
    });
    copied.push(target);
  }
  return copied;
}

/**
 * Copy executables the agent needs at runtime — chiefly the ffmpeg binary
 * that @livekit/agents shells out to for STT audio. Without it the worker
 * throws "Could not find ffmpeg executable" before it ever joins a room.
 */
function copyRuntimeBinaries() {
  const copied = [];
  const rootModules = path.join(ROOT, "node_modules");
  const wanted = /^(@ffmpeg-installer|ffmpeg-static)/;

  const walk = (dir, depth) => {
    if (depth > 4 || !fs.existsSync(dir)) return;
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full, depth + 1);
        continue;
      }
      if (!/\.exe$/i.test(entry.name)) continue;
      // Only ship ffmpeg, not every stray executable in the tree.
      if (!/ffmpeg/i.test(entry.name)) continue;
      const rel = path.relative(rootModules, full);
      const dest = path.join(OUT_DIR, "node_modules", rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(full, dest);
      copied.push(rel.split(path.sep).join("/"));
    }
  };
  // Only descend into the known ffmpeg provider packages.
  for (const entry of fs.existsSync(rootModules) ? fs.readdirSync(rootModules) : []) {
    if (entry.startsWith("@")) {
      const scopeDir = path.join(rootModules, entry);
      if (!fs.existsSync(scopeDir)) continue;
      for (const scoped of fs.readdirSync(scopeDir)) {
        if (wanted.test(`${entry}/${scoped}`)) {
          stagePackage(path.join(scopeDir, scoped), rootModules, copied);
        }
      }
      continue;
    }
    if (wanted.test(entry)) stagePackage(path.join(rootModules, entry), rootModules, copied);
  }
  return copied;
}

/**
 * Copy a provider package verbatim. The ffmpeg installer resolves itself by
 * path at runtime and reads its own package.json, so it cannot be inlined by
 * esbuild — ship the package files instead.
 */
function stagePackage(pkgDir, rootModules, copied) {
  const rel = path.relative(rootModules, pkgDir);
  const dest = path.join(OUT_DIR, "node_modules", rel);
  fs.mkdirSync(dest, { recursive: true });
  for (const name of fs.readdirSync(pkgDir)) {
    const src = path.join(pkgDir, name);
    if (fs.statSync(src).isDirectory()) continue;
    if (!/\.(exe|json)$/i.test(name)) continue;
    // @ffmpeg-installer ships every platform (62MB total). Only the host one
    // is ever executed.
    if (/\.exe$/i.test(name) && !/win32/i.test(rel) && !/ffmpeg-static/i.test(rel)) {
      continue;
    }
    fs.copyFileSync(src, path.join(dest, name));
  }
  copied.push(rel.split(path.sep).join("/"));
}

/**
 * Copy `*.node` native bindings into the output dir.
 *
 * Scoped to the LiveKit/SQLite family on purpose: an unrestricted walk of
 * node_modules dragged in @next (~123MB of SWC binaries), @rollup and
 * @tailwindcss, none of which the voice agent loads.
 */
function copyNativeAddons() {
  const copied = [];
  const rootModules = path.join(ROOT, "node_modules");
  if (!fs.existsSync(rootModules)) return copied;

  const stack = [];
  for (const pkg of NATIVE_PACKAGES) {
    const direct = path.join(rootModules, pkg);
    if (fs.existsSync(direct)) stack.push(direct);
    const scoped = path.join(rootModules, "@livekit", pkg);
    if (fs.existsSync(scoped)) stack.push(scoped);
  }
  while (stack.length > 0) {
    const dir = stack.pop();
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === ".bin") continue;
        stack.push(full);
        continue;
      }
      if (!entry.name.endsWith(".node")) continue;
      const rel = path.relative(rootModules, full);
      const dest = path.join(OUT_DIR, "node_modules", rel);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(full, dest);
      copied.push(rel.split(path.sep).join("/"));
    }
  }
  return copied;
}

/** Packages whose native bindings the bundled worker resolves at runtime. */
const NATIVE_PACKAGES = [
  "better-sqlite3",
  "bufferutil",
  "utf-8-validate",
  "ws",
  "isolated-vm",
  "cpu-features",
  "msgpackr-extract",
  "sharp",
];

/** Runtime `require(...)` targets esbuild could not inline (marked external). */
function collectExternalRequires(metafile, root) {
  const found = new Set();
  const inputs = Object.keys(metafile?.inputs ?? {});
  const isExternal = (spec) =>
    !path.isAbsolute(spec) &&
    !spec.startsWith(".") &&
    !spec.startsWith("@/") &&
    spec !== "node:url" &&
    spec !== "node:fs" &&
    spec !== "node:path" &&
    spec !== "node:os" &&
    spec !== "node:crypto" &&
    spec !== "node:worker_threads" &&
    !spec.startsWith("dotenv");
  for (const input of inputs) {
    if (isExternal(input)) found.add(input);
  }
  // `dotenv/config` is inlined by esbuild but harmless to keep external-safe.
  void root;
  return [...found].sort();
}

main().catch((error) => {
  console.error("[build-agent] failed:", error);
  process.exit(1);
});