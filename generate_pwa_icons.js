import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ICONS_DIR = path.join(__dirname, 'assets', 'icons');
if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

// Generate high quality SVG icons
const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="512" height="512" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#1e1b4b"/>
      <stop offset="60%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#020617"/>
    </radialGradient>
    <radialGradient id="goldGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#fef08a"/>
      <stop offset="40%" stop-color="#f59e0b"/>
      <stop offset="100%" stop-color="#b45309"/>
    </radialGradient>
    <radialGradient id="cyanGrad" cx="35%" cy="35%" r="65%">
      <stop offset="0%" stop-color="#e0f2fe"/>
      <stop offset="50%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#0284c7"/>
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="16" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- Background Rounded Rect -->
  <rect width="512" height="512" rx="112" fill="url(#bgGrad)"/>
  <rect width="512" height="512" rx="112" stroke="#38bdf8" stroke-width="8" stroke-opacity="0.3"/>

  <!-- Outer Energy Glow Ring -->
  <circle cx="256" cy="256" r="180" stroke="#38bdf8" stroke-width="6" stroke-dasharray="24 16" stroke-opacity="0.6" filter="url(#glow)"/>

  <!-- Main Golden Coin Body -->
  <circle cx="256" cy="256" r="148" fill="url(#goldGrad)" stroke="#fef08a" stroke-width="10"/>
  <circle cx="256" cy="256" r="132" fill="none" stroke="#78350f" stroke-width="4" stroke-opacity="0.4"/>

  <!-- Soccer Ball Center Circle -->
  <circle cx="256" cy="256" r="88" fill="#ffffff" stroke="#1e293b" stroke-width="6"/>

  <!-- Pentagon Pattern in Center -->
  <polygon points="256,204 296,233 281,280 231,280 216,233" fill="#0f172a"/>

  <!-- Seam Lines extending from pentagon -->
  <line x1="256" y1="204" x2="256" y2="170" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>
  <line x1="296" y1="233" x2="330" y2="218" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>
  <line x1="281" y1="280" x2="310" y2="315" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>
  <line x1="231" y1="280" x2="202" y2="315" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>
  <line x1="216" y1="233" x2="182" y2="218" stroke="#0f172a" stroke-width="6" stroke-linecap="round"/>

  <!-- Dynamic Lightning Bolt Symbol (Top Right) -->
  <path d="M370 120 L335 190 L365 190 L320 260 L345 205 L315 205 Z" fill="#facc15" stroke="#ca8a04" stroke-width="3" filter="url(#glow)"/>

  <!-- Stylized Star Badges -->
  <circle cx="160" cy="150" r="12" fill="#ef4444"/>
  <circle cx="352" cy="362" r="12" fill="#3b82f6"/>
</svg>
`;

fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.svg'), svgContent);
fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.svg'), svgContent);
fs.writeFileSync(path.join(ICONS_DIR, 'icon-maskable.svg'), svgContent);
fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.svg'), svgContent);
fs.writeFileSync(path.join(ICONS_DIR, 'favicon.svg'), svgContent);

// Helper function to create uncompressed/deflated raw PNG image with pure Node.js
function createPng(width, height, drawFn) {
  const bytesPerPixel = 4;
  const scanlineLength = width * bytesPerPixel + 1;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const lineOffset = y * scanlineLength;
    rawData[lineOffset] = 0; // Filter byte: None

    for (let x = 0; x < width; x++) {
      const pxOffset = lineOffset + 1 + x * bytesPerPixel;
      const [r, g, b, a] = drawFn(x, y, width, height);
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    return Buffer.concat([len, body, crc]);
  }

  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c ^= buf[i];
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  // PNG Header
  const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA color type
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

// Draw crisp BolaBola Coin Icon for PNG
function drawGameIcon(x, y, w, h) {
  const cx = w / 2;
  const cy = h / 2;
  const dist = Math.hypot(x - cx, y - cy);
  const maxR = w * 0.46;

  // Background rounded rect corners
  const cornerR = w * 0.22;
  const dx = Math.max(Math.abs(x - cx) - (w / 2 - cornerR), 0);
  const dy = Math.max(Math.abs(y - cy) - (h / 2 - cornerR), 0);
  const cornerDist = Math.hypot(dx, dy);
  if (cornerDist > cornerR) {
    return [0, 0, 0, 0]; // Transparent
  }

  // Background gradient: Dark Blue / Slate
  const bgGrad = y / h;
  let r = Math.round(15 + (30 - 15) * (1 - bgGrad));
  let g = Math.round(23 + (27 - 23) * (1 - bgGrad));
  let b = Math.round(42 + (75 - 42) * (1 - bgGrad));

  // Golden Coin Ring
  const coinR = w * 0.38;
  const coinInnerR = w * 0.24;

  if (dist <= coinR) {
    if (dist > coinInnerR) {
      // Golden Coin Gradient
      const angle = Math.atan2(y - cy, x - cx);
      const goldShade = 0.8 + 0.2 * Math.sin(angle * 2);
      r = Math.min(255, Math.round(245 * goldShade));
      g = Math.min(255, Math.round(158 * goldShade));
      b = Math.min(255, Math.round(11 * goldShade));
    } else {
      // Soccer Ball Inner Circle
      const ballGrad = Math.max(0, 1 - dist / coinInnerR * 0.5);
      r = Math.round(240 * ballGrad);
      g = Math.round(245 * ballGrad);
      b = Math.round(255 * ballGrad);

      // Center Pentagon
      const centerDist = dist / coinInnerR;
      if (centerDist < 0.45) {
        r = 15; g = 23; b = 42; // Deep dark navy
      }
    }
  }

  // Cyan Neon border ring
  if (Math.abs(dist - coinR - (w * 0.03)) < (w * 0.015)) {
    r = 56; g = 189; b = 248; // Cyan Accent
  }

  return [r, g, b, 255];
}

console.log('Generating PNG Icons...');
const png192 = createPng(192, 192, drawGameIcon);
fs.writeFileSync(path.join(ICONS_DIR, 'icon-192.png'), png192);

const png512 = createPng(512, 512, drawGameIcon);
fs.writeFileSync(path.join(ICONS_DIR, 'icon-512.png'), png512);

const pngApple = createPng(180, 180, drawGameIcon);
fs.writeFileSync(path.join(ICONS_DIR, 'apple-touch-icon.png'), pngApple);

const pngFavicon = createPng(64, 64, drawGameIcon);
fs.writeFileSync(path.join(ICONS_DIR, 'favicon.png'), pngFavicon);

console.log('PWA icons created successfully in assets/icons/');
