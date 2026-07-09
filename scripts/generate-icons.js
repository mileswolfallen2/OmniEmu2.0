#!/usr/bin/env node
/**
 * Generates minimal placeholder icons for all platforms.
 * Creates a simple app icon: purple gradient on transparent.
 * Outputs: assets/icon.png (1024x1024)
 * Uses pure Node.js — no dependencies.
 */

const { writeFileSync, mkdirSync } = require('fs');
const { join } = require('path');
const { createCanvas } = (() => {
  // Minimal PNG encoder — no canvas library needed
  class Canvas {
    constructor(w, h) { this.w = w; this.h = h; this.pixels = Buffer.alloc(w * h * 4, 0); }
    fillRect(x, y, w, h, r, g, b, a) {
      for (let py = y; py < y + h; py++) {
        for (let px = x; px < x + w; px++) {
          const i = (py * this.w + px) * 4;
          this.pixels[i] = r; this.pixels[i+1] = g; this.pixels[i+2] = b; this.pixels[i+3] = a;
        }
      }
    }
    fillCircle(cx, cy, rad, r, g, b, a) {
      for (let py = cy - rad; py <= cy + rad; py++) {
        for (let px = cx - rad; px <= cx + rad; px++) {
          if ((px-cx)**2 + (py-cy)**2 <= rad*rad) {
            const i = (py * this.w + px) * 4;
            if (i >= 0 && i < this.pixels.length) {
              this.pixels[i] = r; this.pixels[i+1] = g; this.pixels[i+2] = b; this.pixels[i+3] = a;
            }
          }
        }
      }
    }
    toPNG() {
      const { w, h, pixels } = this;
      const data = [];
      // PNG signature
      data.push(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
      // IHDR chunk
      const ihdr = Buffer.alloc(13);
      ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
      ihdr[8] = 8; // bit depth
      ihdr[9] = 6; // color type RGBA
      data.push(this._chunk('IHDR', ihdr));
      // IDAT chunk (raw pixel data with filter bytes)
      const raw = Buffer.alloc(h * (1 + w * 4));
      for (let y = 0; y < h; y++) {
        raw[y * (1 + w * 4)] = 0; // no filter
        pixels.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
      }
      const zlib = require('zlib');
      const compressed = zlib.deflateSync(raw);
      data.push(this._chunk('IDAT', compressed));
      // IEND chunk
      data.push(this._chunk('IEND', Buffer.alloc(0)));
      return Buffer.concat(data);
    }
    _chunk(type, buf) {
      const len = Buffer.alloc(4); len.writeUInt32BE(buf.length);
      const typeB = Buffer.from(type, 'ascii');
      const crcData = Buffer.concat([typeB, buf]);
      const crc = require('zlib').crc32(crcData);
      const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc >>> 0);
      return Buffer.concat([len, typeB, buf, crcB]);
    }
  }
  return { createCanvas: (w, h) => new Canvas(w, h) };
})();

const SIZE = 1024;
const canvas = createCanvas(SIZE, SIZE);
const c = SIZE / 2;
const r = SIZE * 0.42;

// Background circle
canvas.fillCircle(c, c, r, 108, 99, 255, 255);
// Inner circle (slightly darker)
canvas.fillCircle(c, c, r * 0.7, 90, 80, 220, 255);
// Letter "O" representation — two circles to make a ring
canvas.fillCircle(c, c, r * 0.5, 108, 99, 255, 255);
canvas.fillCircle(c, c, r * 0.3, 90, 80, 220, 255);

const outDir = join(__dirname, '..', 'assets');
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, 'icon.png'), canvas.toPNG());
console.log('Generated assets/icon.png');
