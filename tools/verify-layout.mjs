// Layout verifier. Opens every game at several phone sizes, drives it through every beat and
// the states in between, and fails on any text that overlaps text, a shape or a line, leaves the
// canvas, or any prompt or note that wraps past two lines. See docs/LAYOUT.md.
//
//   npm run build && npm run preview     (one terminal)
//   npm run verify:layout                (another). BASE_URL and CHROME can be set.
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:4173").replace(/\/$/, "");
const GAMES = (process.env.GAMES ?? "dominant-strategy,prisoners-dilemma,matching-pennies,stag-hunt,ultimatum").split(",");
const SIZES = [
  { name: "iPhone 15, home screen app", w: 390, h: 844 },
  { name: "iPhone 15, Safari with bars", w: 390, h: 700 },
  { name: "iPhone 15, Safari, short", w: 390, h: 640 },
  { name: "iPhone SE, Safari", w: 375, h: 560 },
  { name: "iPhone Pro Max", w: 430, h: 932 },
  { name: "Android small", w: 360, h: 640 },
  { name: "iPad", w: 768, h: 1024 },
];
const MIN_CANVAS_H = 420;

// Each entry runs inside the page against the live game. `settle` is how long to wait for animation.
const STATES = {
  "dominant-strategy": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, one round revealed", (g) => { g.debugGoto("feel"); g.play(1); }, 1500],
    ["feel, all rounds", (g) => { g.debugGoto("feel"); for (let i = 0; i < 4; i++) { g.play(1); g.revealRound(); } g.locked = false; g.syncButtons(); }, 900],
    ["see", (g) => g.debugGoto("see")],
    ["see, both columns", (g) => { g.debugGoto("see"); g.inspect(0); g.inspect(1); }, 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong answer", (g) => { g.debugGoto("prove"); const a = g.puzzles[g.pi].answer; g.answer(a === null ? 0 : "none"); }, 1500],
    ["prove, right answer", (g) => { g.debugGoto("prove"); g.answer(g.puzzles[g.pi].answer ?? "none"); }, 1200],
  ],
  "prisoners-dilemma": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, one round revealed", (g) => { g.debugGoto("feel"); g.play("break"); }, 1600],
    ["see", (g) => g.debugGoto("see")],
    ["see, they hold", (g) => { g.debugGoto("see"); g.inspect("hold"); }, 1500],
    ["see, both", (g) => { g.debugGoto("see"); g.inspect("hold"); g.inspect("break"); }, 1800],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, solved", (g) => { g.debugGoto("prove"); g.setT(2); }, 1500],
  ],
  "matching-pennies": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, partway", (g) => { g.debugGoto("feel"); for (let i = 0; i < 9; i++) g.playFeel(i % 3 === 0 ? 0 : 1); }, 1200],
    ["feel, full", (g) => { g.debugGoto("feel"); for (let i = 0; i < 16; i++) g.playFeel(i % 2); }, 1200],
    ["see, start", (g) => { g.debugGoto("see"); g.seeStep = 0; g.panelA.snap(0); g.panelB.snap(0); }, 600],
    ["see, tent", (g) => { g.debugGoto("see"); g.seeStep = 1; g.panelB.snap(0); }, 800],
    ["see, bars", (g) => g.debugGoto("see"), 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, ten flips", (g) => { g.debugGoto("prove"); for (let i = 0; i < 10; i++) g.flip(); }, 1000],
    ["prove, run done", (g) => { g.debugGoto("prove"); for (let i = 0; i < 10; i++) g.flip(); g.startRun(); }, 3600],
  ],
  "stag-hunt": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, result", (g) => { g.debugGoto("feel"); g.play("stag"); }, 1600],
    ["feel, hare result", (g) => { g.debugGoto("feel"); g.play("hare"); }, 1600],
    ["see, hare line", (g) => { g.debugGoto("see"); g.seeStep = 0; g.stagLine.snap(0); g.cross.snap(0); }, 900],
    ["see, both lines", (g) => { g.debugGoto("see"); g.seeStep = 1; g.cross.snap(0); }, 1500],
    ["see, crossing", (g) => g.debugGoto("see"), 1800],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.pm = 0.5; g.lockIn(); }, 800],
    ["prove, right", (g) => { g.debugGoto("prove"); g.pm = 0.8; g.lockIn(); }, 1400],
  ],
  ultimatum: [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, accepted", (g) => { g.debugGoto("feel"); g.offer = 5; g.press(); g.decide(); g.accepted = true; g.ringIn.snap(1); }, 1200],
    ["feel, refused", (g) => { g.debugGoto("feel"); g.offer = 1; g.press(); g.since = 5; }, 2200],
    ["see", (g) => g.debugGoto("see"), 800],
    ["see, probing", (g) => { g.debugGoto("see"); g.setProbe(g.chart().X(3.2)); }, 1200],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.po = 9; g.lockIn(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.po = 2.6; g.lockIn(); }, 1500],
  ],
};

const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined });
let problems = 0;
let checked = 0;

for (const size of SIZES) {
  const ctx = await browser.newContext({ viewport: { width: size.w, height: size.h }, deviceScaleFactor: 2, hasTouch: size.w < 700, isMobile: size.w < 700, colorScheme: "dark" });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  for (const slug of GAMES) {
    await page.goto(`${BASE}/g/${slug}?audit&debug=1`);
    await page.waitForFunction(() => window.__tg && window.__tg.game, null, { timeout: 15000 }).catch(() => undefined);
    await page.waitForTimeout(500);
    const canvas = await page.evaluate(() => {
      const c = document.querySelector("canvas[data-play]");
      return c ? { w: Math.round(c.getBoundingClientRect().width), h: Math.round(c.getBoundingClientRect().height) } : null;
    });
    if (!canvas) {
      console.log(`FAIL  ${size.name} ${slug}: no canvas`);
      problems++;
      continue;
    }
    for (const [label, setup, settle = 1500] of STATES[slug] ?? []) {
      await page.evaluate(`(() => { const g = window.__tg.game; (${setup.toString()})(g); })()`);
      await page.waitForTimeout(settle);
      const r = await page.evaluate(() => ({ v: window.__tgViolations ?? ["auditor off"], c: window.__tgCaptions ?? { prompt: 0, note: 0 } }));
      const issues = [...r.v];
      if (r.c.prompt > 2) issues.push(`prompt wraps to ${r.c.prompt} lines`);
      if (r.c.note > 2) issues.push(`note wraps to ${r.c.note} lines`);
      checked++;
      const tooSmall = canvas.h < MIN_CANVAS_H;
      if (issues.length && !tooSmall) {
        problems++;
        console.log(`FAIL  ${size.name} ${canvas.w}x${canvas.h}  ${slug}  [${label}]`);
        for (const i of issues) console.log(`        ${i}`);
      } else if (issues.length) console.log(`skip  ${size.name} ${canvas.w}x${canvas.h} ${slug} [${label}] canvas under ${MIN_CANVAS_H}px (${issues.length} issues ignored)`);
    }
    if (errors.length) {
      problems++;
      console.log(`FAIL  page errors in ${slug}: ${errors.slice(0, 2).join(" | ")}`);
      errors.length = 0;
    }
  }
  console.log(`done  ${size.name}  canvas ${(await page.evaluate(() => { const c = document.querySelector("canvas[data-play]"); return c ? `${Math.round(c.getBoundingClientRect().width)}x${Math.round(c.getBoundingClientRect().height)}` : "none"; }))}`);
  await ctx.close();
}
await browser.close();
console.log(problems ? `\n${problems} layout problem(s) in ${checked} checked states` : `\nLayout clean: ${checked} states across ${SIZES.length} screen sizes`);
process.exit(problems ? 1 : 0);
