// Renders the promo banner by running the real hero simulation (src/ui/heroScene.ts) for a few seconds.
//   node tools/make-banner.mjs     writes public/banner.png (1672x941) and public/og.png (1200x630)
// Needs network for Google Fonts; OFFLINE=1 uses stand-in fonts. T=seconds to simulate (default 9).
import { readFileSync, mkdirSync } from "node:fs";
import ts from "typescript";
import { chromium } from "playwright";

const src = readFileSync(new URL("../src/ui/heroScene.ts", import.meta.url), "utf8");
const js = ts.transpileModule(src, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ES2015 } }).outputText.replace(/^export /gm, "");
const T = Number(process.env.T ?? 9);
const fonts = process.env.OFFLINE
  ? `@font-face{font-family:"Cormorant Garamond";font-style:italic;font-weight:300;src:local("Crimson Text Italic")}`
  : `@import url("https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@1,300&family=JetBrains+Mono:wght@400&display=swap");`;

const browser = await chromium.launch();
mkdirSync("public", { recursive: true });
for (const [file, W, H] of [["public/banner.png", 1672, 941], ["public/og.png", 1200, 630]]) {
  const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
  await page.setContent(`<style>${fonts}html,body{margin:0;background:#08090b}</style><canvas id="c" width="${W}" height="${H}"></canvas>`);
  await page.evaluate(js + ";window.__S = HeroScene;");
  await page.evaluate(async () => {
    await Promise.all(['italic 300 40px "Cormorant Garamond"', '400 12px "JetBrains Mono"'].map((f) => document.fonts.load(f).catch(() => [])));
  });
  await page.evaluate(([W, H, T]) => {
    const ctx = document.getElementById("c").getContext("2d");
    const s = new window.__S({ ink: [230, 227, 218], ground: "#08090b", opaque: true, caption: "001 / DOMINANT STRATEGY" });
    s.resize(W, H, 1);
    for (let i = 0; i < T * 60; i++) s.step(1 / 60);
    s.draw(ctx);
  }, [W, H, T]);
  await page.screenshot({ path: file });
  console.log("wrote", file);
}
await browser.close();
