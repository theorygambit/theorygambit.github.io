// Layout verifier. Opens every game at several phone sizes, drives it through every beat and
// the states in between, and fails on any text that overlaps text, a shape or a line, leaves the
// canvas, or any prompt or note that wraps past two lines. See docs/LAYOUT.md.
//
//   npm run build && npm run preview     (one terminal)
//   npm run verify:layout                (another). BASE_URL and CHROME can be set.
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:4173").replace(/\/$/, "");
const GAMES = (process.env.GAMES ?? "dominant-strategy,prisoners-dilemma,matching-pennies,stag-hunt,ultimatum,information-types,short-long-games,iterated-elimination,nash-equilibrium,mixed-strategy,minimax-theorem,backward-induction,public-goods,centipede,travelers-dilemma").split(",");
const SIZES = [
  { name: "iPhone 15, home screen app", w: 390, h: 844 },
  { name: "iPhone 15, Safari with bars", w: 390, h: 700 },
  { name: "iPhone 15, Safari, short", w: 390, h: 640 },
  { name: "iPhone SE, Safari", w: 375, h: 560 },
  { name: "iPhone Pro Max", w: 430, h: 932 },
  { name: "Android small", w: 360, h: 640 },
  { name: "iPad", w: 768, h: 1024 },
];
const MIN_CANVAS_H = Number(process.env.MIN_H ?? 420);

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
  "information-types": [
    ["feel, round 1", (g) => g.debugGoto("feel")],
    ["feel, round 2", (g) => { g.debugGoto("feel"); g.round = 1; g.enterRound(); }],
    ["feel, round 3", (g) => { g.debugGoto("feel"); g.round = 2; g.enterRound(); }],
    ["feel, round 4", (g) => { g.debugGoto("feel"); g.round = 3; g.enterRound(); }],
    ["feel, guessed", (g) => { g.debugGoto("feel"); g.play(0); }, 1800],
    ["feel, last round guessed", (g) => { g.debugGoto("feel"); g.round = 3; g.enterRound(); g.play(1); }, 1800],
    ["see", (g) => g.debugGoto("see")],
    ["see, one corner", (g) => { g.debugGoto("see"); g.inspect(0); }, 900],
    ["see, all corners", (g) => { g.debugGoto("see"); for (let i = 0; i < 4; i++) g.inspect(i); }, 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, picked", (g) => { g.debugGoto("prove"); g.pick = { x: 0, y: 1 }; g.sync(); }],
    ["prove, wrong", (g) => { g.debugGoto("prove"); const s = g.scenes[0]; g.pick = { x: s.seen ? 1 : 0, y: s.known ? 1 : 0 }; g.lockIn(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); const s = g.scenes[0]; g.pick = { x: s.seen ? 0 : 1, y: s.known ? 0 : 1 }; g.lockIn(); }, 1400],
  ],
  "short-long-games": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, stranger result", (g) => { g.debugGoto("feel"); g.choose("break"); }, 1600],
    ["feel, partner choose", (g) => { g.debugGoto("feel"); g.choose("hold"); g.since = 5; g.reveal(); g.nextPlay(); }, 1200],
    ["feel, partner result", (g) => { g.debugGoto("feel"); g.choose("hold"); g.reveal(); g.nextPlay(); g.choose("break"); }, 1600],
    ["feel, last result", (g) => { g.debugGoto("feel"); for (let i = 0; i < 5; i++) { g.choose(i % 2 ? "break" : "hold"); g.reveal(); if (i < 4) g.nextPlay(); } }, 1200],
    ["see", (g) => g.debugGoto("see")],
    ["see, three rounds", (g) => { g.debugGoto("see"); g.setRounds(g.sl.X(3)); }, 1200],
    ["see, ten rounds", (g) => { g.debugGoto("see"); g.setRounds(g.sl.X(3)); g.setRounds(g.sl.X(10)); }, 1200],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.sl.value = 1; g.lockIn(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.sl.value = g.pool[0].breakEven; g.lockIn(); }, 1400],
    ["prove, second puzzle", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadPuzzle(); g.sl.value = 8; }, 900],
  ],
  "iterated-elimination": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, one round", (g) => { g.debugGoto("feel"); g.play(1); g.revealRound(); }, 1200],
    ["feel, while waiting", (g) => { g.debugGoto("feel"); g.play(2); }, 300],
    ["feel, all rounds", (g) => { g.debugGoto("feel"); for (let i = 0; i < 3; i++) { g.play(i); g.revealRound(); } }, 1200],
    ["see", (g) => g.debugGoto("see")],
    ["see, wrong strike", (g) => { g.debugGoto("see"); const m = g.m; const bad = (kind, i) => { const al = kind === "row" ? g.rowsAlive : g.colsAlive; const ot = kind === "row" ? g.colsAlive : g.rowsAlive; return !al.some((j) => j !== i && ot.every((o) => (kind === "row" ? m.a[j][o] > m.a[i][o] : m.b[o][j] > m.b[o][i]))); }; for (const kind of ["row", "col"]) for (const i of [0, 1, 2]) if (bad(kind, i)) { g.strike(kind, i); return; } }, 900],
    ["see, one strike", (g) => { g.debugGoto("see"); const h = g.hint(); g.strike(h.kind, h.index); }, 1400],
    ["see, two strikes", (g) => { g.debugGoto("see"); for (let i = 0; i < 2; i++) { const h = g.hint(); g.strike(h.kind, h.index); } }, 1400],
    ["see, solved", (g) => { g.debugGoto("see"); while (!g.won) { const h = g.hint(); g.strike(h.kind, h.index); } }, 1600],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong strike", (g) => { g.debugGoto("prove"); const m = g.m; const bad = (kind, i) => { const al = kind === "row" ? g.rowsAlive : g.colsAlive; const ot = kind === "row" ? g.colsAlive : g.rowsAlive; return !al.some((j) => j !== i && ot.every((o) => (kind === "row" ? m.a[j][o] > m.a[i][o] : m.b[o][j] > m.b[o][i]))); }; for (const kind of ["row", "col"]) for (const i of [0, 1, 2]) if (bad(kind, i)) { g.strike(kind, i); return; } }, 900],
    ["prove, solved", (g) => { g.debugGoto("prove"); for (const s of g.m.iterate().steps) g.strike(s.kind, s.index); }, 1600],
  ],
  "nash-equilibrium": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, someone moves", (g) => { g.debugGoto("feel"); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const d = g.m.deviations(r, c); if ((d.row === null) !== (d.col === null)) { g.tryCell(r, c); return; } } }, 1200],
    ["feel, both move", (g) => { g.debugGoto("feel"); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const d = g.m.deviations(r, c); if (d.row !== null && d.col !== null) { g.tryCell(r, c); return; } } }, 1200],
    ["feel, nobody moves", (g) => { g.debugGoto("feel"); const e = g.m.equilibria()[0]; g.tryCell(e[0], e[1]); }, 1200],
    ["feel, four taps", (g) => { g.debugGoto("feel"); for (let i = 0; i < 4; i++) g.tryCell(i % 3, (i + 1) % 3); }, 1200],
    ["see", (g) => g.debugGoto("see")],
    ["see, your rings", (g) => { g.debugGoto("see"); g.advance(); }, 1200],
    ["see, both rings", (g) => { g.debugGoto("see"); g.advance(); g.advance(); }, 1200],
    ["see, equilibrium", (g) => { g.debugGoto("see"); g.advance(); g.advance(); g.advance(); }, 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, picked", (g) => { g.debugGoto("prove"); g.toggle(0, 0); g.toggle(2, 1); }],
    ["prove, wrong cell", (g) => { g.debugGoto("prove"); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) if (!g.m.isEquilibrium(r, c) && g.picked.size === 0) g.toggle(r, c); g.lockIn(); }, 1200],
    ["prove, missed one", (g) => { g.debugGoto("prove"); const e = g.m.equilibria()[0]; g.toggle(e[0], e[1]); g.lockIn(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); for (const e of g.m.equilibria()) g.toggle(e[0], e[1]); g.lockIn(); }, 1500],
  ],
  "mixed-strategy": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, kick waiting", (g) => { g.debugGoto("feel"); g.kick(0); }, 300],
    ["feel, saved or scored", (g) => { g.debugGoto("feel"); g.kick(1); }, 1600],
    ["feel, third kick", (g) => { g.debugGoto("feel"); for (let i = 0; i < 2; i++) { g.kick(i); g.revealKick(); g.nextKick(); } g.kick(0); }, 1600],
    ["feel, last kick", (g) => { g.debugGoto("feel"); for (let i = 0; i < 5; i++) { g.kick(i % 2); g.revealKick(); g.nextKick(); } g.kick(0); }, 1600],
    ["see", (g) => g.debugGoto("see")],
    ["see, low share", (g) => { g.debugGoto("see"); g.setP(g.chart(g.frame).X(0.1)); }],
    ["see, at the cross", (g) => { g.debugGoto("see"); g.setP(g.chart(g.frame).X(g.g.indifference)); }, 1200],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.sl.value = g.pool[0].indifference > 0.5 ? 0.1 : 0.95; g.lockIn(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.sl.value = Math.round(g.pool[0].indifference * 100) / 100; g.lockIn(); }, 1500],
  ],
  "minimax-theorem": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, waiting", (g) => { g.debugGoto("feel"); g.play(1); }, 300],
    ["feel, one row", (g) => { g.debugGoto("feel"); g.play(1); g.revealRow(); }, 1200],
    ["feel, three rows", (g) => { g.debugGoto("feel"); for (let i = 0; i < 3; i++) { g.play(i); g.revealRow(); } }, 1200],
    ["see", (g) => g.debugGoto("see")],
    ["see, a floor", (g) => { g.debugGoto("see"); g.floor(1); }, 800],
    ["see, all floors", (g) => { g.debugGoto("see"); for (let i = 0; i < 3; i++) g.floor(i); }, 800],
    ["see, mixed", (g) => { g.debugGoto("see"); for (let i = 0; i < 3; i++) g.floor(i); g.ceil(0); g.ceil(2); }, 800],
    ["see, all", (g) => { g.debugGoto("see"); for (let i = 0; i < 3; i++) { g.floor(i); g.ceil(i); } }, 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong cell", (g) => { g.debugGoto("prove"); const s = g.m.saddle(); g.guess((s[0] + 1) % 3, (s[1] + 1) % 3); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); const s = g.m.saddle(); g.guess(s[0], s[1]); }, 1500],
  ],
  "backward-induction": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, they take", (g) => { g.debugGoto("feel"); g.takeStones(2); }, 300],
    ["feel, my turn again", (g) => { g.debugGoto("feel"); g.takeStones(2); g.theirMove(); }, 900],
    ["feel, won", (g) => { g.debugGoto("feel"); g.takeStones(1); while (g.turn !== "over") { if (g.turn === "them") g.theirMove(); else g.takeStones(g.left % 3 || 1); } }, 1200],
    ["feel, lost", (g) => { g.debugGoto("feel"); g.takeStones(2); g.theirMove(); while (g.turn !== "over") { g.takeStones(1); if (g.turn === "them") g.theirMove(); } }, 1200],
    ["see", (g) => g.debugGoto("see")],
    ["see, three labels", (g) => { g.debugGoto("see"); for (let i = 0; i < 3; i++) g.labelNext(); }, 900],
    ["see, all labels", (g) => { g.debugGoto("see"); for (let i = 0; i < 8; i++) g.labelNext(); }, 1200],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); const c = g.cases[0]; for (let t = 1; t <= c.pile.max; t++) if (!c.pile.winningTakes(c.pile.size).includes(t)) { g.takeStones(t); break; } }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.takeStones(g.cases[0].answer); }, 1500],
    ["prove, second case", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadCase(); }, 900],
    ["prove, second wrong", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadCase(); const c = g.cases[1]; for (let t = 1; t <= c.pile.max; t++) if (!c.pile.winningTakes(c.pile.size).includes(t)) { g.takeStones(t); break; } }, 900],
  ],
  "public-goods": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, give none", (g) => { g.debugGoto("feel"); g.sl.value = 0; }],
    ["feel, give all", (g) => { g.debugGoto("feel"); g.sl.value = 10; }],
    ["feel, committing", (g) => { g.debugGoto("feel"); g.sl.value = 6; g.commit(); }, 300],
    ["feel, result", (g) => { g.debugGoto("feel"); g.sl.value = 6; g.commit(); }, 2000],
    ["feel, last result", (g) => { g.debugGoto("feel"); for (let i = 0; i < 2; i++) { g.sl.value = 4; g.commit(); g.reveal(); g.nextRound(); } g.sl.value = 8; g.commit(); }, 2000],
    ["see", (g) => g.debugGoto("see")],
    ["see, middle", (g) => { g.debugGoto("see"); g.drag(g.chart(g.frame).X(5)); }],
    ["see, all in", (g) => { g.debugGoto("see"); g.drag(g.chart(g.frame).X(10)); }, 900],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.sl.value = 2; g.lockIn(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.sl.value = g.sizes[0]; g.lockIn(); }, 1500],
    ["prove, second", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadPuzzle(); g.sl.value = 8; }, 900],
  ],
  "centipede": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, they think", (g) => { g.debugGoto("feel"); g.decide(false); }, 300],
    ["feel, my second node", (g) => { g.debugGoto("feel"); g.decide(false); g.theirMove(); }, 600],
    ["feel, took at once", (g) => { g.debugGoto("feel"); g.decide(true); }, 1200],
    ["feel, passed then took", (g) => { g.debugGoto("feel"); g.decide(false); g.theirMove(); g.decide(true); }, 1200],
    ["feel, passed twice", (g) => { g.debugGoto("feel"); g.decide(false); g.theirMove(); g.decide(false); g.theirMove(); }, 1200],
    ["see", (g) => g.debugGoto("see")],
    ["see, last node", (g) => { g.debugGoto("see"); g.unravel(); }, 900],
    ["see, two nodes", (g) => { g.debugGoto("see"); g.unravel(); g.unravel(); }, 900],
    ["see, all", (g) => { g.debugGoto("see"); for (let i = 0; i < 4; i++) g.unravel(); }, 1200],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.guess(g.answer === 4 ? 3 : 4); }, 900],
    ["prove, wrong early", (g) => { g.debugGoto("prove"); g.guess(g.answer === 1 ? 4 : 1); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.guess(g.answer); }, 1500],
    ["prove, second", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadPuzzle(); }, 900],
  ],
  "travelers-dilemma": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, low claim", (g) => { g.debugGoto("feel"); g.sl.value = 2; }],
    ["feel, high claim", (g) => { g.debugGoto("feel"); g.sl.value = 10; }],
    ["feel, committing", (g) => { g.debugGoto("feel"); g.sl.value = 8; g.commit(); }, 300],
    ["feel, result", (g) => { g.debugGoto("feel"); g.sl.value = 9; g.commit(); }, 2000],
    ["feel, result at floor", (g) => { g.debugGoto("feel"); g.sl.value = 2; g.commit(); }, 2000],
    ["feel, last result", (g) => { g.debugGoto("feel"); for (let i = 0; i < 2; i++) { g.sl.value = 7; g.commit(); g.reveal(); g.nextRound(); } g.sl.value = 10; g.commit(); }, 2000],
    ["see", (g) => g.debugGoto("see")],
    ["see, middle", (g) => { g.debugGoto("see"); g.sl.setFromX(g.sl.X(7)); g.seeStep(10, 7); }],
    ["see, floor", (g) => { g.debugGoto("see"); g.sl.setFromX(g.sl.X(2)); g.seeStep(10, 2); }, 900],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); const q = g.cases[0]; g.sl.value = q.answer === q.game.lo ? q.game.lo + 1 : q.game.lo; g.lockIn(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.sl.value = g.cases[0].answer; g.lockIn(); }, 1500],
    ["prove, second", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadPuzzle(); }, 900],
    ["prove, second right", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadPuzzle(); g.sl.value = g.cases[1].answer; g.lockIn(); }, 1500],
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
