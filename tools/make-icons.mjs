// Regenerates public/favicon.svg and public/icons/*.png from one SVG mark, "The Approach":
// a downward triangle inside opened rings. Bone on Void. No sparks, no threads. Needs `sharp`:  npm i -D sharp && node tools/make-icons.mjs
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";

const C = 256;
const BONE = "#e6e3da";
const pol = (r, a) => [C + r * Math.cos(a), C + r * Math.sin(a)];
const f = (n) => n.toFixed(2);

const mark = (k) => {
  const parts = [];
  // rings, their gaps drifting a little round
  [[100, 0.5], [140, 0.42], [182, 0.36]].forEach(([r, gap], i) => {
    const gc = 2.5 + i * 0.35;
    const [x0, y0] = pol(r * k, gc + gap / 2);
    const [x1, y1] = pol(r * k, gc - gap / 2);
    parts.push(`<path d="M${f(x0)} ${f(y0)}A${f(r * k)} ${f(r * k)} 0 1 1 ${f(x1)} ${f(y1)}" fill="none" stroke="${BONE}" stroke-opacity="${(0.85 - i * 0.22).toFixed(2)}" stroke-width="${(5 - i * 0.6) * k}" stroke-linecap="round"/>`);
  });
  // the triangle, pointing down, with a whisper of light from above
  const Rt = 66 * k;
  const v = [0, 1, 2].map((j) => pol(Rt, Math.PI / 2 + (j * 2 * Math.PI) / 3));
  const tri = v.map((p) => `${f(p[0])} ${f(p[1])}`).join("L");
  parts.push(`<path d="M${tri}Z" fill="url(#fill)" stroke="${BONE}" stroke-width="${5.5 * k}" stroke-linejoin="round"/>`);
  const inner = v.map((p) => `${f(C + (p[0] - C) * 0.55)} ${f(C + (p[1] - C) * 0.55)}`).join("L");
  parts.push(`<path d="M${inner}Z" fill="none" stroke="${BONE}" stroke-opacity="0.4" stroke-width="${3.5 * k}" stroke-linejoin="round"/>`);
  return parts.join("");
};

const defs = `<defs>
  <radialGradient id="bg" cx="50%" cy="-6%" r="95%"><stop offset="0" stop-color="#1b1d21"/><stop offset="0.6" stop-color="#0c0d10"/><stop offset="1" stop-color="#08090b"/></radialGradient>
  <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${BONE}" stop-opacity="0.16"/><stop offset="1" stop-color="${BONE}" stop-opacity="0.01"/></linearGradient>
  <linearGradient id="thread" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${BONE}" stop-opacity="0"/><stop offset="0.5" stop-color="${BONE}" stop-opacity="0.55"/><stop offset="1" stop-color="${BONE}" stop-opacity="1"/></linearGradient>
  <radialGradient id="glow"><stop offset="0" stop-color="${BONE}" stop-opacity="0.6"/><stop offset="1" stop-color="${BONE}" stop-opacity="0"/></radialGradient>
</defs>`;
export const svg = (k, bg = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${defs}${bg ? '<rect width="512" height="512" fill="url(#bg)"/>' : ""}${mark(k)}</svg>`;

if (process.argv[1]?.endsWith("make-icons.mjs")) {
  mkdirSync("public/icons", { recursive: true });
  writeFileSync("public/favicon.svg", svg(1.08));
  const jobs = [
    ["apple-touch-icon.png", 180, 1.08],
    ["icons/apple-touch-icon.png", 180, 1.08],
    ["apple-touch-icon-precomposed.png", 180, 1.08],
    ["icons/icon-192.png", 192, 1.08],
    ["icons/icon-512.png", 512, 1.08],
    ["icons/icon-maskable-512.png", 512, 0.8],
  ];
  for (const [name, size, k] of jobs) await sharp(Buffer.from(svg(k)), { density: 300 }).resize(size, size).png().toFile(`public/${name}`);
  console.log("icons written");
}
