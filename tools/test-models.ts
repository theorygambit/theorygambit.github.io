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
import { FEEL_CONTEST, crowd, PROVE_POOL as BC_POOL, pickPuzzles as pickBC, PROVE_TOLERANCE as BC_TOL } from "../src/games/beauty-contest/model";
import { Volunteer, FEEL_GAME, PROVE_POOL as VOL_POOL, pickPuzzles as pickVol } from "../src/games/volunteers-dilemma/model";
import { RepeatedDilemma, GrimOpponent, FEEL_CASE, PROVE_POOL as DILEMMA_POOL, PROVE_TOLERANCE, proveSet as dilemmaSet } from "../src/games/repeated-games/model";
import { Pond, FEEL_POND, FEEL_PERIODS, PROVE_POOL as POND_POOL, PROVE_TOLERANCE as POND_TOL, proveSet as pondSet } from "../src/games/dynamic-games/model";
import { PriceWar, PriceCase, FEEL_COST, WAR, proveSet as priceProveSet } from "../src/games/bertrand/model";
import { Street, SEE_START, GRID, proveSet as streetProveSet } from "../src/games/hotelling/model";
import { DollarAuction, Escalation, FEEL_AUCTION, BUDGETS, PROVE_POOL, proveSet as auctionProveSet } from "../src/games/dollar-auction/model";
import { Blotto, FEEL_TYPES, FEEL_TROOPS, PROVE_POOL as blottoPool, feelOpponents, proveSet as blottoProveSet } from "../src/games/colonel-blotto/model";
import { Duopoly, FEEL as COURNOT_FEEL, PROVE_SYMMETRIC, PROVE_ASYMMETRIC, rivalQuantity, staircase, isRight as cournotRight, axisMax as cournotAxis } from "../src/games/cournot/model";
import { FEEL as LEADER_FEEL, LEAD_POOL, FOLLOW_POOL, answer as leaderAnswer, isRight as leaderRight, proveSet as leaderProveSet } from "../src/games/stackelberg/model";
import { Elo, FEEL_ELO, FEEL_START, FEEL_OPPONENTS, play as eloPlay, PROVE_POOL as ELO_POOL, answer as eloAnswer, isRight as eloRight, proveSet as eloProveSet } from "../src/games/elo-trueskill/model";
import { Challenge, FEEL_SKILL, TARGET, thermostat, PROVE_POOL as DDA_POOL, answer as ddaAnswer, isRight as ddaRight, proveSet as ddaProveSet } from "../src/games/dynamic-difficulty/model";
import { Cohort, HORIZON, FEEL_PAIRS as LTV_PAIRS, feelPairs as ltvFeelPairs, PROVE_POOL as LTV_POOL, answer as ltvAnswer, isRight as ltvRight, proveSet as ltvProveSet } from "../src/games/ltv-prediction/model";
import { FEEL_LIST as RULES_FEEL, FEEL_PLAYERS as RULES_PLAYERS, SEE_PLAYER, PROVE_POOL as RULES_POOL, TRAITS, feelPlayers as rulesFeelPlayers, proveSet as rulesProveSet } from "../src/games/rules-engines/model";
import { FEEL as STACK_FEEL, MAX_LAYERS, PROVE_MAX, PROVE_POOL as STACK_POOL, answer as stackAnswer, proveSet as stackProveSet } from "../src/games/engagement-stack/model";
import { FEEL as LIGHT_FEEL, FEEL_A, PROFILES as LIGHT_PROFILES, feelSignals as lightSignals, PROVE_POOL as LIGHT_POOL, isRight as lightRight, proveSet as lightProveSet } from "../src/games/correlated-equilibrium/model";
import { FEEL_MARKETS as ENTRY_FEEL, SEE_MARKET as ENTRY_SEE, PROVE_CREDIBLE as ENTRY_CRED, PROVE_EMPTY as ENTRY_EMPTY, feelMarkets as entryFeel, proveSet as entryProveSet } from "../src/games/subgame-perfect/model";
import { FEEL as TREM_FEEL, FEEL_SAFE as TREM_SAFE, PROVE_TABLES as TREM_TABLES, proveSet as tremProveSet, feelSlips as tremFeelSlips } from "../src/games/trembling-hand/model";
import { Belief as SeqBelief, FEEL as SEQ_FEEL, FEEL_BELIEFS as SEQ_BELIEFS, PROVE_POOL as SEQ_POOL, feelBeliefs as seqFeel, proveSet as seqProveSet } from "../src/games/sequential-equilibrium/model";
import { Market as PbMarket, FEEL as PB_FEEL, HIRE as PB_HIRE, PASS as PB_PASS, hireValue as pbHire, bestMove as pbBest, PROVE_POOL as PB_POOL, proveSet as pbProveSet, isRight as pbRight, feelSignals as pbSignals } from "../src/games/perfect-bayesian/model";
import { LANES, ALONE, flipPuzzles } from "../src/games/what-is-a-game/model";
import { Contest, PUZZLES as CONTEST_PUZZLES, bestFor, TOLERANCE as CONTEST_TOL } from "../src/games/rationality-common-knowledge/model";
import { randomTree, bestReply, outcome as outcome_t6, columnOf, mapPuzzles } from "../src/games/normal-vs-extensive/model";
import { isConstantSum, afterTug, puzzleSet as sumPuzzles } from "../src/games/zero-sum/model";
import { surplus, acceptable, range as dealRange, FEEL_DEALS, PROVE_DEALS } from "../src/games/positive-sum/model";
import { payoff as fightPayoff, destroyed, worseForBoth, selectPuzzle } from "../src/games/negative-sum/model";
import { BATTLE, newGame as newOrderGame } from "../src/games/simultaneous-sequential/model";
import { PublicGood, FEEL_R, PROVE_R } from "../src/games/players-count/model";
import { quadrantOf, FEEL_SCENES as TAX_FEEL, proveScenes as proveScenes_t6 } from "../src/games/taxonomy/model";
import { dominates as dominates_t6, isEfficient, efficientSet, slide, onFrontier, inRegion, STARTS, puzzle as paretoPuzzle } from "../src/games/pareto-efficiency/model";
import { Talk as CtTalk, literal as ctLiteral, pay as ctPay, FEEL_ROUNDS as CT_ROUNDS, PROVE_POOL as CT_POOL, proveSet as ctProveSet, isRight as ctRight } from "../src/games/cheap-talk/model";
import { Persuasion as BpPersuasion, FEEL_PRIORS as BP_PRIORS, SEE_PRIOR as BP_SEE, PROVE_POOL as BP_POOL, proveSet as bpProveSet, isRight as bpRight } from "../src/games/bayesian-persuasion/model";
import { Cake as MdCake, FEEL_N as MD_N, FEEL_ROUNDS as MD_ROUNDS, PROVE_N as MD_PROVE_N, proveSet as mdProveSet, answer as mdAnswer } from "../src/games/mechanism-design/model";
import { Bidder as RpBidder, HALF as RP_HALF, FEEL_ROUNDS as RP_ROUNDS, PROVE_POOL as RP_POOL, proveSet as rpProveSet, machineBid as rpBid, isRight as rpRight } from "../src/games/revelation-principle/model";
import { Sale as VcgSale, FEEL_ROUNDS as VCG_ROUNDS, SEE as VCG_SEE, PROVE_POOL as VCG_POOL, proveSet as vcgProveSet, owed as vcgOwed, isRight as vcgRight } from "../src/games/vcg/model";
import { Trio as CoreTrio, FEEL_ROUNDS as CORE_ROUNDS, SEE as CORE_SEE, PROVE_POOL as CORE_POOL, proveSet as coreProveSet } from "../src/games/core/model";
import { FEEL_ROUNDS as SH_ROUNDS, SEE as SH_SEE, PROVE_POOL as SH_POOL, proveSet as shProveSet, isRight as shRight } from "../src/games/shapley-value/model";
import { Council as BzCouncil, FEEL_ROUNDS as BZ_ROUNDS, SEE as BZ_SEE, PROVE_POOL as BZ_POOL, proveSet as bzProveSet, answer as bzAnswer, isRight as bzRight } from "../src/games/banzhaf-index/model";
import { Bloc as NuBloc, FEEL_ROUNDS as NU_ROUNDS, SEE as NU_SEE, PROVE_POOL as NU_POOL, calm as nuCalm, proveSet as nuProveSet, isRight as nuRight } from "../src/games/nucleolus/model";
import { FEEL_ROUNDS as NB_ROUNDS, SEE as NB_SEE, PROVE_POOL as NB_POOL, proveSet as nbProveSet, isRight as nbRight } from "../src/games/nash-bargaining/model";
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
import { FEEL_GAME as EVO_FEEL, PROVE_POOL as EVO_POOL } from "../src/games/evolutionary-game-theory/model";
import { Lemons, FEEL_MARKET, randomMarket as lemonMarket } from "../src/games/lemons-adverse-selection/model";
import { FirstPrice, PROVE_POOL as AUCTION_POOL } from "../src/games/auctions/model";
import { blocking, isStable, deferredAcceptance, randomMarket as matchMarket } from "../src/games/matching/model";
import { FEEL_GAME as COOP_FEEL, PROVE_POOL as COOP_POOL } from "../src/games/cooperative-games/model";
import { Value, FEEL_FLIPS, PROVE_POOL as PROSPECT_POOL } from "../src/games/prospect-theory/model";
import { Allais, FEEL_ALLAIS, PROVE_POOL as ALLAIS_POOL } from "../src/games/allais-paradox/model";
import { Streak, FEEL_STREAK, FEEL_EFFORTS, PROVE_POOL as STREAK_POOL } from "../src/games/loss-aversion-streaks/model";
import { dominates, decoy, triple, FEEL_PAIR, FEEL_DECOY } from "../src/games/preference-manipulation/model";
import { Beauty, FEEL_BEAUTY, PROVE_POOL as BEAUTY_POOL } from "../src/games/behavioral-game-theory/model";
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

// frag:beauty-contest
console.log("beauty contest");
test("level guesses climb down by the factor and the target is a share of the mean", () => {
  near(FEEL_CONTEST.levelGuess(0), 50);
  near(FEEL_CONTEST.levelGuess(1), 100 / 3, 1e-9);
  near(FEEL_CONTEST.levelGuess(2), 200 / 9, 1e-9);
  near(FEEL_CONTEST.target([30, 60]), 30, 1e-9);
  assert.equal(FEEL_CONTEST.winner([10, 28, 50, 90]), 1);
});
test("the learning crowd falls round to round and the winning guess sits far below 33", () => {
  let sum = [0, 0, 0];
  let win = 0;
  for (let s = 1; s <= 100; s++) {
    const r = new Rng(s);
    const means = [0, 1, 2].map((k) => FEEL_CONTEST.mean(crowd(r, k)));
    assert.ok(means[0]! > means[1]! && means[1]! > means[2]!, `seed ${s}: ${means}`);
    means.forEach((m, i) => (sum[i]! += m));
    win += FEEL_CONTEST.target(crowd(r, 0));
  }
  assert.ok(sum[0]! / 100 > 30 && sum[2]! / 100 < 25, `${sum.map((x) => x / 100)}`);
  assert.ok(win / 100 < 26);
});
test("beauty prove pool answers are 50 f^(steps+1), unlike naive 50 f and unlike the Feel winner 22", () => {
  assert.ok(BC_POOL.length >= 4);
  for (const p of BC_POOL) {
    near(p.answer, 50 * Math.pow(p.f, p.crowdSteps + 1), 1e-9);
    assert.ok(Math.abs(p.answer - 22) > BC_TOL + 2, `${p.label} passes with 22`);
    assert.ok(Math.abs(p.answer - 50 * p.f) > BC_TOL + 2);
  }
});
test("two beauty puzzles use different factors and different answers, many seeds", () => {
  for (let s = 1; s <= 200; s++) {
    const r = new Rng(s);
    const [a, b] = pickBC((xs) => r.pick(xs));
    assert.notEqual(a.f, b.f);
    assert.ok(Math.abs(a.answer - b.answer) >= 6);
  }
});

// frag:volunteers-dilemma
console.log("volunteer's dilemma");
test("p* makes waiting and stepping up pay the same", () => {
  for (const g of [FEEL_GAME, new Volunteer(3, 9, 4), new Volunteer(8, 5, 2)]) {
    near(g.waitPay(g.pStar), g.volunteerPay, 1e-9);
  }
});
test("the chance that all the others wait is pinned at cost over benefit for every group size", () => {
  for (let n = 2; n <= 12; n++) near(FEEL_GAME.with(n).othersWait(FEEL_GAME.with(n).pStar), 1 / 3, 1e-9);
});
test("more people means less help: each steps up less, and nobody helps more often, toward cost over benefit", () => {
  let prevP = 2;
  let prevNobody = -1;
  for (let n = 2; n <= 40; n++) {
    const g = FEEL_GAME.with(n);
    assert.ok(g.pStar < prevP);
    assert.ok(g.nobodyAtStar > prevNobody);
    near(g.nobody(g.pStar), g.nobodyAtStar, 1e-9);
    prevP = g.pStar;
    prevNobody = g.nobodyAtStar;
  }
  near(FEEL_GAME.with(400).nobodyAtStar, 1 / 3, 0.01);
  near(FEEL_GAME.pStar, 1 - Math.pow(1 / 3, 1 / 4), 1e-9);
});
test("volunteer prove pool has the stated clean answers, and the Feel answer fails every one", () => {
  assert.equal(VOL_POOL.length, 7);
  const wants = [0.5, 2 / 3, 0.5, 2 / 3, 1 / 3, 0.5, 1 / 3];
  VOL_POOL.forEach((p, i) => {
    near(p.answer, wants[i]!, 1e-9);
    assert.ok(Math.abs(FEEL_GAME.pStar - p.answer) > 0.06, `feel answer passes puzzle ${i}`);
  });
});
test("two prove puzzles differ in answer and are never repeated", () => {
  for (let s = 1; s <= 200; s++) {
    const r = new Rng(s);
    const [a, b] = pickVol((xs) => r.pick(xs));
    assert.notEqual(a, b);
    assert.ok(Math.abs(a.answer - b.answer) >= 0.1);
  }
});

// frag:repeated-games
console.log("repeated games");
test("hold and break values match the long sum, and the threshold is (T - R) / (T - P)", () => {
  const g = new RepeatedDilemma(5, 3, 1);
  for (const d of [0.2, 0.5, 0.9]) {
    let hold = 0;
    let brk = 0;
    for (let t = 0; t < 4000; t++) {
      hold += g.stream("hold", t) * d ** t;
      brk += g.stream("break", t) * d ** t;
    }
    near(hold, g.holdValue(d), 1e-6);
    near(brk, g.breakValue(d), 1e-6);
  }
  near(g.threshold, 0.5);
  near(g.holdValue(0.5), g.breakValue(0.5));
});
test("holding is worth at least breaking exactly when patience reaches the threshold", () => {
  for (const c of DILEMMA_POOL) {
    const g = new RepeatedDilemma(c.T, c.R, c.P);
    for (let d = 0; d < 0.97; d += 0.01) assert.equal(g.holdValue(d) >= g.breakValue(d) - 1e-9, d >= g.threshold - 1e-9, `${c.T} ${c.R} ${c.P} at ${d}`);
    assert.equal(g.sustainable(g.threshold), true);
  }
});
test("the grim opponent holds until the first break, then breaks forever", () => {
  const o = new GrimOpponent();
  assert.equal(o.move(), "hold");
  o.observe("hold");
  assert.equal(o.move(), "hold");
  o.observe("break");
  for (let i = 0; i < 5; i++) {
    assert.equal(o.move(), "break");
    o.observe("hold");
  }
});
test("Feel payoffs form a dilemma and breaking once beats holding for one round", () => {
  const g = FEEL_CASE;
  assert.ok(g.T > g.R && g.R > g.P && g.P > g.S);
  assert.deepEqual(g.payoff("break", "hold"), [5, 0]);
  assert.deepEqual(g.payoff("hold", "break"), [0, 5]);
  near(g.threshold, 0.5);
});
test("Prove pool thresholds are the stated answers, and the Feel threshold fails every one", () => {
  const want = [1 / 3, 0.6, 0.625, 1 / 3, 0.4];
  DILEMMA_POOL.forEach((c, i) => {
    const g = new RepeatedDilemma(c.T, c.R, c.P);
    near(g.threshold, want[i]!, 1e-9);
    assert.ok(Math.abs(FEEL_CASE.threshold - g.threshold) > PROVE_TOLERANCE, `Feel answer would pass ${c.T} ${c.R} ${c.P}`);
  });
});
test("a Prove set has two clearly different thresholds and replays avoid the last pair", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const a = dilemmaSet(new Rng(seed));
    assert.ok(Math.abs(a.games[0]!.threshold - a.games[1]!.threshold) >= 0.1);
    const b = dilemmaSet(new Rng(seed), a.key);
    assert.notEqual(b.key, a.key);
  }
});

// frag:dynamic-games
console.log("dynamic games");
test("the pond grows back from what is left, up to capacity", () => {
  const p = new Pond(10, 2, 2);
  assert.deepEqual(p.step(10, 3), { took: 3, rival: 2, left: 5, next: 10 });
  assert.deepEqual(p.step(10, 5), { took: 5, rival: 2, left: 3, next: 6 });
  assert.deepEqual(p.step(10, 10), { took: 10, rival: 0, left: 0, next: 0 });
  assert.equal(p.step(4, 9).took, 4);
});
test("the yield is the largest steady harvest that refills the pond, found by brute force", () => {
  for (const c of [{ K: 10, g: 2, r: 2 }, ...POND_POOL]) {
    const p = new Pond(c.K, c.g, c.r);
    let best = 0;
    for (let h = 0; h <= c.K; h += 0.01) if (p.next(c.K, h) >= c.K - 1e-9) best = h;
    near(best, p.yield, 0.011);
  }
  near(FEEL_POND.yield, 3);
});
test("taking more than the yield shrinks the pond every period, at or below keeps it full", () => {
  for (const c of POND_POOL) {
    const p = new Pond(c.K, c.g, c.r);
    let s = c.K;
    for (let i = 0; i < 4; i++) {
      const n = p.next(s, p.yield + 1);
      assert.ok(n < s - 1e-9 || n === 0, `${c.K} ${c.g} ${c.r}`);
      s = n;
    }
    s = c.K;
    for (let i = 0; i < 6; i++) s = p.next(s, p.yield);
    near(s, c.K);
  }
});
test("backward induction: steady play then cashing out beats greed, and the last period takes everything", () => {
  const p = FEEL_POND;
  const best = p.best(10, FEEL_PERIODS);
  assert.equal(best, p.yield * (FEEL_PERIODS - 1) + 10);
  assert.equal(p.best(10, 1), 10);
  const greedy = p.step(10, 10).took + p.best(p.step(10, 10).next, FEEL_PERIODS - 1);
  assert.ok(best > greedy * 2, `${best} vs ${greedy}`);
  for (const n of [3, 4, 5]) assert.ok(p.best(10, n) > 10 + p.best(0, n - 1));
});
test("Prove pool yields are the stated answers, and the Feel yield fails every one", () => {
  const want = [2, 6, 5, 6, 4];
  POND_POOL.forEach((c, i) => {
    const p = new Pond(c.K, c.g, c.r);
    near(p.yield, want[i]!, 1e-9);
    assert.ok(Math.abs(FEEL_POND.yield - p.yield) > POND_TOL, `Feel yield would pass ${c.K} ${c.g} ${c.r}`);
  });
});
test("a Prove set has two different yields and replays avoid the last pair", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const a = pondSet(new Rng(seed));
    assert.ok(Math.abs(a.ponds[0]!.yield - a.ponds[1]!.yield) >= 1);
    assert.notEqual(pondSet(new Rng(seed), a.key).key, a.key);
  }
});

// frag:bertrand
console.log("bertrand");
test("the cheaper firm takes every buyer, a tie splits them, a price above value sells nothing", () => {
  const w = new PriceWar();
  assert.equal(w.won(4, 5), 10);
  assert.equal(w.won(5, 5), 5);
  assert.equal(w.won(6, 5), 0);
  assert.equal(w.won(11, 12), 0);
  assert.equal(w.profit(4, 5, 2), 20);
  assert.equal(w.profit(5, 5, 2), 15);
});
test("the best reply to any rival price above cost plus one is one tick under it, found by brute force", () => {
  for (let r = FEEL_COST + 2; r <= 10; r++) assert.equal(WAR.bestReply(r, FEEL_COST), r - 1, `rival ${r}`);
  assert.equal(WAR.bestReply(FEEL_COST + 1, FEEL_COST), FEEL_COST + 1, "one tick above cost you match, undercutting earns nothing");
});
test("two firms at cost is an equilibrium: no price earns more than nothing", () => {
  for (const c of [2, 3, 4, 5]) {
    const stay = WAR.profit(c, c, c);
    assert.equal(stay, 0);
    for (const p of WAR.prices(c)) assert.ok(WAR.profit(p, c, c) <= stay + 1e-9, `cost ${c} price ${p}`);
  }
});
test("the Feel rival goes one tick under your last price and stops one tick above cost", () => {
  assert.equal(WAR.feelRival(0, null, 2), 9);
  assert.equal(WAR.feelRival(1, 7, 2), 6);
  assert.equal(WAR.feelRival(2, 3, 2), 3);
  assert.equal(WAR.feelRival(3, 2, 2), 3);
});
test("a cheaper firm prices one tick under the rival's cost, and that is the unique best reply", () => {
  for (const [m, t] of [[3, 6], [4, 7], [3, 7], [5, 8]] as const) {
    const c = new PriceCase("cheaper", m, t);
    assert.equal(WAR.bestReply(t, m), t - 1);
    assert.equal(c.answer, t - 1);
    for (const p of WAR.prices(m)) if (p !== c.answer) assert.ok(c.profitAt(p) < c.bestProfit, `${m},${t} price ${p}`);
  }
});
test("prove cases: right answers pass, the Feel answer fails every one, and the order is same then cheaper", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const set = priceProveSet(new Rng(seed));
    assert.equal(set.length, 2);
    assert.equal(set[0]!.kind, "same");
    assert.equal(set[1]!.kind, "cheaper");
    for (const c of set) {
      assert.ok(c.accepts(c.answer));
      assert.ok(!c.accepts(FEEL_COST), "the Feel price of 2 must fail");
      assert.ok(!c.accepts(c.answer + 3));
      assert.ok(c.mine !== FEEL_COST);
    }
    assert.ok(!set[1]!.accepts(set[1]!.mine), "pricing at your own cost is not the answer");
    assert.ok(!set[1]!.accepts(set[1]!.theirs), "matching their cost is not the answer");
    assert.ok(set[0]!.accepts(set[0]!.mine + 1));
    assert.ok(!set[0]!.accepts(set[0]!.mine + 2));
  }
});

// frag:hotelling
console.log("hotelling");
test("share: each customer goes to the nearer shop and a tie splits", () => {
  const s = Street.uniform(20);
  near(s.share(0.25, 0.75), 0.5);
  near(s.share(0.5, 0.5), 0.5);
  near(s.share(0.1, 0.9) + s.share(0.9, 0.1), 1);
  assert.ok(s.share(0.4, 0.8) > s.share(0.1, 0.8));
});
test("the best reply to a rival off the middle is one step beside them, toward the larger side", () => {
  const s = Street.uniform(20);
  assert.equal(s.bestReply(0.2), 0.25);
  assert.equal(s.bestReply(0.8), 0.75);
  assert.equal(s.bestReply(0.05), 0.1);
});
test("best reply by brute force beats every other grid spot", () => {
  const s = Street.uniform(20);
  for (const b of s.positions()) {
    const r = s.bestReply(b);
    for (const a of s.positions()) assert.ok(s.held(r, b) >= s.held(a, b) - 1e-9, `rival ${b} spot ${a}`);
  }
});
test("leapfrogging from the See start ends with both shops at the middle", () => {
  const s = Street.uniform(20);
  let you: number = SEE_START.you;
  let they: number = SEE_START.they;
  let taps = 0;
  while (!s.settled(you, they) && taps < 40) {
    if (taps % 2 === 0) they = s.move(they, you);
    else you = s.move(you, they);
    taps++;
  }
  assert.ok(taps >= 5 && taps <= 14, `taps ${taps}`);
  assert.ok(Math.abs(you - 0.5) <= GRID + 1e-9 && Math.abs(they - 0.5) <= GRID + 1e-9);
});
test("both shops at the median is an equilibrium: no spot holds more than half, give or take one customer", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const s = Street.skewed(new Rng(seed), seed % 2 ? "left" : "right");
    const m = s.median();
    const base = s.held(m, m);
    for (const a of s.positions(0.01)) assert.ok(s.held(a, m) <= base + 1 + 1e-9, `seed ${seed} spot ${a}`);
  }
});
test("skewed crowds put the median far from the middle, and a Prove pair has medians on opposite sides", () => {
  for (let seed = 1; seed <= 60; seed++) {
    const [a, b] = streetProveSet(new Rng(seed)) as [ReturnType<typeof streetProveSet>[0], ReturnType<typeof streetProveSet>[0]];
    assert.ok(Math.abs(a.median - 0.5) >= 0.12 && Math.abs(b.median - 0.5) >= 0.12, `seed ${seed}`);
    assert.ok(Math.abs(a.median - b.median) >= 0.15, `seed ${seed} medians ${a.median} ${b.median}`);
    assert.ok(!a.accepts(0.5) && !b.accepts(0.5), "the Feel answer of the middle must fail");
    assert.ok(a.accepts(a.median) && !a.accepts(b.median));
  }
});
test("counts left and right of the median are balanced", () => {
  const s = Street.skewed(new Rng(3), "left");
  assert.ok(Math.abs(s.below(s.median()) - s.above(s.median())) <= 1);
});

// frag:dollar-auction
console.log("dollar auction");
test("winner, runner up and pair results: the runner up pays too", () => {
  const a = new DollarAuction(100, 10);
  assert.equal(a.winnerNet(60), 40);
  assert.equal(a.loserNet(60), -50);
  assert.equal(a.take(60), 110);
  assert.equal(a.pairNet(60), -10);
  assert.equal(a.pairNet(50), 10);
});
test("break even bid is the first top bid where both bids together beat the prize, found by brute force", () => {
  assert.equal(FEEL_AUCTION.breakEvenBid(), 60);
  for (const c of [{ prize: 100, step: 10 }, ...PROVE_POOL]) {
    const a = new DollarAuction(c.prize, c.step);
    let first = 0;
    for (let b = c.step; b <= c.prize * 3; b += c.step) if (a.take(b) > c.prize) { first = b; break; }
    assert.equal(a.breakEvenBid(), first, `${c.prize} ${c.step}`);
    assert.ok(a.pairNet(first) < 0 && a.pairNet(first - c.step) >= 0 || first === c.step);
  }
});
test("once the top bid passes the prize even the winner loses, and the bidders always lose together past break even", () => {
  for (let b = 110; b <= 200; b += 10) assert.ok(FEEL_AUCTION.winnerNet(b) < 0);
  for (let b = 60; b <= 200; b += 10) assert.ok(FEEL_AUCTION.pairNet(b) < 0);
});
test("escalation: the rival raises while its budget allows, then quits and you win at a loss", () => {
  for (const budget of BUDGETS) {
    const e = new Escalation(FEEL_AUCTION, budget);
    e.open();
    assert.equal(e.you, 10);
    assert.equal(e.rival, 20);
    let guard = 0;
    while (e.over === "none" && guard++ < 50) {
      e.raise();
      e.respond();
    }
    assert.equal(e.over, "won");
    assert.ok(e.rival <= budget && e.you + 10 > budget);
    assert.ok(e.youNet() < 0, "even winning the dollar costs more than it pays");
    assert.equal(e.take, e.you + e.rival);
  }
});
test("walking away early costs only your last bid", () => {
  const e = new Escalation(FEEL_AUCTION, 140);
  e.open();
  e.walk();
  assert.equal(e.youNet(), -10);
  assert.equal(e.rivalNet(), 80);
});
test("Prove cases never repeat the Feel answer, and a pair has two different answers", () => {
  for (const c of PROVE_POOL) assert.notEqual(new DollarAuction(c.prize, c.step).breakEvenBid(), 60);
  for (let seed = 1; seed <= 80; seed++) {
    const [a, b] = auctionProveSet(new Rng(seed)) as [DollarAuction, DollarAuction];
    assert.notEqual(a.breakEvenBid(), b.breakEvenBid());
    assert.notEqual(a.breakEvenBid(), 60);
    assert.notEqual(b.breakEvenBid(), 60);
  }
});

// frag:colonel-blotto
console.log("colonel blotto");
test("a field goes to the larger side, a tie goes to nobody, the war to the side holding more", () => {
  assert.equal(Blotto.held([5, 5, 2], [4, 4, 4]), 2);
  assert.equal(Blotto.held([4, 4, 4], [4, 4, 4]), 0);
  assert.equal(Blotto.wins([5, 5, 2], [4, 4, 4]), true);
  assert.equal(Blotto.wins([4, 4, 4], [4, 4, 4]), false);
  assert.equal(Blotto.wins([6, 0, 0], [0, 6, 0]), false);
});
test("the lattice of 12 troops has 91 splits and each sums to 12", () => {
  const l = new Blotto(12).lattice();
  assert.equal(l.length, 91);
  for (const a of l) assert.equal(a[0] + a[1] + a[2], 12);
});
test("every split of 12 can be beaten by another split of 12", () => {
  const b = new Blotto(12);
  for (const opp of b.lattice()) assert.ok(b.counters(opp).length > 0, `${opp}`);
});
test("the Feel opponents sum to 12 and each has a beating split", () => {
  const b = new Blotto(FEEL_TROOPS);
  for (const t of FEEL_TYPES) {
    assert.equal(t[0] + t[1] + t[2], 12);
    assert.ok(b.counters(t).length > 0, `${t}`);
    assert.ok(b.cheapestCounter(t) !== null);
  }
});
test("cheapest counter wins and spends every troop", () => {
  for (const t of FEEL_TYPES) {
    const c = new Blotto(12).cheapestCounter(t)!;
    assert.equal(c[0] + c[1] + c[2], 12);
    assert.equal(Blotto.wins(c, t), true);
  }
});
test("every Prove puzzle has a winning split and uses new totals or opponents", () => {
  for (const p of blottoPool) {
    const b = new Blotto(p.you);
    assert.ok(b.counters(p.opp).length > 0, `${p.you} ${p.opp}`);
    assert.ok(b.cheapestCounter(p.opp) !== null);
  }
  assert.ok(blottoPool.every((p) => p.you !== 12 || !FEEL_TYPES.some((t) => t.join() === p.opp.join())));
});
test("Feel and Prove sets draw four and two distinct cases", () => {
  const rng = new Rng(7);
  assert.equal(feelOpponents(rng).length, 4);
  const s = blottoProveSet(rng);
  assert.equal(s.length, 2);
  assert.notEqual(s[0], s[1]);
});
test("region that beats (4,4,4) is not empty", () => {
  assert.ok(new Blotto(12).counters([4, 4, 4]).length > 0);
});

// frag:cournot
console.log("cournot");
test("best reply is half of what the rival leaves, and the equilibrium is where both replies hold", () => {
  const d = COURNOT_FEEL;
  near(d.bestReply(1, 30), 30);
  near(d.bestReply(1, 0), 45);
  const e = d.equilibrium();
  near(e.q1, 30);
  near(d.bestReply(1, e.q2), e.q1);
  near(d.bestReply(2, e.q1), e.q2);
  near(d.profit(1, e.q1, e.q2), 900);
  for (const m of [...PROVE_SYMMETRIC, ...PROVE_ASYMMETRIC]) {
    const q = m.equilibrium();
    near(m.bestReply(1, q.q2), q.q1, 1e-9);
    near(m.bestReply(2, q.q1), q.q2, 1e-9);
  }
});
test("joint monopoly pays each firm more, yet each would deviate from it", () => {
  const d = COURNOT_FEEL;
  const each = d.monopolyTotal() / 2;
  near(each, 22.5);
  assert.ok(d.profit(1, each, each) > d.profit(1, 30, 30));
  const dev = d.bestReply(1, each);
  assert.ok(d.profit(1, dev, each) > d.profit(1, each, each));
});
test("no firm can gain by changing its own quantity at the equilibrium", () => {
  for (const m of [COURNOT_FEEL, ...PROVE_SYMMETRIC, ...PROVE_ASYMMETRIC]) {
    const e = m.equilibrium();
    for (let q = 0; q <= m.a; q += 0.5) {
      assert.ok(m.profit(1, q, e.q2) <= m.profit(1, e.q1, e.q2) + 1e-9);
      assert.ok(m.profit(2, e.q1, q) <= m.profit(2, e.q1, e.q2) + 1e-9);
    }
  }
});
test("the firm with the lower cost sells more", () => {
  for (const m of PROVE_ASYMMETRIC) {
    const e = m.equilibrium();
    assert.ok(m.c1 < m.c2 && e.q1 > e.q2);
  }
  near(PROVE_ASYMMETRIC[0]!.equilibrium().q1, 40);
  near(PROVE_ASYMMETRIC[0]!.equilibrium().q2, 10);
});
test("the rival answers your last quantity, and the staircase of replies converges on the equilibrium", () => {
  near(rivalQuantity(COURNOT_FEEL, null), 30);
  near(rivalQuantity(COURNOT_FEEL, 22.5), 33.75);
  const pts = staircase(COURNOT_FEEL, { q1: 52, q2: 8 }, 12);
  const last = pts[pts.length - 1]!;
  near(last[0], 30, 0.1);
  near(last[1], 30, 0.1);
  assert.ok(Math.hypot(pts[5]![0] - 30, pts[5]![1] - 30) < Math.hypot(pts[0]![0] - 30, pts[0]![1] - 30));
});
test("prove: every pool answer is right for itself, and the Feel answer (30, 30) fails every one", () => {
  for (const m of [...PROVE_SYMMETRIC, ...PROVE_ASYMMETRIC]) {
    const e = m.equilibrium();
    assert.ok(cournotRight(m, e.q1, e.q2));
    assert.ok(!cournotRight(m, 30, 30), `${m.a} ${m.c1} ${m.c2}`);
    assert.ok(cournotAxis(m) > Math.max(e.q1, e.q2) * 1.4);
  }
  const answers = new Set(PROVE_SYMMETRIC.map((m) => Math.round(m.equilibrium().q1)));
  assert.equal(answers.size, PROVE_SYMMETRIC.length - 0 - (PROVE_SYMMETRIC.length - answers.size));
  assert.ok(!cournotRight(new Duopoly(84, 12), 24 + 5, 24));
});

// frag:stackelberg
console.log("stackelberg");
test("the follower replies with half of what the leader leaves", () => {
  assert.equal(LEADER_FEEL.reply(30), 30);
  assert.equal(LEADER_FEEL.reply(45), 22.5);
  assert.equal(LEADER_FEEL.reply(100), 0);
});
test("the best commitment is half of a - c, found by brute force, and earns (a - c)^2 / 8", () => {
  for (const d of [LEADER_FEEL, ...LEAD_POOL]) {
    let best = 0;
    let bq = 0;
    for (let q = 0; q <= d.a; q += 0.25) if (d.leaderProfit(q) > best) { best = d.leaderProfit(q); bq = q; }
    assert.ok(Math.abs(bq - d.bestLead()) <= 0.25, `${d.a} ${d.c}`);
    assert.ok(Math.abs(best - ((d.a - d.c) ** 2) / 8) < 0.5);
  }
});
test("the leader earns twice the follower and beats the simultaneous profit", () => {
  const d = LEADER_FEEL;
  assert.equal(d.leaderProfit(45), 1012.5);
  assert.equal(d.followerProfit(45), 506.25);
  assert.equal(d.cournotProfit(), 900);
  assert.ok(d.leaderProfit(45) > d.cournotProfit());
  assert.ok(d.followerProfit(45) < d.cournotProfit());
});
test("if the rival ignored the commitment, the best quantity would be lower, so reaction is what makes committing big pay", () => {
  const d = LEADER_FEEL;
  let bq = 0;
  let best = 0;
  for (let q = 0; q <= 90; q++) if (d.stayProfit(q, 30) > best) { best = d.stayProfit(q, 30); bq = q; }
  assert.equal(bq, 30);
  assert.ok(d.stayProfit(45, 30) < d.leaderProfit(45));
});
test("Prove answers are right, the Feel answer fails every case, and a default of 0 fails", () => {
  for (const d of LEAD_POOL) assert.ok(leaderRight({ kind: "lead", d, q1: 0 }, d.bestLead()) && !leaderRight({ kind: "lead", d, q1: 0 }, 45) && !leaderRight({ kind: "lead", d, q1: 0 }, 0));
  for (const f of FOLLOW_POOL) {
    const p = { kind: "follow" as const, d: f.d, q1: f.q1 };
    assert.ok(leaderRight(p, f.d.reply(f.q1)) && !leaderRight(p, 0) && !leaderRight(p, f.q1));
    assert.equal(leaderAnswer(p), f.d.reply(f.q1));
  }
  assert.deepEqual(LEAD_POOL.map((d) => d.bestLead()), [30, 60, 39]);
  assert.deepEqual(FOLLOW_POOL.map((f) => f.d.reply(f.q1)), [10, 28, 17]);
});
test("Prove set holds one leader and one follower puzzle", () => {
  const s = leaderProveSet(new Rng(5));
  assert.deepEqual(s.map((p) => p.kind).sort(), ["follow", "lead"]);
});

console.log("evolutionary game theory");
test("hawks and doves settle at V over C from any start, and both strategies earn the same there", () => {
  for (const g of [EVO_FEEL, ...EVO_POOL]) {
    for (const x0 of [0.1, 0.5, 0.9]) {
      let x = x0;
      for (let i = 0; i < 60; i++) x = g.step(x);
      near(x, g.stable, 0.02);
    }
    near(g.hawk(g.stable), g.dove(g.stable), 1e-9);
    assert.equal(g.drift(g.stable - 0.1), 1);
    assert.equal(g.drift(g.stable + 0.1), -1);
  }
});
test("Prove tables settle away from one half and from Feel, and fit the track", () => {
  for (const g of EVO_POOL) assert.ok(Math.abs(g.stable - 0.5) > 0.05 && g.stable > 0.1 && g.stable < 0.9);
  assert.equal(new Set(EVO_POOL.map((g) => g.stable)).size, EVO_POOL.length);
});

console.log("lemons");
test("Feel market unravels to the two worst cars at a price of 3", () => {
  const r = FEEL_MARKET.rounds();
  assert.deepEqual(r.map((x) => x.onSale.length), [8, 5, 3, 2]);
  near(r[0]!.price, 6.6);
  near(FEEL_MARKET.finalPrice, 3);
});
test("every stable market keeps only cars the price covers, and random markets differ from Feel", () => {
  for (let seed = 1; seed <= 30; seed++) {
    const g = lemonMarket(new Rng(seed));
    const last = g.rounds().at(-1)!;
    assert.ok(last.onSale.every((q) => q <= last.price));
    assert.ok(g.rounds().length >= 3);
  }
  assert.ok(new Lemons([5, 5, 5], 1.2).rounds().length === 1);
});

console.log("auctions");
test("the shaded bid is the best reply to shaded rivals", () => {
  for (const n of [2, 3, 4, 5]) {
    const g = new FirstPrice(n);
    for (const v of [0.4, 0.7, 1]) near(g.best(v), v * g.shade, 0.011);
  }
});
test("expected revenue is (n-1)/(n+1) in both formats, by simulation", () => {
  const rng = new Rng(5);
  for (const n of [2, 3, 5]) {
    const g = new FirstPrice(n);
    let first = 0;
    let second = 0;
    const T = 20000;
    for (let t = 0; t < T; t++) {
      const vs = Array.from({ length: n }, () => rng.next()).sort((a, b) => b - a);
      first += g.rivalBid(vs[0]!);
      second += vs[1]!;
    }
    near(first / T, g.expectedRevenue, 0.02);
    near(second / T, g.expectedRevenue, 0.02);
  }
});
test("Prove cases have an interior best bid that differs from the value and from half", () => {
  for (const c of AUCTION_POOL) {
    const b = c.auction.best(c.value);
    assert.ok(b < c.value && Math.abs(b - c.value / 2) > 0.05);
  }
});

console.log("matching");
test("deferred acceptance gives a stable matching, and a blocking pair appears for an unstable one", () => {
  for (let seed = 1; seed <= 40; seed++) {
    const m = matchMarket(new Rng(seed));
    const da = deferredAcceptance(m);
    assert.ok(isStable(m, da.match), `seed ${seed}`);
    assert.equal(new Set(da.match).size, 3);
    assert.ok(blocking(m, [0, 1, 2]).length >= 1);
  }
});

console.log("cooperative games");
test("Shapley values sum to the grand coalition, and Feel gives 50, 20, 20", () => {
  const s = COOP_FEEL.shapley();
  near(s.reduce((a, b) => a + b, 0), COOP_FEEL.grand);
  near(s[0]!, 50);
  near(s[1]!, 20);
  for (const c of COOP_POOL) near(c.game.shapley().reduce((a, b) => a + b, 0), c.game.grand);
});
test("Prove answers are whole numbers and differ from Feel's", () => {
  for (const c of COOP_POOL) {
    const v = c.game.shapley()[c.player]!;
    assert.equal(v, Math.round(v));
  }
  assert.ok(new Set(COOP_POOL.map((c) => c.game.shapley()[c.player])).size >= 3);
});

console.log("prospect theory");
test("a coin flip is accepted only when the gain beats lambda times the loss", () => {
  const v = new Value(2);
  assert.ok(!v.accepts(60, 40) && v.accepts(90, 40) && !v.accepts(80, 40));
  assert.equal(v.breakEven(40), 80);
  for (const f of FEEL_FLIPS) assert.ok(f.gain > f.loss);
  assert.ok(FEEL_FLIPS.some((f) => v.accepts(f.gain, f.loss)) && FEEL_FLIPS.some((f) => !v.accepts(f.gain, f.loss)));
  for (const c of PROSPECT_POOL) {
    assert.ok(c.value.breakEven(c.loss) <= 200 && c.value.lambda !== 2);
    near(c.value.gamble(c.value.breakEven(c.loss), c.loss), 0);
  }
});

console.log("allais paradox");
test("the classic numbers: A and D look attractive to people, yet EU ties A with C and B with D", () => {
  const g = FEEL_ALLAIS;
  near(g.common, 0.89);
  assert.ok(Allais.expected(g.B()) > Allais.expected(g.A()) && Allais.expected(g.D()) > Allais.expected(g.C()));
  assert.equal(g.consistent("A"), "C");
  assert.equal(g.consistent("B"), "D");
});
test("for any utility of money, EU prefers A exactly when it prefers C", () => {
  const rng = new Rng(11);
  for (const g of [FEEL_ALLAIS, ...ALLAIS_POOL.map((c) => c.game)]) {
    for (let i = 0; i < 200; i++) {
      const uZ = 0;
      const uS = rng.range(0.1, 1);
      const uH = rng.range(0.1, 2);
      assert.equal(g.prefersA(uS, uH, uZ), g.prefersC(uS, uH, uZ));
    }
  }
});

console.log("loss aversion and streaks");
test("a streak is kept once its loss beats the effort, and the threshold is the first such length", () => {
  const g = FEEL_STREAK;
  assert.equal(g.threshold(9), 5);
  assert.ok(!g.keeps(4, 9) && g.keeps(5, 9));
  assert.ok(FEEL_EFFORTS.every((e) => e >= 2));
  for (const c of STREAK_POOL) {
    const t = c.streak.threshold(c.effort);
    assert.ok(c.streak.keeps(t, c.effort) && !c.streak.keeps(t - 1, c.effort));
    assert.ok(t <= 12);
  }
  assert.ok(new Set(STREAK_POOL.map((c) => c.streak.threshold(c.effort))).size >= 3);
  assert.ok(new Streak(1, 2).lossIfBreak(3) === 6);
});

console.log("preference manipulation");
test("the decoy is the option that only one other option beats", () => {
  assert.ok(dominates(FEEL_PAIR[1]!, FEEL_DECOY));
  assert.ok(!dominates(FEEL_PAIR[0]!, FEEL_DECOY));
  assert.equal(decoy([...FEEL_PAIR, FEEL_DECOY])?.name, "D");
  assert.equal(decoy(FEEL_PAIR), null);
  for (let seed = 1; seed <= 50; seed++) {
    const t = triple(new Rng(seed));
    assert.equal(decoy(t)?.name, "D");
  }
});

console.log("behavioral game theory");
test("levels of reasoning shrink by p each step, and the crowd target is below the average", () => {
  const g = FEEL_BEAUTY;
  near(g.level(0), 50);
  near(g.level(1), 33.3333, 1e-3);
  near(g.target, g.p * g.average);
  assert.ok(g.target < g.average && g.target > 0);
  for (const b of BEAUTY_POOL) {
    near(b.level(2), 50 * b.p * b.p);
    near(b.level(2), Math.round(b.level(2) * 10) / 10, 1e-9);
  }
  assert.ok(new Beauty(0.5).levelsToZero(1) > 4);
});

// frag:elo-trueskill
console.log("elo");
test("equal ratings give an even chance, 400 points gives about 91 to 9, and the two chances sum to one", () => {
  const e = new Elo(32);
  assert.equal(e.expected(1200, 1200), 0.5);
  assert.ok(Math.abs(e.expected(1600, 1200) - 0.909) < 0.001);
  assert.ok(Math.abs(e.expected(1200, 1700) + e.expected(1700, 1200) - 1) < 1e-12);
});
test("a result moves a rating by K times the surprise, and the two players move equal and opposite", () => {
  const e = new Elo(32);
  assert.equal(e.delta(1200, 1200, 1), 16);
  assert.equal(e.delta(1200, 1200, 0), -16);
  assert.ok(Math.abs(e.delta(1200, 1400, 1) + e.delta(1400, 1200, 0)) < 1e-9);
  assert.ok(e.delta(1200, 1400, 1) > e.delta(1200, 1000, 1));
  assert.ok(Math.abs(e.delta(1200, 1400, 0)) < Math.abs(e.delta(1200, 1000, 0)));
});
test("an average over the expected chance leaves a rating where it is", () => {
  const e = FEEL_ELO;
  for (const o of FEEL_OPPONENTS) {
    const p = e.expected(FEEL_START, o);
    assert.ok(Math.abs(p * e.delta(FEEL_START, o, 1) + (1 - p) * e.delta(FEEL_START, o, 0)) < 1e-9);
  }
});
test("play draws wins at about the Elo chance", () => {
  const rng = new Rng(11);
  let w = 0;
  for (let i = 0; i < 4000; i++) w += eloPlay(rng, 1200, 1400);
  assert.ok(Math.abs(w / 4000 - FEEL_ELO.expected(1200, 1400)) < 0.03);
});
test("Prove answers are right, no answer is the old rating, and the Feel update does not fit", () => {
  for (const p of ELO_POOL) {
    assert.ok(eloRight(p, eloAnswer(p)));
    assert.ok(!eloRight(p, p.you), `${p.you}`);
    assert.ok(Math.abs(eloAnswer(p) - p.you) > 3);
  }
  assert.equal(eloProveSet(new Rng(2)).length, 2);
});

// frag:dynamic-difficulty
console.log("dynamic difficulty");
test("the chance of winning is a half at the skill level and falls as the level rises", () => {
  const c = new Challenge(5);
  assert.equal(c.chance(5), 0.5);
  for (let d = 0; d < 10; d++) assert.ok(c.chance(d + 1) < c.chance(d));
});
test("the level that gives the target chance matches the chance function", () => {
  for (const s of [3, 5, 8]) for (const t of [0.5, 0.6, 0.7, 0.8]) assert.ok(Math.abs(new Challenge(s).chance(new Challenge(s).level(t)) - t) < 1e-9);
  assert.ok(Math.abs(new Challenge(FEEL_SKILL).level(0.5) - 5) < 1e-9);
});
test("the thermostat raises the level on a win, lowers it on a loss, and settles where wins happen at the target rate", () => {
  assert.ok(thermostat(5, true) > 5 && thermostat(5, false) < 5);
  const rng = new Rng(21);
  const c = new Challenge(5);
  let d = 1;
  let wins = 0;
  let sum = 0;
  const n = 30000;
  for (let i = 0; i < n; i++) {
    const w = c.attempt(rng, d);
    d = thermostat(d, w);
    if (i > 5000) {
      wins += w ? 1 : 0;
      sum += d;
    }
  }
  assert.ok(Math.abs(wins / (n - 5001) - TARGET) < 0.03);
  assert.ok(Math.abs(sum / (n - 5001) - c.level(TARGET)) < 0.6);
});
test("Prove answers are right, the Feel level does not pass, and a level of 0 fails", () => {
  for (const p of DDA_POOL) {
    assert.ok(ddaRight(p, ddaAnswer(p)));
    assert.ok(!ddaRight(p, 0), `${p.skill}`);
    assert.ok(!ddaRight(p, new Challenge(FEEL_SKILL).level(TARGET)) || p.skill === FEEL_SKILL);
  }
  assert.equal(ddaProveSet(new Rng(4)).length, 2);
});

// frag:ltv-prediction
console.log("lifetime value");
test("the value over n weeks adds up the weekly spend of those who stay, and grows toward the lifetime value", () => {
  const c = new Cohort(5, 0.5);
  assert.equal(c.value(1), 5);
  assert.equal(c.value(2), 7.5);
  let sum = 0;
  for (let t = 0; t < 12; t++) sum += 5 * Math.pow(0.5, t);
  assert.ok(Math.abs(c.value(12) - sum) < 1e-9);
  assert.ok(c.value(12) < c.lifetime() && Math.abs(c.lifetime() - 10) < 1e-9);
});
test("lifetime value is spend times expected weeks, and rises sharply as retention nears one", () => {
  assert.ok(Math.abs(new Cohort(3, 0.8).weeks() - 5) < 1e-9);
  assert.ok(Math.abs(new Cohort(3, 0.8).lifetime() - 15) < 1e-9);
  const g1 = new Cohort(4, 0.9).lifetime() - new Cohort(4, 0.8).lifetime();
  const g2 = new Cohort(4, 0.6).lifetime() - new Cohort(4, 0.5).lifetime();
  assert.ok(g1 > g2);
});
test("in the Feel pairs the bigger first week spender wins in some pairs and the better keeper in others", () => {
  let first = 0;
  let keeper = 0;
  for (const p of LTV_PAIRS) {
    const lv = p.left.value(HORIZON);
    const rv = p.right.value(HORIZON);
    assert.ok(Math.abs(lv - rv) > 0.5);
    const spenderWins = (p.left.a > p.right.a) === (lv > rv);
    if (spenderWins) first++;
    else keeper++;
  }
  assert.ok(first >= 1 && keeper >= 1);
  assert.equal(ltvFeelPairs(new Rng(8)).length, 4);
});
test("Prove answers are right, a guess of 0 fails, and a first week spend alone fails", () => {
  for (const p of LTV_POOL) {
    assert.ok(ltvRight(p, ltvAnswer(p)));
    assert.ok(!ltvRight(p, 0));
    assert.ok(!ltvRight(p, p.a));
  }
  assert.equal(ltvProveSet(new Rng(3)).length, 2);
});

// frag:rules-engines
console.log("rules engines");
test("the first matching rule fires, later matches are shadowed, and no match gives the default", () => {
  assert.deepEqual(RULES_FEEL.matches(["paid", "idle"]), [0, 1]);
  assert.equal(RULES_FEEL.fired(["paid", "idle"]), 0);
  assert.equal(RULES_FEEL.offer(["paid", "idle"]), "pack");
  assert.equal(RULES_FEEL.offer(["idle", "rookie"]), "bonus");
  assert.equal(RULES_FEEL.fired([]), -1);
  assert.equal(RULES_FEEL.offer([]), "none");
});
test("moving a rule to the top changes who gets which offer, and the player who matches everything gets the top rule", () => {
  for (let i = 0; i < 3; i++) {
    const l = RULES_FEEL.toTop(i);
    assert.equal(l.rules[0], RULES_FEEL.rules[i]);
    assert.equal(l.rules.length, 3);
    assert.equal(l.offer(SEE_PLAYER), RULES_FEEL.rules[i]!.give);
  }
  const offers = new Set([0, 1, 2].map((i) => RULES_FEEL.toTop(i).offer(SEE_PLAYER)));
  assert.equal(offers.size, 3);
});
test("every Feel player has an answer, several overlap two rules, and one gets nothing", () => {
  assert.ok(RULES_PLAYERS.some((p) => RULES_FEEL.matches(p).length >= 2));
  assert.ok(RULES_PLAYERS.some((p) => RULES_FEEL.fired(p) === -1));
  assert.equal(rulesFeelPlayers(new Rng(6)).length, 5);
});
test("every Prove puzzle has overlapping rules that give different offers, and the Feel order would answer it differently", () => {
  for (const q of RULES_POOL) {
    const m = q.list.matches(q.traits);
    assert.ok(m.length >= 2);
    assert.notEqual(q.list.rules[m[0]!]!.give, q.list.rules[m[1]!]!.give);
    assert.notEqual(q.list.offer(q.traits), RULES_FEEL.offer(q.traits));
    assert.equal(new Set(q.list.rules.map((r) => r.when)).size, 3);
  }
  assert.equal(rulesProveSet(new Rng(1)).length, 2);
  assert.equal(TRAITS.length, 3);
});

// frag:engagement-stack
console.log("engagement stack");
test("engagement grows faster than the number of layers because layers feed each other, and strain grows with the square", () => {
  const s = STACK_FEEL;
  assert.equal(s.engagement(0), 0);
  assert.equal(s.engagement(1), 10);
  assert.equal(s.engagement(2), 24);
  assert.ok(s.engagement(4) - s.engagement(3) > s.engagement(2) - s.engagement(1));
  assert.equal(s.strain(3), 36);
});
test("the Feel stack nets most at two layers, and five layers nets less than none beyond three", () => {
  const s = STACK_FEEL;
  assert.equal(s.best(MAX_LAYERS), 2);
  assert.ok(s.net(2) > s.net(1) && s.net(2) > s.net(3));
  assert.ok(s.net(5) < 0);
});
test("every Prove stack has one clear best number of layers, found by brute force, below the top and above zero", () => {
  for (const s of STACK_POOL) {
    const b = stackAnswer(s);
    assert.ok(b >= 1 && b < PROVE_MAX, `${s.e} ${s.s} ${s.q}`);
    for (let n = 0; n <= PROVE_MAX; n++) if (n !== b) assert.ok(s.net(n) < s.net(b), `${n}`);
  }
  assert.equal(stackProveSet(new Rng(9)).length, 2);
});

// frag:correlated-equilibrium
console.log("correlated equilibrium");
test("chicken payoffs and the chance the rival was told to go, given you were told to wait", () => {
  const l = LIGHT_FEEL;
  assert.equal(l.pay("go", "wait"), 7);
  assert.equal(l.pay("go", "go"), 0);
  assert.equal(l.pay("wait", "go"), 2);
  assert.equal(l.pay("wait", "wait"), 6);
  assert.ok(Math.abs(l.rivalGoesGivenWait(FEEL_A) - 0.5) < 1e-9);
});
test("with a third on each profile, obeying wait pays 4 and going anyway pays 3.5, and obeying go pays more than waiting", () => {
  const l = LIGHT_FEEL;
  assert.ok(Math.abs(l.obeyWait(FEEL_A) - 4) < 1e-9);
  assert.ok(Math.abs(l.goWait(FEEL_A) - 3.5) < 1e-9);
  assert.ok(l.obedient(FEEL_A));
  assert.ok(l.obeyGo() > l.ignoreGo());
});
test("obeying a wait holds from the minimum chance up, found by brute force", () => {
  for (const l of [LIGHT_FEEL, ...LIGHT_POOL]) {
    let first = -1;
    for (let a = 0; a <= 0.5; a += 0.0005) if (l.obedient(a)) { first = a; break; }
    assert.ok(Math.abs(first - l.minChance()) < 0.002, `${l.r} ${l.s} ${l.t}`);
    assert.ok(!l.obedient(l.minChance() - 0.01));
    assert.ok(l.obedient(l.minChance() + 0.01));
  }
  assert.ok(Math.abs(LIGHT_FEEL.minChance() - 0.25) < 1e-9);
});
test("Prove answers pass, the Feel answer and the ends fail, and the signals use every profile", () => {
  for (const l of LIGHT_POOL) {
    assert.ok(lightRight(l, l.minChance()));
    assert.ok(!lightRight(l, 0) && !lightRight(l, 0.5));
    assert.ok(!lightRight(l, LIGHT_FEEL.minChance()), `${l.r}`);
  }
  const s = lightSignals(new Rng(5));
  assert.equal(s.length, 5);
  for (const p of LIGHT_PROFILES) assert.ok(s.some((q) => q[0] === p[0] && q[1] === p[1]));
  assert.equal(lightProveSet(new Rng(2)).length, 2);
});

// frag:subgame-perfect
console.log("subgame perfect");
test("the incumbent replies with what is better for it once the entrant is in, and a threat is believable only if that is to fight", () => {
  const m = ENTRY_SEE;
  assert.equal(m.reply(), "accept");
  assert.equal(m.credible(), false);
  assert.deepEqual(m.enterPay(), [5, 6]);
  assert.equal(m.enters(), true);
  assert.deepEqual(m.outcome(), [5, 6]);
  const c = ENTRY_FEEL[1]!;
  assert.equal(c.reply(), "fight");
  assert.equal(c.enters(), false);
  assert.deepEqual(c.outcome(), [2, 10]);
});
test("staying out under an empty threat looks stable but is not subgame perfect, because the entrant gains by entering", () => {
  for (const m of [...ENTRY_FEEL, ...ENTRY_EMPTY, ...ENTRY_CRED]) {
    if (!m.credible()) {
      assert.equal(m.nashOutWithThreat(), true);
      assert.equal(m.enters(), true);
    } else {
      assert.equal(m.enters(), false);
    }
  }
});
test("Feel has two believable and two empty threats, and Prove gives one of each, with no Feel market reused", () => {
  assert.equal(ENTRY_FEEL.filter((m) => m.credible()).length, 2);
  assert.equal(entryFeel(new Rng(3)).length, 4);
  const s = entryProveSet(new Rng(2));
  assert.deepEqual(s.map((m) => m.credible()).sort(), [false, true]);
  for (const m of [...ENTRY_CRED, ...ENTRY_EMPTY]) assert.ok(!ENTRY_FEEL.some((f) => JSON.stringify(f) === JSON.stringify(m)));
});

// frag:trembling-hand
console.log("trembling hand");
test("the safe cell is stable but rests on a weak move, and a slip makes the other move strictly better", () => {
  assert.deepEqual(TREM_FEEL.table.stable(), [[0, 0], [1, 1]]);
  assert.equal(TREM_FEEL.weakRow(1), true);
  assert.equal(TREM_FEEL.weakRow(0), false);
  assert.equal(TREM_FEEL.survives(1, 1), false);
  assert.deepEqual(TREM_FEEL.perfect(), [0, 0]);
  assert.equal(TREM_FEEL.rowPay(0, TREM_SAFE, 0), TREM_FEEL.rowPay(1, TREM_SAFE, 0));
  assert.ok(TREM_FEEL.rowPay(0, TREM_SAFE, 0.2) > TREM_FEEL.rowPay(1, TREM_SAFE, 0.2));
});
test("every Prove table has two stable cells and exactly one survives a tremble", () => {
  for (const t of TREM_TABLES) {
    assert.equal(t.table.stable().length, 2);
    assert.equal(t.table.stable().filter(([r, c]) => t.survives(r, c)).length, 1);
    assert.notEqual(t.perfect(), null);
  }
});
test("Prove gives one table whose survivor pays more and one whose survivor pays less, and explains a wrong tap", () => {
  const s = tremProveSet(new Rng(5));
  const better = s.map((t) => { const [r, c] = t.perfect()!; const o = t.table.stable().find(([a, b]) => a !== r || b !== c)!; return t.table.payoff(r, c)[0] > t.table.payoff(o[0], o[1])[0]; });
  assert.deepEqual([...better].sort(), [false, true]);
  const t = TREM_TABLES[0]!;
  assert.ok(t.why(0, 1).includes("Someone gains"));
  assert.ok(t.why(1, 1).includes("never beats"));
  assert.equal(t.why(0, 0), "");
  assert.equal(tremFeelSlips(new Rng(1)).filter(Boolean).length, 2);
});

// frag:sequential-equilibrium
console.log("sequential equilibrium");
test("the best move flips at the belief where L and R pay the same", () => {
  const b = SEQ_FEEL;
  assert.ok(Math.abs(b.threshold() - 0.4) < 1e-9);
  assert.ok(Math.abs(b.payL(0.4) - b.payR(0.4)) < 1e-9);
  assert.equal(b.best(0.4), "tie");
  assert.equal(b.best(0.9), "L");
  assert.equal(b.best(0.1), "R");
  assert.equal(b.isRight(0.42), true);
  assert.equal(b.isRight(0.5), false);
});
test("every table has L better at X and R better at Y, with a threshold strictly inside zero and one", () => {
  for (const b of [SEQ_FEEL, ...SEQ_POOL]) {
    assert.ok(b.xL > b.xR && b.yR > b.yL);
    assert.ok(b.threshold() > 0.1 && b.threshold() < 0.9);
  }
  assert.ok(Math.abs(new SeqBelief(8, 2, 0, 3).threshold() - 1 / 3) < 1e-9);
});
test("Feel uses both best moves, and Prove thresholds differ from Feel and each other", () => {
  assert.ok(SEQ_BELIEFS.some((p) => SEQ_FEEL.best(p) === "L") && SEQ_BELIEFS.some((p) => SEQ_FEEL.best(p) === "R"));
  assert.equal(seqFeel(new Rng(2)).length, 5);
  const s = seqProveSet(new Rng(4));
  assert.equal(s.length, 2);
  assert.notEqual(s[0]!.threshold(), s[1]!.threshold());
  for (const b of SEQ_POOL) assert.notEqual(Math.round(b.threshold() * 100), 40);
});

// frag:perfect-bayesian
console.log("perfect bayesian");
test("a signal sent more by strong types raises the share strong, and its absence lowers it", () => {
  assert.ok(Math.abs(PB_FEEL.posterior(true) - 0.8) < 1e-9);
  assert.ok(Math.abs(PB_FEEL.posterior(false) - 0.2) < 1e-9);
  const c = PB_FEEL.counts(true, 20);
  assert.ok(Math.abs(c.strong - 8) < 1e-9 && Math.abs(c.weak - 2) < 1e-9);
  assert.ok(Math.abs(new PbMarket(0.25, 0.6, 0.2).posterior(true) - 0.5) < 1e-9);
  assert.ok(Math.abs(new PbMarket(0.5, 0.7, 0.1).posterior(false) - 0.25) < 1e-9);
});
test("hiring pays when the share strong beats the pass payoff over the hire payoff", () => {
  assert.equal(pbBest(PB_FEEL.posterior(true)), "hire");
  assert.equal(pbBest(PB_FEEL.posterior(false)), "pass");
  assert.equal(pbBest(PB_PASS / PB_HIRE), "tie");
  assert.ok(Math.abs(pbHire(0.8) - 3.2) < 1e-9);
});
test("Prove cases come in whole people out of 100, differ from Feel, and the answer window is plus or minus five points", () => {
  for (const k of PB_POOL) {
    const sc = k.m.counts(k.sent, 100);
    assert.ok(Math.abs(sc.strong - Math.round(sc.strong)) < 1e-9 && Math.abs(sc.weak - Math.round(sc.weak)) < 1e-9);
    assert.notEqual(Math.round(k.m.posterior(k.sent) * 100), 80);
    assert.notEqual(Math.round(k.m.posterior(k.sent) * 100), 20);
  }
  const k = PB_POOL[0]!;
  assert.equal(pbRight(k, 0.52), true);
  assert.equal(pbRight(k, 0.6), false);
  const s = pbProveSet(new Rng(6));
  assert.equal(s.length, 2);
  assert.notEqual(s[0], s[1]);
  assert.equal(pbSignals(new Rng(1)).filter(Boolean).length, 2);
});

// frag:slots-6-15
console.log("what is a game");
test("an empty road is not a game, two lanes are", () => {
  assert.ok(!ALONE.isInterdependent());
  assert.ok(LANES.isInterdependent());
  assert.equal(LANES.bestRow(0), 1);
  assert.equal(LANES.bestRow(1), 0);
});
test("flip puzzles start as decisions and become games exactly when the cell passes the other row", () => {
  for (let seed = 1; seed <= 100; seed++) {
    for (const z of flipPuzzles(new Rng(seed))) {
      assert.ok(!z.table.isInterdependent());
      const [r, c] = z.cell;
      assert.ok(!z.table.with(r, c, z.needs - 1).isInterdependent(), "a tie is not enough");
      assert.ok(z.table.with(r, c, z.needs).isInterdependent());
    }
  }
});

console.log("rationality and common knowledge");
test("the ladder shrinks by p each step toward zero", () => {
  const c = new Contest(2 / 3);
  const l = c.ladder(50, 6);
  near(l[1]!, 33.3333, 1e-3);
  assert.ok(l[6]! < 5);
  for (let i = 1; i < l.length; i++) assert.ok(l[i]! < l[i - 1]!);
});
test("best guess aims p times what the crowd will say, one step beyond them", () => {
  const c = new Contest(1 / 2);
  near(c.best(c.crowd(60, 1)), 15);
  for (const z of CONTEST_PUZZLES) near(bestFor(z), new Contest(z.p).crowd(z.start, z.k + 1));
  assert.ok(Math.abs(bestFor(CONTEST_PUZZLES[0]!) - 40 * 0.5) > CONTEST_TOL, "naive half of 40 must not pass");
});

console.log("normal vs extensive");
test("trees have strict best replies and the outcome_t6 follows backward induction", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const g = randomTree(new Rng(seed));
    for (const i of [0, 1]) {
      assert.notEqual(g.pay[i]![0]![1], g.pay[i]![1]![1]);
      const j = bestReply(g, i);
      assert.ok(g.pay[i]![j]![1] > g.pay[i]![1 - j]![1]);
      assert.equal(outcome_t6(g, i).pay, g.pay[i]![j]);
    }
  }
});
test("a swapped table moves the leaf to the other column", () => {
  assert.equal(columnOf(0, false), 0);
  assert.equal(columnOf(0, true), 1);
  const set = mapPuzzles(new Rng(4));
  assert.equal(set.length, 3);
  assert.equal(new Set(set.map((s) => s.game.first[0])).size, 3);
});

console.log("zero sum");
test("constant sum is detected, and one outlier breaks it", () => {
  assert.ok(isConstantSum([[1, 9], [4, 6], [7, 3]]));
  assert.ok(!isConstantSum([[1, 9], [4, 6], [7, 5]]));
  for (let seed = 1; seed <= 100; seed++) for (const z of sumPuzzles(new Rng(seed))) assert.equal(isConstantSum(z.points), z.constant);
});
test("a tug never changes the total", () => {
  for (let y = 1; y <= 3; y++) for (let t = 1; t <= 3; t++) {
    const mine = afterTug(5, y, t);
    assert.ok(mine >= 0 && mine <= 10);
  }
  assert.equal(afterTug(9, 3, 1), 10);
});

console.log("positive sum");
test("a deal exists only when the whole is worth more than the parts, and splits must clear both baselines", () => {
  for (const d of FEEL_DEALS) assert.ok(surplus(d) > 0);
  assert.ok(PROVE_DEALS.some((d) => surplus(d) <= 0));
  const d = FEEL_DEALS[0]!;
  const [lo, hi] = dealRange(d)!;
  assert.ok(acceptable(d, lo) && acceptable(d, hi));
  assert.ok(!acceptable(d, lo - 1) && !acceptable(d, hi + 1));
  assert.equal(dealRange({ a: 6, b: 5, merged: 9 }), null);
});

console.log("negative sum");
test("walking keeps the pie, every fight destroys some of it", () => {
  assert.equal(destroyed(fightPayoff("walk", "walk")), 0);
  assert.ok(destroyed(fightPayoff("fight", "walk")) > 0);
  assert.ok(destroyed(fightPayoff("fight", "fight")) > destroyed(fightPayoff("fight", "walk")));
  assert.ok(fightPayoff("fight", "fight")[0] > fightPayoff("walk", "fight")[0], "fighting is the best reply to a fighter");
});
test("select puzzles always have between one and three outcomes worse for both", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const z = selectPuzzle(new Rng(seed));
    const n = z.points.filter((p) => worseForBoth(p, z.status)).length;
    assert.ok(n >= 1 && n <= 3, `seed ${seed} had ${n}`);
  }
});

console.log("simultaneous vs sequential");
test("battle of the sexes: who moves first wins their favourite", () => {
  assert.deepEqual(BATTLE.youFirst().pay, [3, 2]);
  assert.deepEqual(BATTLE.theyFirst().pay, [2, 3]);
});
test("generated games have strict replies and the move order changes the outcome_t6", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const g = newOrderGame(new Rng(seed));
    const a = g.youFirst();
    const b = g.theyFirst();
    assert.ok(a.row !== b.row || a.col !== b.col, `seed ${seed}`);
  }
});

console.log("players count");
test("investing pays exactly while the group is smaller than the multiplier", () => {
  const g = new PublicGood(FEEL_R);
  assert.ok(g.investPays(1));
  assert.ok(!g.investPays(2));
  for (const r of PROVE_R) {
    const pg = new PublicGood(r);
    const m = pg.maxPlayers();
    assert.ok(pg.investPays(m) && !pg.investPays(m + 1), `r ${r}`);
  }
  assert.equal(new PublicGood(3).maxPlayers(), 2);
  assert.equal(new PublicGood(4.5).maxPlayers(), 4);
});
test("free riding beats investing for each player, yet everyone investing beats no one investing", () => {
  const g = new PublicGood(1.6);
  assert.ok(g.payoff(5, false, 2) > g.payoff(5, true, 2));
  assert.ok(g.payoff(5, true, 4) > g.payoff(5, false, 0));
});

console.log("taxonomy");
test("every quadrant is covered and prove scenes span at least three of them", () => {
  assert.equal(new Set(TAX_FEEL.map(quadrantOf)).size, 4);
  for (let seed = 1; seed <= 100; seed++) assert.ok(new Set(proveScenes_t6(new Rng(seed)).map(quadrantOf)).size >= 3);
  for (const s of TAX_FEEL) assert.ok(s.why.length <= 70, s.name);
});

console.log("pareto efficiency");
test("dominance and efficiency", () => {
  assert.ok(dominates_t6([5, 5], [4, 5]));
  assert.ok(!dominates_t6([5, 5], [5, 5]));
  assert.ok(!dominates_t6([6, 2], [2, 6]));
  const set: [number, number][] = [[2, 8], [4, 6], [3, 3], [7, 5], [9, 2], [5, 2]];
  assert.deepEqual(efficientSet(set), [[2, 8], [4, 6], [7, 5], [9, 2]]);
  assert.ok(!isEfficient(set[2]!, set));
});
test("sliding improves a point until it sticks on the frontier, and then it cannot move", () => {
  for (const s of STARTS) {
    let p: [number, number] = [s[0], s[1]];
    for (let i = 0; i < 2000; i++) p = slide(p, [10, 10], 0.1);
    assert.ok(onFrontier(p), `stuck at ${p}`);
    assert.ok(p[0] >= s[0] && p[1] >= s[1], "nobody got worse off");
    assert.deepEqual(slide(p, [10, 10], 0.1), p);
    assert.ok(inRegion(p));
  }
});
test("pareto puzzles have two to four efficient outcomes", () => {
  for (let seed = 1; seed <= 200; seed++) {
    const n = efficientSet(paretoPuzzle(new Rng(seed))).length;
    assert.ok(n >= 2 && n <= 4);
  }
});

// frag:cheap-talk
console.log("cheap talk");
test("a small bias leaves a cutoff, and a bias of a quarter or more leaves nothing to learn", () => {
  assert.ok(Math.abs(new CtTalk(0.05).cutoff() - 0.4) < 1e-9);
  assert.ok(Math.abs(new CtTalk(0.1).cutoff() - 0.3) < 1e-9);
  assert.equal(new CtTalk(0.25).cutoff(), 0);
  assert.equal(new CtTalk(0.4).cutoff(), 0);
  assert.equal(new CtTalk(0.3).informative(), false);
  assert.equal(new CtTalk(0.4).gain(), 0);
  assert.ok(new CtTalk(0.05).gain() > new CtTalk(0.2).gain());
  assert.ok(new CtTalk(0).gain() > 0.74);
});
test("believing a message pays only when the bias is small", () => {
  for (const r of CT_ROUNDS) {
    const believe = ctPay(ctLiteral(r.msg), r.state);
    const ignore = ctPay(0.5, r.state);
    assert.equal(believe > ignore, new CtTalk(r.b).informative());
  }
  assert.equal(ctPay(0.5, 0.5), 4);
  assert.equal(ctPay(0, 0.5), 0);
});
test("Prove gives two biases, at least one that leaves a cutoff, and the window is three points", () => {
  for (const b of [1, 2, 3, 4, 5]) assert.ok(ctProveSet(new Rng(b)).some((t) => t.informative()));
  assert.equal(ctProveSet(new Rng(1)).length, 2);
  assert.equal(CT_POOL.includes(0.05), true);
  assert.equal(ctRight(new CtTalk(0.1), 0.32), true);
  assert.equal(ctRight(new CtTalk(0.1), 0.4), false);
  assert.equal(ctRight(new CtTalk(0.35), 0), true);
});

// frag:bayesian-persuasion
console.log("bayesian persuasion");
test("saying guilty for some innocents raises convictions until the judge's belief falls to one half", () => {
  const m = new BpPersuasion(0.3);
  assert.ok(Math.abs(m.truth() - 0.3) < 1e-9);
  assert.ok(Math.abs(m.bestQ() - 0.3 / 0.7) < 1e-9);
  assert.ok(Math.abs(m.posterior(m.bestQ()) - 0.5) < 1e-9);
  assert.ok(Math.abs(m.best() - 0.6) < 1e-9);
  assert.equal(m.convict(0.5), 0);
  assert.ok(m.convict(0.2) > m.convict(0.1));
});
test("the best policy convicts with chance twice the prior, up to one", () => {
  for (const p of [0.1, 0.2, 0.25, 0.4, 0.45]) assert.ok(Math.abs(new BpPersuasion(p).best() - 2 * p) < 1e-9);
  assert.equal(new BpPersuasion(0.6).best(), 1);
  assert.equal(new BpPersuasion(0.6).truth(), 0.6);
  for (const p of BP_PRIORS) assert.ok(new BpPersuasion(p).best() >= new BpPersuasion(p).truth());
});
test("Prove uses priors other than the See prior, and the window is four points", () => {
  assert.ok(!BP_POOL.includes(BP_SEE));
  const s = bpProveSet(new Rng(3));
  assert.equal(s.length, 2);
  assert.notEqual(s[0]!.p, s[1]!.p);
  assert.equal(bpRight(new BpPersuasion(0.25), 0.35), true);
  assert.equal(bpRight(new BpPersuasion(0.25), 0.5), false);
});

// frag:mechanism-design
console.log("mechanism design");
test("when the other player picks first, the divider's best cut is even, and when the divider picks first it is lopsided", () => {
  const c = new MdCake(10, "chooser");
  assert.equal(c.share(5), 5);
  assert.equal(c.share(2), 2);
  assert.equal(c.share(0), 0);
  assert.equal(c.bestCut(), 5);
  const d = new MdCake(10, "divider");
  assert.equal(d.share(5), 5);
  assert.equal(d.share(2), 8);
  assert.equal(d.share(0), 10);
  assert.equal(d.bestCut(), 0);
  for (let a = 0; a <= 10; a++) assert.ok(c.share(a) <= c.share(5) && d.share(a) <= d.share(0));
});
test("each Feel round has one better cut under the chooser rule", () => {
  const c = new MdCake(MD_N, "chooser");
  for (const r of MD_ROUNDS) assert.notEqual(c.share(r.a), c.share(r.b));
});
test("Prove gives one chooser and one divider rule with different pies, and the answer index follows the rule", () => {
  for (const seed of [1, 2, 3, 4]) {
    const s = mdProveSet(new Rng(seed));
    assert.deepEqual(s.map((p) => p.cake.rule).sort(), ["chooser", "divider"]);
    assert.notEqual(s[0]!.cake.n, s[1]!.cake.n);
    for (const p of s) assert.equal(mdAnswer(p), p.cake.rule === "chooser" ? p.evenAt : 1 - p.evenAt);
  }
  assert.ok(MD_PROVE_N.every((n) => n !== MD_N));
});

// frag:revelation-principle
console.log("revelation principle");
test("telling the value to a mechanism that applies the strategy gives the same pay as playing the strategy", () => {
  for (const k of [0.5, 2 / 3, 0.8]) for (const v of [2, 5, 9]) for (const r of [1, 3, 6]) {
    const b = new RpBidder(k);
    assert.equal(b.direct(v, r), b.pay(v, b.bid(v), r));
  }
  assert.equal(RP_HALF.bid(8), 4);
  assert.equal(RP_HALF.pay(8, 4, 3), 4);
  assert.equal(RP_HALF.pay(8, 4, 4), 0);
});
test("in Feel, bidding your value never pays more than bidding half", () => {
  for (const r of RP_ROUNDS) {
    assert.equal(RP_HALF.pay(r.value, r.value, r.rival), 0);
    assert.ok(RP_HALF.pay(r.value, RP_HALF.bid(r.value), r.rival) >= 0);
  }
  assert.ok(RP_ROUNDS.some((r) => RP_HALF.pay(r.value, RP_HALF.bid(r.value), r.rival) > 0));
  assert.ok(RP_ROUNDS.some((r) => RP_HALF.pay(r.value, RP_HALF.bid(r.value), r.rival) === 0));
});
test("Prove machine bids are whole numbers and differ from the Feel half rule", () => {
  for (const c of RP_POOL) assert.ok(Math.abs(rpBid(c) - Math.round(rpBid(c))) < 1e-9);
  assert.equal(rpProveSet(new Rng(2)).length, 2);
  assert.equal(rpRight(RP_POOL[0]!, 6.1), true);
  assert.equal(rpRight(RP_POOL[0]!, 7), false);
});

// frag:vcg
console.log("vcg");
test("the winner pays the best rival value, and truth is never beaten by another report", () => {
  const s = new VcgSale(8, [5]);
  assert.equal(s.price(8), 5);
  assert.equal(s.price(4), 0);
  assert.equal(s.pay(8), 3);
  assert.equal(s.pay(4), 0);
  assert.equal(s.pay(10), 3);
  for (const x of [...VCG_POOL, VCG_SEE, new VcgSale(3, [3, 1]), new VcgSale(10, [2])]) assert.ok(x.truthIsBest());
});
test("lying only loses: shading below the best rival forfeits a win, inflating wins at a loss", () => {
  const r = VCG_ROUNDS;
  assert.equal(new VcgSale(r[0]!.value, [r[0]!.other]).pay(r[0]!.lie), 0);
  assert.ok(new VcgSale(r[0]!.value, [r[0]!.other]).pay(r[0]!.value) > 0);
  const inflate = new VcgSale(r[1]!.value, [r[1]!.other]);
  assert.ok(inflate.pay(r[1]!.lie) === inflate.value - inflate.best());
  assert.ok(inflate.value - inflate.best() < 0);
  assert.equal(inflate.pay(inflate.value), 0);
});
test("Prove gives one win and one loss, and the payment window is half a unit", () => {
  for (const seed of [1, 2, 3]) {
    const s = vcgProveSet(new Rng(seed));
    assert.equal(s.length, 2);
    assert.deepEqual(s.map((x) => x.value > x.best()).sort(), [false, true]);
  }
  assert.equal(vcgOwed(new VcgSale(9, [4, 7])), 7);
  assert.equal(vcgOwed(new VcgSale(6, [9, 2])), 0);
  assert.equal(vcgRight(new VcgSale(9, [4, 7]), 7.4), true);
  assert.equal(vcgRight(new VcgSale(9, [4, 7]), 4), false);
});

// frag:core
console.log("core");
test("a split is blocked when a pair gets less than it earns alone", () => {
  const g = new CoreTrio(8);
  assert.ok(g.stable([4, 4, 4]));
  assert.deepEqual(g.blocker([6, 3, 3]), [1, 2]);
  assert.deepEqual(g.blocker([3, 4, 5]), [0, 1]);
  assert.equal(g.mine([6, 3, 3]), 0);
  assert.equal(g.mine([4, 4, 4]), 4);
  assert.ok(CORE_SEE.stable([4, 4, 4]));
  assert.ok(!CORE_SEE.stable([11, 0.5, 0.5]));
});
test("Feel rounds always teach something and Prove gives one in and one out", () => {
  for (const r of CORE_ROUNDS) {
    const g = new CoreTrio(r.pair);
    assert.ok(g.mine(r.a) !== g.mine(r.b));
  }
  for (const seed of [1, 2, 3, 4]) {
    const s = coreProveSet(new Rng(seed));
    assert.deepEqual(s.map((c) => c.game.stable(c.x)).sort(), [false, true]);
  }
  for (const c of CORE_POOL) assert.equal(c.x[0] + c.x[1] + c.x[2], 12);
});

// frag:shapley-value
console.log("shapley value");
test("A's Shapley value is the average of six marginal contributions", () => {
  assert.equal(SH_SEE.shapley(), 3);
  assert.deepEqual(SH_SEE.orders().map((o) => o.add), [0, 0, 4, 6, 4, 4]);
  assert.equal(SH_POOL[0]!.shapley(), 3);
  assert.equal(SH_POOL[1]!.shapley(), 4);
  assert.equal(SH_POOL[2]!.shapley(), 3.5);
  assert.equal(SH_POOL[3]!.shapley(), 3.5);
});
test("Feel rounds make joining first and last differ and Prove answers are half steps", () => {
  for (const g of SH_ROUNDS) assert.ok(g.solo !== g.last());
  for (const g of SH_POOL) assert.equal((g.shapley() * 2) % 1, 0);
  assert.equal(shProveSet(new Rng(3)).length, 2);
  assert.equal(shRight(SH_POOL[0]!, 3), true);
  assert.equal(shRight(SH_POOL[0]!, 4), false);
});

// frag:banzhaf-index
console.log("banzhaf index");
test("swings are groups just short of the quota that the seat completes", () => {
  assert.equal(BZ_SEE.count(0), 2);
  assert.equal(BZ_SEE.count(1), 2);
  const c = new BzCouncil([4, 2, 1], 4);
  assert.equal(c.count(0), 4);
  assert.equal(c.count(1), 0);
  assert.equal(c.count(2), 0);
  assert.equal(new BzCouncil([3, 2, 1], 4).count(0), 3);
  assert.equal(new BzCouncil([3, 2, 1], 4).count(1), 1);
});
test("Feel rounds separate the two seats and Prove counts are small whole numbers", () => {
  for (const r of BZ_ROUNDS) {
    const c = new BzCouncil(r.w, r.q);
    assert.ok(Math.max(c.count(r.a), c.count(r.b)) <= 6);
  }
  assert.deepEqual(BZ_POOL.map(bzAnswer), [3, 2, 3, 2, 0]);
  assert.equal(bzProveSet(new Rng(5)).length, 2);
  assert.equal(bzRight(BZ_POOL[0]!, 3), true);
  assert.equal(bzRight(BZ_POOL[0]!, 1), false);
});

// frag:nucleolus
console.log("nucleolus");
test("the nucleolus equalises the pair excesses at the smallest worst value", () => {
  assert.equal(NU_SEE.best(), -2);
  assert.deepEqual(NU_SEE.split(), [6, 4, 2]);
  assert.equal(NU_SEE.worst([6, 4, 2]), -2);
  assert.equal(NU_SEE.worst([4, 4, 4]), 0);
  assert.deepEqual(NU_POOL.map((g) => g.best()), [-2, 0, -1, 1, 2]);
  for (const g of NU_POOL) {
    const s = g.split();
    assert.equal(s[0] + s[1] + s[2], 12);
    assert.ok(s.every((x) => x >= 0));
    assert.ok(Math.abs(g.worst(s) - g.best()) < 1e-9);
  }
});
test("no split beats the nucleolus, and Feel pay rewards the calmer split", () => {
  for (const g of NU_POOL) for (let a = 0; a <= 12; a++) for (let b = 0; a + b <= 12; b++) assert.ok(g.worst([a, b, 12 - a - b]) >= g.best() - 1e-9);
  for (const r of NU_ROUNDS) assert.ok(nuCalm(r.game, r.a) !== nuCalm(r.game, r.b));
  assert.equal(nuProveSet(new Rng(2)).length, 2);
  assert.equal(nuRight(NU_POOL[0]!, -2), true);
  assert.equal(nuRight(NU_POOL[0]!, 0), false);
});
test("unused import guard", () => { assert.ok(new NuBloc(1, 1, 1).total === 12); });

// frag:nash-bargaining
console.log("nash bargaining");
test("the product of gains peaks at the Nash share and the fallback adds to it", () => {
  assert.equal(NB_SEE.nash(), 7);
  assert.equal(NB_SEE.product(7), 16);
  assert.equal(NB_SEE.product(3), 0);
  for (const g of [NB_SEE, ...NB_POOL]) for (let x = 0; x <= g.total; x += 0.5) assert.ok(g.product(x) <= g.product(g.nash()) + 1e-9);
  assert.deepEqual(NB_POOL.map((g) => g.nash()), [7, 5, 10, 5, 4]);
});
test("Feel: splitting evenly is refused exactly when your fallback is below theirs", () => {
  for (const g of NB_ROUNDS) {
    assert.equal(g.accepts(g.nash()), true);
    assert.equal(g.accepts(g.total / 2), g.d1 >= g.d2);
    assert.ok(g.pay(g.nash()) !== g.pay(g.total / 2));
  }
  assert.equal(nbProveSet(new Rng(4)).length, 2);
  assert.equal(nbRight(NB_POOL[0]!, 7), true);
  assert.equal(nbRight(NB_POOL[0]!, 6), false);
});

console.log(`\n${passed} tests passed`);
