// Proves the iPhone home screen app contract with numbers, no screenshots.
//   npm run build && npm run preview     (in one terminal)
//   npm run verify:iphone                (in another; set BASE_URL to override)
// Set CHROME=/path/to/chrome to use a specific browser binary.
import { chromium } from "playwright";

const BASE = process.env.BASE_URL ?? "http://localhost:4173/";
const SCREEN_H = 844;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(ok);
  console.log(`${ok ? "pass" : "FAIL"}  ${name}${detail ? `  (${detail})` : ""}`);
};

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const ctx = await browser.newContext({
  viewport: { width: 390, height: 797 },
  screen: { width: 390, height: 844 },
  deviceScaleFactor: 3,
  hasTouch: true,
  isMobile: true,
});
await ctx.addInitScript(() => Object.defineProperty(navigator, "standalone", { get: () => true }));
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));

async function audit(label) {
  const m = await page.evaluate((H) => {
    const h = (el) => (el ? el.getBoundingClientRect().height : 0);
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.height > 0 && r.width > 0 && r.top < H && cs.visibility !== "hidden" && cs.display !== "none";
    };
    const controls = [...document.querySelectorAll("button, a[href], summary")].filter(visible);
    const lastEnd = controls.length ? Math.max(...controls.map((el) => Math.min(el.getBoundingClientRect().bottom, H))) : 0;

    const ownText = (el) => [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
    const hasText = (el) => (el.textContent || "").trim().length > 0;
    const infinite = document
      .getAnimations()
      .filter((a) => a.effect && a.effect.getComputedTiming().iterations === Infinity)
      .filter((a) => a.effect.target && hasText(a.effect.target))
      .map((a) => a.effect.target.tagName);
    const bad = [];
    for (const el of document.querySelectorAll("body *")) {
      if (!ownText(el)) continue;
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.willChange !== "auto" || cs.filter !== "none" || (cs.backdropFilter && cs.backdropFilter !== "none")) {
          bad.push(`${el.tagName}<${n.tagName}`);
          break;
        }
      }
    }
    const canvases = [...document.querySelectorAll("canvas[data-play]")].map((c) => {
      const r = c.getBoundingClientRect();
      const d = window.devicePixelRatio;
      return { rw: c.width / (r.width * d), rh: c.height / (r.height * d) };
    });
    return {
      inner: innerHeight,
      html: h(document.documentElement),
      body: h(document.body),
      root: h(document.getElementById("root")),
      bg: h(document.getElementById("bg-canvas")),
      appH: document.documentElement.style.getPropertyValue("--app-h"),
      lastEnd,
      infinite,
      bad,
      canvases,
    };
  }, SCREEN_H);

  console.log(`\n${label}: innerHeight ${m.inner}, --app-h ${m.appH || "unset"}`);
  check("html at least 844px tall", m.html >= SCREEN_H, String(m.html));
  check("body at least 844px tall", m.body >= SCREEN_H, String(m.body));
  check("#root at least 844px tall", m.root >= SCREEN_H, String(m.root));
  check("background canvas at least 844px tall", m.bg >= SCREEN_H, String(m.bg));
  check("last visible control ends within 110px of the bottom", SCREEN_H - m.lastEnd <= 110 && m.lastEnd <= SCREEN_H, `ends at ${Math.round(m.lastEnd)}`);
  check("no infinite animation on an element with text", m.infinite.length === 0, m.infinite.join(","));
  check("no text element has will-change, filter or backdrop-filter", m.bad.length === 0, m.bad.slice(0, 3).join(","));
  for (const c of m.canvases) check("gameplay canvas is 1:1 with device pixels", Math.abs(c.rw - 1) < 0.002 && Math.abs(c.rh - 1) < 0.002, `${c.rw.toFixed(4)} x ${c.rh.toFixed(4)}`);
  return m;
}

await page.goto(BASE);
await page.waitForTimeout(2500);
await audit("Home");

await page.evaluate(() => {
  history.pushState(null, "", "/g/dominant-strategy");
  dispatchEvent(new PopStateEvent("popstate"));
});
await page.waitForTimeout(2500);
const g = await audit("Game");
check("a gameplay canvas exists on the game screen", g.canvases.length === 1);

await page.goto(`${BASE}?debug=layout`);
await page.waitForTimeout(2800);
const dbg = await page.evaluate(() => document.getElementById("debug-layout")?.textContent ?? "");
check("?debug=layout prints the numbers", /appH/.test(dbg) && /gapUnderRoot/.test(dbg));
console.log(`\n${dbg}\n`);
check("no page errors", errors.length === 0, errors.slice(0, 2).join(" | "));

await browser.close();
const failed = results.filter((r) => !r).length;
console.log(failed ? `${failed} check(s) failed` : `All ${results.length} checks passed`);
process.exit(failed ? 1 : 0);
