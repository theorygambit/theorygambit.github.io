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
import { Bimatrix } from "../src/games/shared/Bimatrix";
import { feelRounds, proveScenes, outcome, ringSide, decidable, SCENES } from "../src/games/information-types/model";
import { Repeated, FEEL_GAME as REPEAT_FEEL, PROVE_POOL as REPEAT_POOL } from "../src/games/short-long-games/model";
import { solvableTable, liveColumns, tryStrike } from "../src/games/iterated-elimination/model";
import { equilibriumTable, sameCells } from "../src/games/nash-equilibrium/model";
import { Penalty, FEEL_PENALTY, PROVE_PENALTIES, keeperDive } from "../src/games/mixed-strategy/model";
import { saddleTable, FEEL_TABLE } from "../src/games/minimax-theorem/model";
import { Pile, FEEL_PILE, PROVE_POOL as PILE_POOL } from "../src/games/backward-induction/model";
import { Pot, FEEL_POT, PROVE_SIZES } from "../src/games/public-goods/model";
import { Centipede, FEEL_GAME as CENTI_FEEL, generate as centiGenerate, playFeel } from "../src/games/centipede/model";
import { Travelers, FEEL_GAME as TRAVEL_FEEL, PROVE_POOL as TRAVEL_POOL } from "../src/games/travelers-dilemma/model";
import { PayoffTable } from "../src/games/shared/PayoffTable";
import { Spread, feelRounds as focalFeel, proveSet as focalProve } from "../src/games/focal-points/model";
import { Chicken, DRIVER_RATES, COMMIT_CASES } from "../src/games/chicken/model";
import { Outing, PARTNER_ODDS, proveTables } from "../src/games/battle-of-sexes/model";
import { Giver, Responder, provePairs } from "../src/games/dictator/model";
import { Trust, RETURN_SHARES, PROVE_TRUSTS } from "../src/games/trust-game/model";
import { Pasture, FEEL_PASTURE, PROVE_PASTURES } from "../src/games/tragedy-commons/model";
import { FIELD, TIT_FOR_TAT, ALWAYS_BREAK, ALWAYS_HOLD, play, tournament, headToHeadWins, tftAnswer, proveReadings } from "../src/games/axelrod-tit-for-tat/model";
import { Flow, LEVELS, BAND, PROVE_SKILLS } from "../src/games/flow-theory/model";
import { Design, FEEL_DESIGN, BUILDS, PROVE_DESIGNS } from "../src/games/design-ethics/model";
import { Lottery, utility, FEEL_GAMBLE, FEEL_SURES, PROVE_GAMBLES } from "../src/games/expected-utility/model";

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

console.log("bimatrix");
test("stable cells are the ones where both best replies meet", () => {
  const pd = new PayoffTable([[[3, 3], [0, 5]], [[5, 0], [1, 1]]], ["a", "b"], ["a", "b"]);
  assert.deepEqual(pd.stable(), [[1, 1]]);
  assert.equal(pd.max, 5);
});

console.log("focal points");
test("a lone odd option draws most of the crowd and an all alike row draws no one in particular", () => {
  const same = new Spread(Array.from({ length: 5 }, () => ({ ring: false, big: false })));
  assert.equal(same.focal(), null);
  assert.ok(same.matchChance() < 0.25, `${same.matchChance()}`);
  const odd = new Spread([{ ring: false, big: false }, { ring: true, big: false }, { ring: false, big: false }, { ring: false, big: false }, { ring: false, big: false }]);
  assert.equal(odd.focal(), 1);
  assert.ok(odd.shares()[1]! > 0.7 && odd.matchChance() > 0.55);
  near(odd.shares().reduce((a, b) => a + b, 0), 1);
});
test("feel rounds run from no focus to one focus, with two odd options in the middle ambiguous", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const r = focalFeel(new Rng(seed));
    assert.equal(r.length, 4);
    assert.equal(r[0]!.focal(), null);
    assert.notEqual(r[1]!.focal(), null);
    assert.equal(r[2]!.focal(), null);
    assert.notEqual(r[3]!.focal(), null);
    assert.ok(r[3]!.matchChance() > r[0]!.matchChance() * 2.5);
  }
});
test("prove puzzles always have one clear answer, and it moves", () => {
  const seen = new Set<number>();
  for (let seed = 1; seed <= 300; seed++) {
    const set = focalProve(new Rng(seed));
    for (const pz of set) {
      assert.equal(pz.spread.focal(), pz.answer, `seed ${seed}`);
      seen.add(pz.answer);
    }
  }
  assert.ok(seen.size >= 5);
});

console.log("chicken");
test("the standard payoffs make a chicken: two stable cells, each with exactly one swerver", () => {
  const c = new Chicken();
  assert.ok(c.T > c.R && c.R > c.S && c.S > c.P);
  assert.deepEqual(c.matrix().stable(), [[0, 1], [1, 0]]);
});
test("the best reply flips at the threshold, one half here", () => {
  const c = new Chicken();
  near(c.threshold, 0.5);
  assert.equal(c.bestReply(0.6), "swerve");
  assert.equal(c.bestReply(0.4), "dare");
  near(c.ev("dare", c.threshold), c.ev("swerve", c.threshold));
  assert.ok(DRIVER_RATES.some((q) => q > 0.5) && DRIVER_RATES.some((q) => q < 0.5));
});
test("committing to dare makes a rival swerve only while a crash is worse than yielding", () => {
  assert.deepEqual(COMMIT_CASES.map((c) => c.rivalReply()), ["swerve", "dare", "swerve"]);
  for (const c of COMMIT_CASES) {
    const m = c.matrix();
    const them = m.bestCols(1)[0]!;
    assert.equal(them === 0 ? "swerve" : "dare", c.rivalReply());
  }
});

console.log("battle of the sexes");
test("both meetings are stable, missing is not, and the threshold is lo over hi plus lo", () => {
  const o = new Outing(3, 2);
  assert.deepEqual(o.matrix().stable(), [[0, 0], [1, 1]]);
  near(o.threshold, 0.4);
  assert.equal(o.best(0.3), "football");
  assert.equal(o.best(0.5), "opera");
  assert.ok(PARTNER_ODDS.some((q) => q > 0.4) && PARTNER_ODDS.some((q) => q < 0.4));
});
test("prove tables have two stable cells that change place when the columns swap", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const [a, b] = proveTables(new Rng(seed)) as [ReturnType<typeof proveTables>[0], ReturnType<typeof proveTables>[0]];
    assert.deepEqual(a.stable, [[0, 0], [1, 1]]);
    assert.deepEqual(b.stable, [[0, 1], [1, 0]]);
  }
});

console.log("dictator");
test("generosity is the dictator gift and fear is only what refusal added", () => {
  const g = new Giver(1, 5);
  assert.equal(g.generosity, 1);
  assert.equal(g.fear, 4);
  assert.equal(new Giver(4, 3).fear, 0);
  assert.ok(new Responder(3).accepts(3) && !new Responder(3).accepts(2));
});
test("prove pairs: the kinder person is the one with the bigger dictator gift, never the bigger ultimatum offer", () => {
  for (let seed = 1; seed <= 300; seed++) {
    for (const p of provePairs(new Rng(seed))) {
      const k = p.kinder === "a" ? p.a : p.b;
      const l = p.kinder === "a" ? p.b : p.a;
      assert.ok(k.dictator > l.dictator);
      assert.ok(l.ultimatum > k.ultimatum, `seed ${seed}`);
    }
  }
});

console.log("trust game");
test("sending pays only when the share returned beats one over the multiplier", () => {
  const t = new Trust(3);
  near(t.breakEven, 1 / 3);
  near(t.final(10, 0.6), 18);
  near(t.final(10, 0), 0);
  near(t.final(10, 1 / 3), 10);
  assert.ok(t.pays(0.4) && !t.pays(0.3));
  assert.ok(RETURN_SHARES.some((r) => t.pays(r)) && RETURN_SHARES.some((r) => !t.pays(r)));
});
test("prove multipliers give break evens that are not a third", () => {
  const be = PROVE_TRUSTS.map((t) => t.breakEven);
  near(be[0]!, 0.5);
  near(be[1]!, 0.25);
  assert.ok(be.every((b) => Math.abs(b - 1 / 3) > 0.07));
});

console.log("tragedy of the commons");
test("the feel field is a tragedy: a second sheep always pays, yet all at two is worse than all at one", () => {
  const p = FEEL_PASTURE;
  assert.ok(p.twoDominates && p.tragic);
  near(p.allOne, 4);
  near(p.allTwo, 3);
  near(p.alone, 7);
  for (let k = 0; k <= 4; k++) assert.ok(p.payoff(2, k) > p.payoff(1, k));
});
test("prove fields: a tragedy, a rich field and a field where a second sheep never pays", () => {
  assert.deepEqual(PROVE_PASTURES.map((p) => p.tragic), [true, false, false]);
  assert.ok(PROVE_PASTURES[1]!.twoDominates && PROVE_PASTURES[1]!.allTwo > PROVE_PASTURES[1]!.allOne);
  assert.ok(!PROVE_PASTURES[2]!.twoDominates);
  assert.ok(new Pasture(13, 2, 5).tragic);
});

console.log("tit for tat");
test("tit for tat starts nice, copies the last move and forgives", () => {
  assert.deepEqual(tftAnswer(["break", "hold", "hold", "break", "hold"]), ["hold", "break", "hold", "hold", "break"]);
});
test("tit for tat never beats a rival head to head, yet wins the tournament", () => {
  const scores = tournament();
  const best = Math.max(...scores);
  assert.equal(FIELD[scores.indexOf(best)], TIT_FOR_TAT);
  assert.equal(scores.filter((s) => s === best).length, 1);
  assert.equal(headToHeadWins(TIT_FOR_TAT), 0);
  assert.ok(headToHeadWins(ALWAYS_BREAK) > 0);
});
test("always break exploits always hold, and tit for tat holds mutual cooperation", () => {
  const m = play(ALWAYS_BREAK, ALWAYS_HOLD);
  assert.equal(m.a, 50);
  assert.equal(m.b, 0);
  assert.equal(play(TIT_FOR_TAT, TIT_FOR_TAT).a, 30);
});
test("prove readings always include forgiveness and are distinct", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const [a, b] = proveReadings(new Rng(seed)) as [ReturnType<typeof proveReadings>[0], ReturnType<typeof proveReadings>[0]];
    assert.notEqual(a.theirs.join(), b.theirs.join());
    for (const r of [a, b]) {
      assert.equal(r.answer[0], "hold");
      assert.ok(r.theirs.some((m, i) => m === "break" && r.theirs[i + 1] === "hold" && r.answer[i + 2] === "hold"));
    }
  }
});

console.log("flow theory");
test("flow sits on the diagonal band, boredom below it and anxiety above", () => {
  assert.equal(Flow.state(5, 5), "flow");
  assert.equal(Flow.state(5 + BAND, 5), "flow");
  assert.equal(Flow.state(2, 5), "bored");
  assert.equal(Flow.state(8, 5), "anxious");
});
test("skill is where the hit rate crosses the mark, and the three levels span the scale", () => {
  near(Flow.skillFrom([{ c: 1.5, h: 1 }, { c: 5, h: 0.8 }, { c: 9, h: 0.3 }]), 5 + ((0.8 - 0.65) / 0.5) * 4);
  assert.equal(Flow.skillFrom([{ c: 1.5, h: 0.2 }, { c: 5, h: 0.1 }, { c: 9, h: 0 }]), 0);
  assert.equal(Flow.skillFrom([{ c: 1.5, h: 1 }, { c: 5, h: 0.9 }, { c: 9, h: 0.8 }]), 10);
  assert.ok(LEVELS[0]! < LEVELS[1]! && LEVELS[1]! < LEVELS[2]!);
  assert.ok(PROVE_SKILLS.every((s) => s > 2 && s < 8.5));
});

console.log("design ethics");
test("engagement only rises, benefit peaks and then falls, and the peak is not at the top", () => {
  const d = FEEL_DESIGN;
  for (let i = 1; i <= 20; i++) assert.ok(d.engagement(i / 20) > d.engagement((i - 1) / 20));
  assert.ok(d.care > 0.3 && d.care < 0.6);
  assert.ok(d.benefit(d.care) > d.benefit(1) * 3);
  assert.ok(d.benefit(1) > 0);
  const [gentle, standard, pushy] = BUILDS.map((b) => ({ e: d.engagement(b.x), b: d.benefit(b.x) })) as [{ e: number; b: number }, { e: number; b: number }, { e: number; b: number }];
  assert.ok(pushy.e > standard.e && standard.e > gentle.e);
  assert.ok(standard.b > gentle.b && standard.b > pushy.b * 2);
});
test("prove designs peak in different places, further apart than the tolerance", () => {
  const [a, b] = PROVE_DESIGNS.map((x) => x.care) as [number, number];
  assert.ok(Math.abs(a - b) > 0.12, `${a} ${b}`);
  for (const x of PROVE_DESIGNS) assert.ok(x.benefit(1) > 0 && x.care < 0.8);
  assert.ok(new Design(3, 0.5).care > 0);
});

console.log("expected utility");
test("a fifty fifty gamble for 100 has average 50, expected utility 5 and is worth 25 for sure", () => {
  const g = FEEL_GAMBLE;
  near(g.ev, 50);
  near(g.eu, 5);
  near(g.certainty, 25);
  assert.ok(g.prefersSure(30) && !g.prefersSure(20));
  assert.ok(FEEL_SURES.every((s) => s < g.ev));
  assert.ok(FEEL_SURES.some((s) => g.prefersSure(s)) && FEEL_SURES.some((s) => !g.prefersSure(s)));
});
test("prove gambles have certainty equivalents far from the average and from a half or a third", () => {
  for (const g of PROVE_GAMBLES) {
    assert.ok(g.certainty < g.ev * 0.6);
    near(utility(g.certainty), g.eu);
  }
  near(PROVE_GAMBLES[0]!.certainty, 16);
  near(PROVE_GAMBLES[1]!.certainty, 6.25);
  assert.ok(new Lottery(100, 16, 0.5).certainty > 40);
});

console.log("information types");
test("every Feel set has one round per corner, and the side is the bigger payoff", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const rounds = feelRounds(new Rng(seed));
    assert.equal(new Set(rounds.map((r) => `${r.seen}${r.known}`)).size, 4);
    for (const r of rounds) {
      assert.notEqual(r.pays[0], r.pays[1]);
      assert.equal(ringSide(r), r.pays[0] > r.pays[1] ? 0 : 1);
    }
  }
});
test("only the round with hidden moves and hidden payoffs cannot be decided", () => {
  const rounds = feelRounds(new Rng(4));
  for (const r of rounds) assert.equal(decidable(r), r.seen || r.known);
  assert.equal(rounds.filter((r) => !decidable(r)).length, 1);
  const r = rounds[0]!;
  assert.equal(outcome(r, ringSide(r)), 3);
  assert.equal(outcome(r, ringSide(r) === 0 ? 1 : 0), 0);
});
test("Prove scenes come from three different corners", () => {
  for (let seed = 1; seed <= 100; seed++) {
    const s = proveScenes(new Rng(seed));
    assert.equal(s.length, 3);
    assert.equal(new Set(s.map((x) => `${x.seen}${x.known}`)).size, 3);
  }
  assert.ok(SCENES.every((x) => !/[\u2014\u2013]/.test(x.name)));
});

console.log("short and long games");
test("holding wins once the horizon passes the break even, and not before", () => {
  const g = REPEAT_FEEL;
  assert.equal(g.breakEven, 3);
  assert.ok(g.hold(2) <= g.betray(2) && g.hold(3) > g.betray(3));
  for (const q of [...REPEAT_POOL, g]) {
    const n = q.breakEven;
    assert.ok(q.hold(n) > q.betray(n), `n ${n}`);
    assert.ok(n === 1 || q.hold(n - 1) <= q.betray(n - 1), `n-1 ${n - 1}`);
  }
});
test("Prove break evens are distinct from Feel and from each other, and fit the track", () => {
  const n = REPEAT_POOL.map((q) => q.breakEven);
  assert.ok(n.every((v) => v !== 3 && v <= 10));
  assert.ok(new Set(n).size >= 3);
  assert.ok(new Repeated().T > new Repeated().R);
});

console.log("iterated elimination");
test("generated tables solve to one cell in three or more strikes, and some strike needs an earlier one", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const m = solvableTable(new Rng(seed));
    const it = m.iterate();
    assert.equal(it.rows.length, 1);
    assert.equal(it.cols.length, 1);
    assert.ok(it.steps.length >= 3);
    assert.ok(m.isEquilibrium(it.rows[0]!, it.cols[0]!), "the survivor is an equilibrium");
    assert.ok(liveColumns(m).length >= 2);
  }
});
test("a wrong strike is refused with a counter case, a right one is accepted", () => {
  const m = solvableTable(new Rng(3));
  const it = m.iterate();
  const first = it.steps[0]!;
  const all = [0, 1, 2];
  assert.ok(tryStrike(m, all, all, first.kind, first.index).ok);
  let refused = 0;
  for (const kind of ["row", "col"] as const) for (const i of all) {
    const r = tryStrike(m, all, all, kind, i);
    if (!r.ok) {
      refused++;
      assert.ok(r.why !== undefined);
    }
  }
  assert.ok(refused >= 3);
});

console.log("nash equilibrium");
test("best replies and equilibria agree on a known table", () => {
  const m = new Bimatrix([[3, 0], [5, 1]], [[3, 5], [0, 1]]);
  assert.deepEqual(m.equilibria(), [[1, 1]]);
  const c = new Bimatrix([[2, 0], [0, 1]], [[1, 0], [0, 2]]);
  assert.deepEqual(c.equilibria(), [[0, 0], [1, 1]]);
  assert.deepEqual(c.deviations(0, 1), { row: 1, col: 0 });
  assert.deepEqual(c.deviations(0, 0), { row: null, col: null });
});
test("generated tables have exactly the requested equilibria and no ties", () => {
  for (let seed = 1; seed <= 40; seed++) for (const want of [1, 2]) {
    const m = equilibriumTable(new Rng(seed), want);
    assert.equal(m.equilibria().length, want);
    for (const [r, c] of m.equilibria()) assert.deepEqual(m.deviations(r, c), { row: null, col: null });
  }
  assert.ok(sameCells([[0, 1], [2, 2]], [[2, 2], [0, 1]]));
});

console.log("mixed strategy");
test("the indifference mix equalises both dives and is not one half", () => {
  const g = FEEL_PENALTY;
  near(g.against(g.indifference, 0), g.against(g.indifference, 1));
  near(g.indifference, 0.2 / 0.7, 1e-9);
  assert.ok(g.needsMixing);
  near(g.value, g.against(g.indifference, 0));
});
test("any other mix lets the keeper hold you below the value", () => {
  for (const g of [FEEL_PENALTY, ...PROVE_PENALTIES]) {
    const p = g.indifference;
    for (const q of [p - 0.2, p - 0.1, p + 0.1, p + 0.2]) {
      const worst = Math.min(g.against(q, 0), g.against(q, 1));
      assert.ok(worst < g.value - 1e-9, `${q}`);
    }
  }
});
test("Prove tables need mixing, differ from Feel, and the keeper reads a lean", () => {
  const ps = PROVE_PENALTIES.map((g) => g.indifference);
  for (const p of ps) assert.ok(Math.abs(p - FEEL_PENALTY.indifference) > 0.1 && Math.abs(p - 0.5) > 0.06 && p > 0.1 && p < 0.9, `${p}`);
  assert.equal(new Penalty(0.4, 0.9, 0.8, 0.6).keeperBest(0.9), 0);
  assert.equal(keeperDive([0, 0, 1], new Rng(1)), 0);
  assert.equal(keeperDive([1, 1, 0], new Rng(1)), 1);
});

console.log("minimax theorem");
test("the Feel table has a saddle where the two numbers agree", () => {
  const s = FEEL_TABLE.saddle();
  assert.ok(s);
  assert.equal(FEEL_TABLE.maximin().value, FEEL_TABLE.minimax().value);
  assert.equal(FEEL_TABLE.worstCol(1), 1);
  assert.deepEqual(s, [1, 1]);
});
test("generated tables have a unique saddle, and the saddle is also an equilibrium", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const m = saddleTable(new Rng(seed));
    const s = m.saddle()!;
    assert.ok(s);
    assert.ok(m.isEquilibrium(s[0], s[1]));
    assert.equal(m.mine(s[0], s[1]) + m.theirs(s[0], s[1]), 10);
  }
});
test("without a saddle the pure numbers differ, and mixing closes the gap", () => {
  const pennies = Bimatrix.constantSum([[10, 0], [0, 10]], 10);
  assert.equal(pennies.saddle(), null);
  assert.ok(pennies.maximin().value < pennies.minimax().value);
});

console.log("backward induction");
test("a pile is lost exactly at multiples of max plus one, solved from the end", () => {
  const p = new Pile(7, 2);
  const lost = [0, 1, 2, 3, 4, 5, 6, 7].map((n) => p.lost(n));
  assert.deepEqual(lost, [true, false, false, true, false, false, true, false]);
  // Cross check by brute force from the end.
  for (const max of [2, 3]) {
    const win: boolean[] = [false];
    for (let n = 1; n <= 20; n++) {
      let w = false;
      for (let t = 1; t <= Math.min(max, n); t++) if (!win[n - t]) w = true;
      win[n] = w;
      assert.equal(new Pile(n, max).lost(n), !w);
    }
  }
});
test("Feel starts on a won pile, and Prove cases have the stated winning take, with other limits than Feel", () => {
  assert.deepEqual(FEEL_PILE.winningTakes(7), [1]);
  for (const c of PILE_POOL) {
    assert.deepEqual(c.pile.winningTakes(c.pile.size), [c.answer]);
  }
  assert.ok(PILE_POOL.some((c) => c.pile.max === 3) && PILE_POOL.some((c) => c.pile.max === 2));
  assert.ok(new Set(PILE_POOL.map((c) => c.answer)).size >= 3);
});
test("the opponent wins whenever it can", () => {
  const p = new Pile(7, 2);
  assert.equal(p.reply(5, new Rng(1)), 2);
  assert.equal(p.reply(2, new Rng(1)), 2);
});

console.log("public goods");
test("each token costs you the multiplier over group size, though it adds the multiplier to the group", () => {
  const g = FEEL_POT;
  near(g.perToken, 0.5);
  near(g.payoff(10, 15) - g.payoff(0, 15), -5);
  near(g.groupTotal(20) - g.groupTotal(10), 10);
  assert.ok(!g.givingPays());
});
test("giving pays you only when r exceeds n, at the break even r equals n", () => {
  for (const n of PROVE_SIZES) {
    assert.ok(!new Pot(n, n).givingPays());
    assert.ok(new Pot(n, n + 0.5).givingPays());
    near(new Pot(n, n).netCost, 0);
  }
  assert.ok(!PROVE_SIZES.includes(4) && PROVE_SIZES.every((n) => n >= 3 && n <= 8));
});

console.log("centipede");
test("backward induction in Feel ends at node 1, though passing twice pays more", () => {
  assert.equal(CENTI_FEEL.logicalEnd, 1);
  assert.deepEqual(CENTI_FEEL.solve().pay, [4, 1]);
  assert.deepEqual(CENTI_FEEL.compare(3), { take: 32, pass: 16 });
  assert.deepEqual(CENTI_FEEL.compare(2), { take: 16, pass: 8 });
  assert.ok(playFeel(false, true).pay[0] > playFeel(true, true).pay[0]);
  assert.deepEqual(playFeel(false, false).pay, [8, 32]);
});
test("generated games end where asked, with no ties", () => {
  for (const want of [1, 2, 3, 4]) {
    for (let seed = 1; seed <= 6; seed++) {
      const g = centiGenerate(new Rng(seed * 7 + want), want);
      assert.equal(g.logicalEnd, want);
    }
  }
  const g = new Centipede([[1, 1], [1, 1], [1, 1], [1, 1]], [1, 1]);
  assert.equal(g.solve().strict, false);
});

console.log("traveler's dilemma");
test("with a bonus above one the best reply undercuts by one, all the way to the floor", () => {
  const g = TRAVEL_FEEL;
  assert.equal(g.bestReply(10), 9);
  assert.deepEqual(g.staircase(10), [10, 9, 8, 7, 6, 5, 4, 3, 2]);
  assert.equal(g.payoff(9, 10), 11);
  assert.equal(g.payoff(10, 9), 7);
});
test("with a small bonus matching is the best reply and nothing unravels", () => {
  const g = new Travelers(2, 10, 0.5);
  assert.equal(g.bestReply(7), 7);
  assert.deepEqual(g.staircase(9), [9]);
});
test("Prove cases hold their answers and differ from Feel's undercut by one at least once", () => {
  for (const c of TRAVEL_POOL) assert.equal(c.game.bestReply(c.partner), c.answer);
  assert.ok(TRAVEL_POOL.some((c) => c.answer === c.partner) && TRAVEL_POOL.some((c) => c.answer === c.partner - 1));
});

console.log(`\n${passed} tests passed`);
