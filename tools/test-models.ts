// Run with: npm test. Pure logic only, no DOM. Every game model is checked against its theory.
import assert from "node:assert/strict";
import { Rng } from "../src/core/Rng";
import { Damped } from "../src/core/Damped";
import { Ease, normalCdf, normalInv } from "../src/core/math";
import { DominanceMatrix, FEEL_MATRIX, proveSet, feelColumns } from "../src/games/dominant-strategy/model";
import { Dilemma } from "../src/games/prisoners-dilemma/model";
import { PatternPredictor, statsOf, expectedScore, randomRun, type Side } from "../src/games/matching-pennies/model";
import { StagHunt, PROVE_GAMES, PARTNER_BELIEFS } from "../src/games/stag-hunt/model";
import { Crowd, FEEL_CROWD, PROVE_CROWDS, PROVE_SHARE } from "../src/games/ultimatum/model";
import { Curriculum, FIRST } from "../src/catalog/curriculum";

let passed = 0;
function test(name: string, fn: () => void): void {
  try {
    fn();
    passed++;
    console.log(`  ok  ${name}`);
  } catch (e) {
    console.error(`FAIL  ${name}`);
    throw e;
  }
}
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) <= eps, `${a} is not within ${eps} of ${b}`);

console.log("core");
test("Rng is deterministic per seed and forks are independent", () => {
  const a = new Rng(42);
  const b = new Rng(42);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
  assert.notEqual(new Rng(1).next(), new Rng(2).next());
});
test("Damped settles on its target without overshoot", () => {
  const d = new Damped(0, 0.3).set(1);
  let max = 0;
  for (let i = 0; i < 600; i++) max = Math.max(max, d.step(1 / 60));
  assert.ok(max <= 1.0001, `overshot to ${max}`);
  near(d.value, 1, 1e-3);
});
test("Ease.liturgy runs from 0 to 1", () => {
  near(Ease.liturgy(0), 0);
  near(Ease.liturgy(1), 1);
  assert.ok(Ease.liturgy(0.5) > 0.5, "liturgy is front loaded");
});
test("normal cdf and its inverse agree", () => {
  near(normalCdf(0), 0.5, 1e-6);
  for (const p of [0.1, 0.3, 0.5, 0.9]) near(normalCdf(normalInv(p)), p, 1e-4);
});

console.log("catalog");
test("curriculum holds every topic once, in order, with the five games first", () => {
  const all = Curriculum.all();
  assert.equal(new Set(all.map((i) => i.slug)).size, all.length);
  assert.ok(all.length >= 100);
  assert.deepEqual(all.slice(0, 5).map((i) => i.slug), [...FIRST]);
  assert.deepEqual(all.map((i) => i.order), all.map((_, i) => i + 1));
  const last = all.filter((i) => i.kind === "topic").slice(-3).map((i) => i.slug);
  assert.deepEqual(last, ["hypergame-theory", "hypergame-levels", "metagame-howard"]);
  assert.equal(all[all.length - 1]!.slug, "synthesis-board");
});
test("levels never go backwards after the opening five, until the finale", () => {
  const body = Curriculum.all().filter((i) => !FIRST.includes(i.slug) && i.kind === "topic").slice(0, -3);
  for (let i = 1; i < body.length; i++) assert.ok(body[i]!.level >= body[i - 1]!.level, `${body[i]!.slug} breaks level order`);
});
test("no em dashes in any catalog text", () => {
  for (const i of Curriculum.all()) assert.ok(!/[\u2014\u2013]/.test(i.name + i.idea), i.slug);
});

console.log("dominant strategy");
test("Feel matrix: Down is strictly dominant, and Up still holds the tempting 5", () => {
  assert.equal(FEEL_MATRIX.dominantRow(), 1);
  assert.equal(FEEL_MATRIX.bestRow(0), 1);
  assert.equal(FEEL_MATRIX.bestRow(1), 1);
  assert.equal(FEEL_MATRIX.payoff(0, 0), 5);
});
test("generated puzzles always have the requested answer and no ties", () => {
  for (let seed = 1; seed <= 300; seed++) {
    const rng = new Rng(seed);
    for (const want of [0, 1, null] as const) {
      const m = DominanceMatrix.generate(rng, want);
      assert.equal(m.dominantRow(), want, `seed ${seed} want ${want}`);
      assert.notEqual(m.bestRow(0), null);
      assert.notEqual(m.bestRow(1), null);
    }
  }
});
test("Prove set has one 'none', one Up and one Down, and Feel columns use both columns twice", () => {
  const set = proveSet(new Rng(9));
  assert.deepEqual(set.map((s) => s.answer).sort(), [0, 1, null].sort());
  const cols = feelColumns(new Rng(3));
  assert.equal(cols.filter((c) => c === 0).length, 2);
});

console.log("prisoner's dilemma");
test("standard payoffs form a dilemma and Break is dominant", () => {
  const d = new Dilemma();
  assert.ok(d.isDilemma());
  assert.ok(d.breakIsDominant());
  assert.equal(d.bestReply("hold"), "break");
  assert.equal(d.bestReply("break"), "break");
});
test("the equilibrium is worse for both than mutual holding", () => {
  const d = new Dilemma();
  assert.ok(d.paretoBetter(["hold", "hold"], ["break", "break"]));
});
test("lowering the temptation below the reward makes holding stable", () => {
  assert.ok(!new Dilemma().holdIsEquilibrium());
  assert.ok(new Dilemma().with({ T: 2.5 }).holdIsEquilibrium());
  assert.equal(new Dilemma().with({ T: 2.5 }).bestReply("hold"), "hold");
  assert.ok(!new Dilemma().with({ T: 2.5 }).isDilemma());
});

console.log("matching pennies");
test("the predictor beats an alternating player", () => {
  const p = new PatternPredictor(new Rng(5));
  let caught = 0;
  for (let i = 0; i < 40; i++) {
    const move: Side = (i % 2) as Side;
    if (p.predict() === move) caught++;
    p.observe(move);
  }
  assert.ok(caught / 40 > 0.8, `only caught ${caught}/40`);
});
test("the predictor beats a player stuck on one side", () => {
  const p = new PatternPredictor(new Rng(5));
  let caught = 0;
  for (let i = 0; i < 30; i++) {
    if (p.predict() === 0) caught++;
    p.observe(0);
  }
  assert.ok(caught / 30 > 0.85);
});
test("against a fair coin the predictor settles near one half", () => {
  const run = randomRun(4000, 11);
  near(run[run.length - 1]!, 0.5, 0.04);
});
test("stats and the tent: 50/50 is the peak, any lean costs you", () => {
  const s = statsOf([0, 1, 0, 1], [0, 1, 1, 0]);
  assert.equal(s.caughtCount, 2);
  near(s.repeatAfterLeft, 0);
  near(expectedScore(0.5), 0);
  assert.ok(expectedScore(0.8) < expectedScore(0.6));
});

console.log("stag hunt");
test("threshold is hare over stag and the best reply flips there", () => {
  const g = new StagHunt(3, 2);
  near(g.threshold, 2 / 3);
  assert.equal(g.best(0.6), "hare");
  assert.equal(g.best(0.7), "stag");
});
test("both stag and both hare are equilibria", () => {
  const g = new StagHunt(3, 2);
  assert.ok(g.payoff("stag", "stag") > g.payoff("hare", "stag"));
  assert.ok(g.payoff("hare", "hare") > g.payoff("stag", "hare"));
});
test("prove games have distinct thresholds inside 0..1", () => {
  const t = PROVE_GAMES.map((g) => g.threshold);
  assert.equal(new Set(t.map((v) => v.toFixed(2))).size, t.length);
  for (const v of t) assert.ok(v > 0.2 && v < 0.9);
  assert.ok(PARTNER_BELIEFS.some((p) => p > 2 / 3) && PARTNER_BELIEFS.some((p) => p < 2 / 3));
});

console.log("ultimatum");
test("the best offer sits near the middle of the crowd, far from the textbook offer of 1", () => {
  const b = FEEL_CROWD.best();
  assert.ok(b.x > 3.5 && b.x < 5.5, `best offer ${b.x}`);
  assert.ok(FEEL_CROWD.expected(1) < FEEL_CROWD.expected(b.x) * 0.4);
  assert.ok(FEEL_CROWD.accept(1) < 0.15);
});
test("acceptance rises with the offer, and responders are spread through the crowd", () => {
  let prev = -1;
  for (let x = 0; x <= 10; x += 0.5) {
    const a = FEEL_CROWD.accept(x);
    assert.ok(a >= prev);
    prev = a;
  }
  const th = new Crowd("t", 3, 1.3).thresholds(5);
  assert.equal(th.length, 5);
  assert.ok(th[0]! < th[4]!);
  near(th[2]!, 3, 1e-6);
});
test("prove crowds have different optimal offers, and the optimum clears the pass mark", () => {
  const [a, b] = PROVE_CROWDS as [Crowd, Crowd];
  assert.ok(a.best().x < 3 && b.best().x > 4, `${a.best().x} ${b.best().x}`);
  for (const c of PROVE_CROWDS) assert.ok(c.expected(c.best().x) >= PROVE_SHARE * c.best().e);
  assert.ok(b.expected(a.best().x) < PROVE_SHARE * b.best().e, "reusing the old answer must fail");
});

console.log(`\n${passed} tests passed`);
