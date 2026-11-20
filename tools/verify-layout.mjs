// Layout verifier. Opens every game at several phone sizes, drives it through every beat and
// the states in between, and fails on any text that overlaps text, a shape or a line, leaves the
// canvas, or any prompt or note that wraps past two lines. See docs/LAYOUT.md.
//
//   npm run build && npm run preview     (one terminal)
//   npm run verify:layout                (another). BASE_URL and CHROME can be set.
import { chromium } from "playwright";

const BASE = (process.env.BASE_URL ?? "http://localhost:4173").replace(/\/$/, "");
const ALL = [
  "dominant-strategy", "prisoners-dilemma", "matching-pennies", "stag-hunt", "ultimatum",
  "information-types", "short-long-games", "iterated-elimination", "nash-equilibrium", "mixed-strategy",
  "minimax-theorem", "backward-induction", "public-goods", "centipede", "travelers-dilemma",
  "focal-points", "chicken", "battle-of-sexes", "dictator", "trust-game",
  "tragedy-commons", "axelrod-tit-for-tat", "flow-theory", "design-ethics", "expected-utility",
];
const GAMES = (process.env.GAMES ?? ALL.join(",")).split(",");
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
  "focal-points": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, waiting", (g) => { g.debugGoto("feel"); g.play(1); }, 300],
    ["feel, missed", (g) => { g.debugGoto("feel"); g.play(0); g.theirs[0] = 3; g.since = 5; }, 1400],
    ["feel, matched", (g) => { g.debugGoto("feel"); g.play(2); g.theirs[0] = 2; g.since = 5; }, 1400],
    ["feel, last row", (g) => { g.debugGoto("feel"); for (let i = 0; i < 3; i++) { g.play(i + 1); g.revealRound(); g.nextRound(); } }, 500],
    ["feel, all rows", (g) => { g.debugGoto("feel"); for (let i = 0; i < 4; i++) { g.play(i + 1); g.revealRound(); if (i < 3) g.nextRound(); } }, 1200],
    ["see, start", (g) => g.debugGoto("see"), 900],
    ["see, no focus", (g) => { g.debugGoto("see"); g.advance(); }, 1500],
    ["see, one focus", (g) => { g.debugGoto("see"); for (let i = 0; i < 3; i++) g.advance(); }, 1500],
    ["see, two odd", (g) => { g.debugGoto("see"); for (let i = 0; i < 5; i++) g.advance(); }, 1500],
    ["see, last", (g) => { g.debugGoto("see"); for (let i = 0; i < 7; i++) g.advance(); }, 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.answer((g.puzzles[0].answer + 1) % 5); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.answer(g.puzzles[0].answer); }, 1400],
    ["prove, six, wrong", (g) => { g.debugGoto("prove"); g.pi = 2; g.loadPuzzle(); g.answer((g.puzzles[2].answer + 1) % 6); }, 900],
    ["prove, six, right", (g) => { g.debugGoto("prove"); g.pi = 2; g.loadPuzzle(); g.answer(g.puzzles[2].answer); }, 1400],
  ],
  chicken: [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, waiting", (g) => { g.debugGoto("feel"); g.play("dare"); }, 300],
    ["feel, crash", (g) => { g.debugGoto("feel"); g.drivers[0] = 1; g.play("dare"); g.since = 5; }, 1500],
    ["feel, win", (g) => { g.debugGoto("feel"); g.drivers[0] = 0; g.play("dare"); g.since = 5; }, 1500],
    ["feel, swerve", (g) => { g.debugGoto("feel"); g.drivers[0] = 1; g.play("swerve"); g.since = 5; }, 1500],
    ["feel, all drivers", (g) => { g.debugGoto("feel"); for (let i = 0; i < 5; i++) { g.play(i % 2 ? "swerve" : "dare"); g.revealRound(); if (i < 4) g.nextDriver(); } }, 1500],
    ["see, start", (g) => g.debugGoto("see"), 900],
    ["see, one column", (g) => { g.debugGoto("see"); g.colMark[0] = true; g.afterMark(); }, 900],
    ["see, three marked", (g) => { g.debugGoto("see"); g.colMark = [true, true]; g.rowMark[0] = true; g.afterMark(); }, 900],
    ["see, all marked", (g) => g.debugGoto("see"), 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.answer(g.cases[0].rivalReply() === "swerve" ? "dare" : "swerve"); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.answer(g.cases[0].rivalReply()); }, 1400],
    ["prove, crash is cheap", (g) => { g.debugGoto("prove"); g.pi = g.cases.findIndex((c) => c.rivalReply() === "dare"); g.loadCase(); g.answer("dare"); }, 1400],
    ["prove, crash is cheap, wrong", (g) => { g.debugGoto("prove"); g.pi = g.cases.findIndex((c) => c.rivalReply() === "dare"); g.loadCase(); g.answer("swerve"); }, 900],
  ],
  "battle-of-sexes": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, waiting", (g) => { g.debugGoto("feel"); g.play("opera"); }, 300],
    ["feel, met", (g) => { g.debugGoto("feel"); g.partners[0] = 1; g.play("opera"); g.since = 5; }, 1500],
    ["feel, missed", (g) => { g.debugGoto("feel"); g.partners[0] = 0; g.play("opera"); g.since = 5; }, 1500],
    ["feel, met at football", (g) => { g.debugGoto("feel"); g.partners[0] = 0; g.play("football"); g.since = 5; }, 1500],
    ["feel, all evenings", (g) => { g.debugGoto("feel"); for (let i = 0; i < 5; i++) { g.play(i % 2 ? "football" : "opera"); g.revealRound(); if (i < 4) g.nextPartner(); } }, 1500],
    ["see, start", (g) => { g.debugGoto("see"); g.turned = [[false, false], [false, false]]; g.glow.snap(0); g.afterTurn(); }, 900],
    ["see, two turned", (g) => { g.debugGoto("see"); g.turned = [[true, false], [false, true]]; g.glow.snap(0); g.afterTurn(); }, 900],
    ["see, all turned", (g) => g.debugGoto("see"), 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, one picked", (g) => { g.debugGoto("prove"); g.picks[0][0] = true; g.sync(); }, 600],
    ["prove, wrong pick", (g) => { g.debugGoto("prove"); g.picks[0][1] = true; g.checkPicks(); }, 900],
    ["prove, missed one", (g) => { g.debugGoto("prove"); g.picks[0][0] = true; g.checkPicks(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); for (const [r, c] of g.tables[0].stable) g.picks[r][c] = true; g.checkPicks(); }, 1400],
    ["prove, swapped columns", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadTable(); g.picks[0][1] = true; g.picks[1][0] = true; g.sync(); }, 900],
    ["prove, swapped, wrong", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadTable(); g.picks[0][0] = true; g.picks[1][1] = true; g.checkPicks(); }, 900],
  ],
  dictator: [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, keep it all", (g) => { g.debugGoto("feel"); g.slider.value = 0; g.preview(); }, 900],
    ["feel, give half", (g) => { g.debugGoto("feel"); g.slider.value = 0.5; g.preview(); }, 900],
    ["feel, give it all", (g) => { g.debugGoto("feel"); g.slider.value = 1; g.preview(); }, 900],
    ["feel, dictated", (g) => { g.debugGoto("feel"); g.slider.value = 0.3; g.preview(); g.commit(); g.since = 5; }, 1800],
    ["feel, proposing", (g) => { g.debugGoto("feel"); g.commit(); g.since = 5; g.tick(0.1); g.afterDictator(); }, 1000],
    ["feel, accepted", (g) => { g.debugGoto("feel"); g.commit(); g.since = 5; g.tick(0.1); g.afterDictator(); g.minimum = 2; g.slider.value = 0.5; g.preview(); g.commit(); g.since = 5; }, 1800],
    ["feel, refused", (g) => { g.debugGoto("feel"); g.commit(); g.since = 5; g.tick(0.1); g.afterDictator(); g.minimum = 4; g.slider.value = 0.1; g.preview(); g.commit(); g.since = 5; }, 1800],
    ["see, first row", (g) => { g.debugGoto("see"); g.d = 2; g.u = 4; g.enterSee(); }, 900],
    ["see, both rows", (g) => { g.debugGoto("see"); g.d = 2; g.u = 4; g.enterSee(); g.advance(); }, 1500],
    ["see, split", (g) => { g.debugGoto("see"); g.d = 2; g.u = 5; g.enterSee(); g.advance(); g.advance(); }, 1500],
    ["see, no fear", (g) => { g.debugGoto("see"); g.d = 5; g.u = 3; g.enterSee(); g.advance(); g.advance(); }, 1500],
    ["see, kept it all", (g) => { g.debugGoto("see"); g.d = 0; g.u = 0; g.enterSee(); g.advance(); g.advance(); }, 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.answer(g.pairs[0].kinder === "a" ? "b" : "a"); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.answer(g.pairs[0].kinder); }, 1400],
  ],
  "trust-game": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, send all", (g) => { g.debugGoto("feel"); g.slider.value = 1; g.preview(); }, 900],
    ["feel, send none", (g) => { g.debugGoto("feel"); g.slider.value = 0; g.preview(); }, 900],
    ["feel, waiting", (g) => { g.debugGoto("feel"); g.commit(); }, 300],
    ["feel, trusted", (g) => { g.debugGoto("feel"); g.shares[0] = 0.6; g.slider.value = 1; g.preview(); g.commit(); g.since = 5; }, 1500],
    ["feel, betrayed", (g) => { g.debugGoto("feel"); g.shares[0] = 0; g.slider.value = 1; g.preview(); g.commit(); g.since = 5; }, 1500],
    ["feel, sent nothing", (g) => { g.debugGoto("feel"); g.slider.value = 0; g.preview(); g.commit(); g.since = 5; }, 1500],
    ["feel, all strangers", (g) => { g.debugGoto("feel"); for (let i = 0; i < 4; i++) { g.slider.value = 0.2 + 0.2 * i; g.preview(); g.commit(); g.reveal(); if (i < 3) g.nextRound(); } }, 1500],
    ["see, start", (g) => { g.debugGoto("see"); g.sent = [5, 0, 10, 3]; g.shown = 0; g.cols.forEach((d) => d.snap(0)); }, 900],
    ["see, two shown", (g) => { g.debugGoto("see"); g.sent = [5, 0, 10, 3]; g.shown = 0; g.cols.forEach((d) => d.snap(0)); g.advance(); g.advance(); }, 1500],
    ["see, all shown", (g) => { g.debugGoto("see"); g.sent = [5, 0, 10, 3]; g.shown = 0; g.cols.forEach((d) => d.snap(0)); for (let i = 0; i < 4; i++) g.advance(); }, 1500],
    ["see, full sends", (g) => { g.debugGoto("see"); g.sent = [10, 10, 10, 10]; g.shown = 0; g.cols.forEach((d) => d.snap(0)); for (let i = 0; i < 4; i++) g.advance(); }, 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.slider.value = 0.9; g.lockIn(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.slider.value = g.trusts[0].breakEven; g.lockIn(); }, 1400],
    ["prove, second", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadCase(); g.slider.value = 0.1; }, 900],
  ],
  "tragedy-commons": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, waiting", (g) => { g.debugGoto("feel"); g.play(2); }, 300],
    ["feel, two, crowd", (g) => { g.debugGoto("feel"); g.others[0] = 4; g.play(2); g.since = 5; }, 1500],
    ["feel, one, empty field", (g) => { g.debugGoto("feel"); g.others[0] = 0; g.play(1); g.since = 5; }, 1500],
    ["feel, all rounds", (g) => { g.debugGoto("feel"); for (let i = 0; i < 5; i++) { g.play(i % 2 ? 1 : 2); g.reveal(); if (i < 4) g.nextRound(); } }, 1500],
    ["see, start", (g) => g.debugGoto("see"), 900],
    ["see, three cases", (g) => { g.debugGoto("see"); g.shown = 0; g.cols.forEach((d) => d.snap(0)); g.trap.snap(0); for (let i = 0; i < 3; i++) g.advance(); }, 1500],
    ["see, five cases", (g) => { g.debugGoto("see"); g.shown = 0; g.cols.forEach((d) => d.snap(0)); g.trap.snap(0); for (let i = 0; i < 5; i++) g.advance(); }, 1500],
    ["see, the trap", (g) => g.debugGoto("see"), 1800],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.answer(!g.fields[0].tragic); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.answer(g.fields[0].tragic); }, 1400],
    ["prove, second", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadField(); g.answer(g.fields[1].tragic); }, 1400],
    ["prove, third wrong", (g) => { g.debugGoto("prove"); g.pi = 2; g.loadField(); g.answer(!g.fields[2].tragic); }, 900],
  ],
  "axelrod-tit-for-tat": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, waiting", (g) => { g.debugGoto("feel"); g.play("hold"); }, 300],
    ["feel, first round", (g) => { g.debugGoto("feel"); g.play("break"); g.since = 5; }, 1500],
    ["feel, three rounds", (g) => { g.debugGoto("feel"); for (let i = 0; i < 3; i++) { g.play(i === 1 ? "break" : "hold"); g.reveal(); if (i < 2) g.nextRound(); } }, 1200],
    ["feel, all rounds, always hold", (g) => { g.debugGoto("feel"); for (let i = 0; i < 6; i++) { g.play("hold"); g.reveal(); if (i < 5) g.nextRound(); } }, 1500],
    ["feel, all rounds, always break", (g) => { g.debugGoto("feel"); for (let i = 0; i < 6; i++) { g.play("break"); g.reveal(); if (i < 5) g.nextRound(); } }, 1500],
    ["see, start", (g) => g.debugGoto("see"), 900],
    ["see, three scored", (g) => { g.debugGoto("see"); g.shown = 0; g.rows.forEach((d) => d.snap(0)); g.crown.snap(0); for (let i = 0; i < 3; i++) g.advance(); }, 1500],
    ["see, all scored", (g) => { g.debugGoto("see"); g.shown = 0; g.rows.forEach((d) => d.snap(0)); g.crown.snap(0); for (let i = 0; i < 5; i++) g.advance(); }, 1500],
    ["see, winner", (g) => g.debugGoto("see"), 1800],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, partly filled", (g) => { g.debugGoto("prove"); g.entry[0] = "hold"; g.entry[1] = "break"; g.sync(); }, 600],
    ["prove, wrong", (g) => { g.debugGoto("prove"); g.entry = g.readings[0].answer.map((m) => m); g.entry[2] = g.entry[2] === "hold" ? "break" : "hold"; g.checkEntry(); }, 900],
    ["prove, wrong first", (g) => { g.debugGoto("prove"); g.entry = g.readings[0].answer.map((m) => m); g.entry[0] = "break"; g.checkEntry(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.entry = g.readings[0].answer.map((m) => m); g.checkEntry(); }, 1400],
  ],
  "flow-theory": [
    ["feel, ready", (g) => g.debugGoto("feel")],
    ["feel, running", (g) => { g.debugGoto("feel"); g.startRun(); g.runT = 0.8; g.down = true; const t = g.path(0.8, 1.5); g.px = t.x + 12; g.py = t.y; }, 200],
    ["feel, running, off target", (g) => { g.debugGoto("feel"); g.startRun(); g.runT = 0.8; g.down = false; }, 200],
    ["feel, run one result", (g) => { g.debugGoto("feel"); g.startRun(); g.counted = 1; g.inside = 0.97; g.endRun(); }, 1500],
    ["feel, run two ready", (g) => { g.debugGoto("feel"); g.startRun(); g.counted = 1; g.inside = 0.97; g.endRun(); g.nextRun(); }, 900],
    ["feel, run three result", (g) => { g.debugGoto("feel"); for (let i = 0; i < 3; i++) { g.startRun(); g.counted = 1; g.inside = [0.97, 0.7, 0.3][i]; g.endRun(); if (i < 2) g.nextRun(); } }, 1500],
    ["see, start", (g) => g.debugGoto("see"), 900],
    ["see, three runs", (g) => { g.debugGoto("see"); g.seeStep = 0; g.dots.snap(0); g.band.snap(0); g.advance(); }, 1500],
    ["see, band", (g) => g.debugGoto("see"), 1500],
    ["see, low skill", (g) => { g.debugGoto("see"); g.skill = 0; g.seeStep = 0; g.advance(); g.advance(); }, 1500],
    ["see, high skill", (g) => { g.debugGoto("see"); g.skill = 10; g.seeStep = 0; g.advance(); g.advance(); }, 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong low", (g) => { g.debugGoto("prove"); g.ch = 0.5; g.lockIn(); }, 900],
    ["prove, wrong high", (g) => { g.debugGoto("prove"); g.ch = 10; g.lockIn(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.ch = g.skills[0] + 0.5; g.lockIn(); }, 1400],
    ["prove, second", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadPerson(); }, 900],
  ],
  "design-ethics": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, one released", (g) => { g.debugGoto("feel"); g.release(2); }, 1500],
    ["feel, two released", (g) => { g.debugGoto("feel"); g.release(0); g.release(1); }, 1500],
    ["feel, all released", (g) => { g.debugGoto("feel"); g.release(0); g.release(1); g.release(2); }, 1500],
    ["see, start", (g) => g.debugGoto("see"), 900],
    ["see, early", (g) => { g.debugGoto("see"); g.reach = 0.25; g.cur = 0.25; g.care.snap(0); }, 600],
    ["see, past the care point", (g) => g.debugGoto("see"), 1500],
    ["see, at the top", (g) => { g.debugGoto("see"); g.cur = 1; g.reach = 1; }, 900],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong low", (g) => { g.debugGoto("prove"); g.slider.value = 0.02; g.lockIn(); }, 900],
    ["prove, wrong high", (g) => { g.debugGoto("prove"); g.slider.value = 1; g.lockIn(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); g.slider.value = g.designs[0].care; g.lockIn(); }, 1400],
    ["prove, second", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadDesign(); g.slider.value = g.designs[1].care; }, 900],
  ],
  "expected-utility": [
    ["feel", (g) => g.debugGoto("feel")],
    ["feel, waiting", (g) => { g.debugGoto("feel"); g.play("gamble"); }, 300],
    ["feel, took the sure", (g) => { g.debugGoto("feel"); g.play("sure"); g.since = 5; }, 1500],
    ["feel, flip paid", (g) => { g.debugGoto("feel"); g.env.rng.chance = () => true; g.play("gamble"); g.since = 5; }, 1500],
    ["feel, flip lost", (g) => { g.debugGoto("feel"); g.env.rng.chance = () => false; g.play("gamble"); g.since = 5; }, 1500],
    ["feel, all rounds", (g) => { g.debugGoto("feel"); for (let i = 0; i < 4; i++) { g.play(i % 2 ? "sure" : "gamble"); g.reveal(); if (i < 3) g.nextRound(); } }, 1500],
    ["see, start", (g) => { g.debugGoto("see"); g.seeStep = 0; g.chord.snap(0); g.worth.snap(0); }, 900],
    ["see, the flip", (g) => { g.debugGoto("see"); g.seeStep = 0; g.chord.snap(0); g.worth.snap(0); g.advance(); }, 1500],
    ["see, worth", (g) => g.debugGoto("see"), 1500],
    ["prove", (g) => g.debugGoto("prove")],
    ["prove, wrong high", (g) => { g.debugGoto("prove"); g.slider.value = 0.9; g.lockIn(); }, 900],
    ["prove, wrong low", (g) => { g.debugGoto("prove"); g.slider.value = 0; g.lockIn(); }, 900],
    ["prove, right", (g) => { g.debugGoto("prove"); const gm = g.gambles[0]; g.slider.value = gm.certainty / gm.hi; g.lockIn(); }, 1400],
    ["prove, second", (g) => { g.debugGoto("prove"); g.pi = 1; g.loadGamble(); }, 900],
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

// The finished screen of every new game, which keeps the layout of its Prove beat.
for (const slug of ["focal-points", "chicken", "battle-of-sexes", "dictator", "trust-game", "tragedy-commons", "axelrod-tit-for-tat", "flow-theory", "design-ethics", "expected-utility"]) {
  STATES[slug].push(["finished", (g) => { g.debugGoto("prove"); g.finish(); }, 1200]);
}

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
