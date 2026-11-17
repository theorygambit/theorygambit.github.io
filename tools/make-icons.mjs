// Regenerates public/favicon.svg and public/icons/*.png from one SVG mark. Needs `sharp`:
//   npm i -D sharp && node tools/make-icons.mjs
import sharp from "sharp";
import { writeFileSync, mkdirSync } from "node:fs";

const arc = (r, a0, a1, w, o) => {
  const p = (a) => [(256 + r * Math.cos(a)).toFixed(2), (256 + r * Math.sin(a)).toFixed(2)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `<path d="M${x0} ${y0}A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${x1} ${y1}" fill="none" stroke="#e6e3da" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="butt"/>`;
};
const mark = (k) => {
  const radii = [30, 62, 98, 138, 180];
  const rings = radii.map((r, i) => {
    const a0 = 0.5 + i * 0.7;
    return arc(r * k, a0, a0 + Math.PI * 2 - 0.6, Math.max(3, 7 * k), (0.95 - (i / 4) * 0.5).toFixed(2));
  });
  return rings.join("") + `<circle cx="256" cy="256" r="${(8 * k).toFixed(1)}" fill="#e6e3da"/>`;
};
const svg = (k, bg = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg ? '<rect width="512" height="512" fill="#08090b"/>' : ""}${mark(k)}</svg>`;

mkdirSync("public/icons", { recursive: true });
writeFileSync("public/favicon.svg", svg(1.15));
const jobs = [
  ["apple-touch-icon.png", 180, 1.15],
  ["icon-192.png", 192, 1.15],
  ["icon-512.png", 512, 1.15],
  ["icon-maskable-512.png", 512, 0.85],
];
for (const [name, size, k] of jobs) await sharp(Buffer.from(svg(k))).resize(size, size).png().toFile(`public/icons/${name}`);
console.log("icons written");
