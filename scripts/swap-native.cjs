#!/usr/bin/env node
/**
 * Swaps the better-sqlite3 native binding between runtimes:
 *
 *   node scripts/swap-native.cjs electron   -> binding for Electron's ABI (packaging)
 *   node scripts/swap-native.cjs node       -> binding for system Node (dev/seed)
 *
 * Uses prebuild-install (downloads official prebuilds, no compiler needed).
 * Handles both the top-level copy and the one nested under the Prisma adapter.
 */
const { execSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const mode = process.argv[2];
if (mode !== "electron" && mode !== "node") {
  console.error("Usage: node scripts/swap-native.cjs <electron|node>");
  process.exit(1);
}

const repoRoot = path.resolve(__dirname, "..");
const root = repoRoot;
const electronVersion = require(path.join(repoRoot, "node_modules", "electron", "package.json")).version;
const nodeVersion = process.versions.node;

const targets =
  mode === "electron"
    ? [{ runtime: "electron", tag: electronVersion }]
    : [{ runtime: "node", tag: nodeVersion }];

const moduleDirs = [
  path.join(repoRoot, "node_modules", "better-sqlite3"),
  path.join(repoRoot, "node_modules", "@prisma", "adapter-better-sqlite3", "node_modules", "better-sqlite3"),
  // The staged standalone tree that ships inside the installer:
  path.join(root, "build", "next-app", "node_modules", "better-sqlite3"),
].filter((dir) => fs.existsSync(dir));

let failed = false;
for (const dir of moduleDirs) {
  const { version } = require(path.join(dir, "package.json"));
  for (const target of targets) {
    console.log(`[swap-native] ${path.relative(repoRoot, dir)} v${version} -> ${target.runtime}@${target.tag}`);
    try {
      execSync(`npx --yes prebuild-install -r ${target.runtime} -t ${target.tag} --verbose`, {
        cwd: dir,
        stdio: "inherit",
      });
    } catch (error) {
      console.error(`[swap-native] FAILED for ${dir} (${target.runtime}@${target.tag})`);
      console.error(error.message);
      failed = true;
    }
  }
}

if (failed) {
  console.error(
    "[swap-native] One or more prebuilds could not be fetched. " +
      "Check network access to github.com/WiseLibs/better-sqlite3/releases.",
  );
  process.exit(1);
}
console.log("[swap-native] done");
