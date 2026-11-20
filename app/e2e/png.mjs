// PNG pixels for the real-device harnesses (d5-button.mjs): 8-bit grey or colour, with or without alpha, not interlaced,
// which is what screencapture, .NET and ImageMagick write. The same reader as setup-0157.mjs's.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { inflateSync } from 'node:zlib';

export function readPng(f) {
  const b = readFileSync(f);
  let p = 8;
  let w = 0, h = 0, depth = 0, type = 0, lace = 0;
  const idat = [];
  while (p < b.length) {
    const len = b.readUInt32BE(p);
    const kind = b.toString('ascii', p + 4, p + 8);
    const data = b.subarray(p + 8, p + 8 + len);
    if (kind === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); depth = data[8]; type = data[9]; lace = data[12]; }
    else if (kind === 'IDAT') idat.push(data);
    else if (kind === 'IEND') break;
    p += 12 + len;
  }
  const bpp = { 0: 1, 2: 3, 4: 2, 6: 4 }[type];
  if (depth !== 8 || !bpp || lace) throw new Error(`PNG ${path.basename(f)}: depth ${depth} type ${type} interlace ${lace} not read`);
  const stride = w * bpp;
  const raw = inflateSync(Buffer.concat(idat));
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    const src = y * (stride + 1) + 1;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? px[y * stride + x - bpp] : 0;
      const up = y ? px[(y - 1) * stride + x] : 0;
      const c = x >= bpp && y ? px[(y - 1) * stride + x - bpp] : 0;
      let v = raw[src + x];
      if (filter === 1) v += a;
      else if (filter === 2) v += up;
      else if (filter === 3) v += (a + up) >> 1;
      else if (filter === 4) {
        const q = a + up - c;
        const pa = Math.abs(q - a), pb = Math.abs(q - up), pc = Math.abs(q - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? up : c;
      }
      px[y * stride + x] = v & 255;
    }
  }
  const grey = type === 0 || type === 4;
  return { w, h, rgb: (x, y) => { const i = y * stride + x * bpp; return grey ? [px[i], px[i], px[i]] : [px[i], px[i + 1], px[i + 2]]; } };
}

/** The largest per-channel difference between two RGB triples. */
export const rgbDiff = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
