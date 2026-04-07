#!/usr/bin/env node
// Generate iOS PWA apple-touch-startup-image splash screens.
// Usage: node scripts/gen-splash.js
// Requires: npm install (sharp must be available)

const sharp = require('sharp');
const path  = require('path');
const fs    = require('fs');

const ICON_SRC  = path.join(__dirname, '../icons/icon-1024.png');
const OUT_DIR   = path.join(__dirname, '../icons');
const ICON_SIZE = 300; // centered icon size in pixels

const SPLASHES = [
  { w:  750, h: 1334 }, // iPhone SE (2nd/3rd gen) / iPhone 8
  { w:  828, h: 1792 }, // iPhone XR / iPhone 11
  { w: 1080, h: 2340 }, // iPhone 12 mini / iPhone 13 mini
  { w: 1125, h: 2436 }, // iPhone X / XS / 11 Pro
  { w: 1170, h: 2532 }, // iPhone 12 / 12 Pro / 13 / 13 Pro / 14
  { w: 1179, h: 2556 }, // iPhone 14 Pro / 15 / 15 Pro
  { w: 1242, h: 2688 }, // iPhone XS Max / 11 Pro Max
  { w: 1284, h: 2778 }, // iPhone 12 Pro Max / 13 Pro Max / 14 Plus
  { w: 1290, h: 2796 }, // iPhone 14 Pro Max / 15 Plus / 15 Pro Max
];

async function main() {
  if (!fs.existsSync(ICON_SRC)) {
    console.error(`Source icon not found: ${ICON_SRC}`);
    process.exit(1);
  }

  // Pre-resize the icon once
  const icon = await sharp(ICON_SRC)
    .resize(ICON_SIZE, ICON_SIZE)
    .toBuffer();

  for (const { w, h } of SPLASHES) {
    const outFile = path.join(OUT_DIR, `splash-${w}x${h}.png`);
    await sharp({
      create: {
        width:      w,
        height:     h,
        channels:   4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
    .composite([{
      input: icon,
      left:  Math.round((w - ICON_SIZE) / 2),
      top:   Math.round((h - ICON_SIZE) / 2),
    }])
    .png({ compressionLevel: 9 })
    .toFile(outFile);
    console.log(`  ✓ ${path.basename(outFile)}`);
  }

  console.log(`\nGenerated ${SPLASHES.length} splash screens in ${OUT_DIR}`);
}

main().catch(err => { console.error(err); process.exit(1); });
