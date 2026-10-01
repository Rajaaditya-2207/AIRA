#!/usr/bin/env node
/**
 * Renders build/icon.svg into every raster size AIRA needs:
 *   build/icons/{16,32,48,64,128,256,512}.png
 *   build/icon.ico            (Windows app icon, multi-size)
 *   public/icon.svg           (web favicon, verbatim copy)
 *
 * Uses sharp (already in the dependency tree via Next) — no extra installs.
 * Run: node scripts/generate-icons.mjs
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = path.resolve(import.meta.dirname, "..");
const svgPath = path.join(root, "build", "icon.svg");
const iconsDir = path.join(root, "build", "icons");
const sizes = [16, 32, 48, 64, 128, 256, 512];

const { default: sharp } = await import("sharp").catch(() => {
  console.error("[icons] sharp is unavailable — `npm i -D sharp` and retry.");
  process.exit(1);
});

const svg = fs.readFileSync(svgPath);
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of sizes) {
  const out = path.join(iconsDir, `${size}.png`);
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(out);
  console.log(`[icons] ${size}.png`);
}

// 512 is the electron-builder "icon.png" convention.
fs.copyFileSync(path.join(iconsDir, "512.png"), path.join(root, "build", "icon.png"));

// Web favicon.
fs.copyFileSync(svgPath, path.join(root, "public", "icon.svg"));

console.log("[icons] build/icon.png + public/icon.svg written");
