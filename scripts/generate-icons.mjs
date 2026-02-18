import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple SVG template for the icon
const generateSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#000000"/>
  <text x="50%" y="50%" font-family="Arial, sans-serif" font-size="${size * 0.4}" fill="#E6B36A" text-anchor="middle" dy=".3em" font-weight="bold">ELIX</text>
</svg>
`;

console.log("Generating placeholder icons...");

const publicDir = path.join(__dirname, '../public');

const icon192 = generateSvg(192);
const icon512 = generateSvg(512);

fs.writeFileSync(path.join(publicDir, 'pwa-192x192.svg'), icon192);
fs.writeFileSync(path.join(publicDir, 'pwa-512x512.svg'), icon512);
fs.writeFileSync(path.join(publicDir, 'apple-touch-icon.svg'), icon192);

console.log("Icons generated in public/ folder.");
