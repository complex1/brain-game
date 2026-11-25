#!/usr/bin/env node
/*
 * Generates the PWA icons (PNG) into assets/icons/ with no dependencies.
 * Run from the project root:  node scripts/generate-icons.js
 *
 * The mark is a 2x2 grid of rounded tiles (three cyan, one violet) on the
 * app background colour, kept inside the central safe zone so the same
 * artwork works as both a regular and a maskable icon.
 */
"use strict";

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");

const OUT_DIR = path.join(__dirname, "..", "assets", "icons");
const BG = [0x0a, 0x0c, 0x11];
const ACCENT = [0x35, 0xd6, 0xe8];
const SECONDARY = [0x8f, 0x7d, 0xff];

// Layout in a unit square (0..1). Tiles sit within the central ~58%.
const TILE = 0.25;
const GAP = 0.06;
const RADIUS = 0.055;
const START = (1 - (TILE * 2 + GAP)) / 2;
const TILES = [
  { x: START, y: START, color: ACCENT },
  { x: START + TILE + GAP, y: START, color: ACCENT },
  { x: START, y: START + TILE + GAP, color: ACCENT },
  { x: START + TILE + GAP, y: START + TILE + GAP, color: SECONDARY },
];

function insideRoundedRect(px, py, t) {
  const cx = Math.min(Math.max(px, t.x + RADIUS), t.x + TILE - RADIUS);
  const cy = Math.min(Math.max(py, t.y + RADIUS), t.y + TILE - RADIUS);
  const dx = px - cx;
  const dy = py - cy;
  return px >= t.x && px <= t.x + TILE && py >= t.y && py <= t.y + TILE && dx * dx + dy * dy <= RADIUS * RADIUS;
}

function colorAt(px, py) {
  for (const t of TILES) if (insideRoundedRect(px, py, t)) return t.color;
  return BG;
}

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let n = 0; n < buf.length; n++) {
    c = (crc ^ buf[n]) & 0xff;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function renderPng(size) {
  const SS = 3; // supersampling per axis for smooth edges
  const raw = Buffer.alloc((size * 3 + 1) * size);
  let o = 0;
  for (let y = 0; y < size; y++) {
    raw[o++] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const c = colorAt((x + (sx + 0.5) / SS) / size, (y + (sy + 0.5) / SS) / size);
          r += c[0];
          g += c[1];
          b += c[2];
        }
      }
      const n = SS * SS;
      raw[o++] = Math.round(r / n);
      raw[o++] = Math.round(g / n);
      raw[o++] = Math.round(b / n);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

function svg() {
  const hex = (c) => "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
  const u = (v) => +(v * 512).toFixed(2);
  const tiles = TILES.map(
    (t) =>
      `  <rect x="${u(t.x)}" y="${u(t.y)}" width="${u(TILE)}" height="${u(TILE)}" rx="${u(RADIUS)}" fill="${hex(t.color)}"/>`
  ).join("\n");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">\n  <rect width="512" height="512" fill="${hex(BG)}"/>\n${tiles}\n</svg>\n`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const [name, size] of [
  ["icon-192.png", 192],
  ["icon-512.png", 512],
  ["apple-touch-icon.png", 180],
]) {
  fs.writeFileSync(path.join(OUT_DIR, name), renderPng(size));
  console.log("wrote assets/icons/" + name);
}
fs.writeFileSync(path.join(OUT_DIR, "icon.svg"), svg());
console.log("wrote assets/icons/icon.svg");
