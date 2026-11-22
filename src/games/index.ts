import { GameRegistry } from "../core/Registry";
import { allaisParadox } from "./allais-paradox";
import { auctions } from "./auctions";
import { axelrodTitForTat } from "./axelrod-tit-for-tat";
import { backwardInduction } from "./backward-induction";
import { banzhafIndex } from "./banzhaf-index";
import { battleOfSexes } from "./battle-of-sexes";
import { bayesianPersuasion } from "./bayesian-persuasion";
import { beautyContest } from "./beauty-contest";
import { behavioralGameTheory } from "./behavioral-game-theory";
import { bertrand } from "./bertrand";
import { breakingFrames } from "./breaking-frames";
import { centipede } from "./centipede";
import { cheapTalk } from "./cheap-talk";
import { chicken } from "./chicken";
import { colonelBlotto } from "./colonel-blotto";
import { commitmentCredibility } from "./commitment-credibility";
import { contextAwareRecsys } from "./context-aware-recsys";
import { contextualBandits } from "./contextual-bandits";
import { cooperativeGames } from "./cooperative-games";
import { core } from "./core";
import { correlatedEquilibrium } from "./correlated-equilibrium";
import { cournot } from "./cournot";
import { designEthics } from "./design-ethics";
import { desirabilityRsrr } from "./desirability-rsrr";
import { dictator } from "./dictator";
import { dollarAuction } from "./dollar-auction";
import { dominantStrategy } from "./dominant-strategy";
import { dynamicDifficulty } from "./dynamic-difficulty";
import { dynamicGames } from "./dynamic-games";
import { ellsbergAmbiguity } from "./ellsberg-ambiguity";
import { eloTrueSkill } from "./elo-trueskill";
import { engagementStack } from "./engagement-stack";
import { evolutionaryGameTheory } from "./evolutionary-game-theory";
import { expectedUtility } from "./expected-utility";
import { fictitiousPlay } from "./fictitious-play";
import { finiteInfiniteGames } from "./finite-infinite-games";
import { flowTheory } from "./flow-theory";
import { focalPoints } from "./focal-points";
import { gameSelection } from "./game-selection";
import { hotelling } from "./hotelling";
import { hyperbolicDiscounting } from "./hyperbolic-discounting";
import { hypergameLevels } from "./hypergame-levels";
import { hypergameTheory } from "./hypergame-theory";
import { inequityAversion } from "./inequity-aversion";
import { informationTypes } from "./information-types";
import { iteratedElimination } from "./iterated-elimination";
import { lemkeHowson } from "./lemke-howson";
import { lemonsAdverseSelection } from "./lemons-adverse-selection";
import { levelK } from "./level-k";
import { linearProgrammingZeroSum } from "./linear-programming-zero-sum";
import { lossAversionStreaks } from "./loss-aversion-streaks";
import { ltvPrediction } from "./ltv-prediction";
import { marlSelfPlay } from "./marl-self-play";
import { matching } from "./matching";
import { matchingPennies } from "./matching-pennies";
import { mcts } from "./mcts";
import { mechanismDesign } from "./mechanism-design";
import { metagameHoward } from "./metagame-howard";
import { minimaxAlphaBeta } from "./minimax-alpha-beta";
import { minimaxTheorem } from "./minimax-theorem";
import { mixedStrategy } from "./mixed-strategy";
import { multiplicativeWeights } from "./multiplicative-weights";
import { multipolarTraps } from "./multipolar-traps";
import { nashBargaining } from "./nash-bargaining";
import { nashEquilibrium } from "./nash-equilibrium";
import { nearMissEffect } from "./near-miss-effect";
import { negativeSum } from "./negative-sum";
import { normalVsExtensive } from "./normal-vs-extensive";
import { nucleolus } from "./nucleolus";
import { paretoEfficiency } from "./pareto-efficiency";
import { perfectBayesian } from "./perfect-bayesian";
import { personalizedPricing } from "./personalized-pricing";
import { playersCount } from "./players-count";
import { positiveSum } from "./positive-sum";
import { preferenceManipulation } from "./preference-manipulation";
import { prisonersDilemma } from "./prisoners-dilemma";
import { prospectTheory } from "./prospect-theory";
import { publicGoods } from "./public-goods";
import { quantalResponse } from "./quantal-response";
import { rationalityCommonKnowledge } from "./rationality-common-knowledge";
import { reciprocityFairness } from "./reciprocity-fairness";
import { regretMatchingCfr } from "./regret-matching-cfr";
import { repeatedGames } from "./repeated-games";
import { revelationPrinciple } from "./revelation-principle";
import { rubinsteinBargaining } from "./rubinstein-bargaining";
import { rulesEngines } from "./rules-engines";
import { sequentialEquilibrium } from "./sequential-equilibrium";
import { shapleyValue } from "./shapley-value";
import { shortLongGames } from "./short-long-games";
import { simultaneousSequential } from "./simultaneous-sequential";
import { spitefulPreferences } from "./spiteful-preferences";
import { stackelberg } from "./stackelberg";
import { stagHunt } from "./stag-hunt";
import { subgamePerfect } from "./subgame-perfect";
import { sunkCostEndowment } from "./sunk-cost-endowment";
import { synthesisBoard } from "./synthesis-board";
import { synthesisFrames } from "./synthesis-frames";
import { taxonomy } from "./taxonomy";
import { tragedyCommons } from "./tragedy-commons";
import { travelersDilemma } from "./travelers-dilemma";
import { tremblingHand } from "./trembling-hand";
import { trustGame } from "./trust-game";
import { ultimatum } from "./ultimatum";
import { vcg } from "./vcg";
import { volunteersDilemma } from "./volunteers-dilemma";
import { whatIsAGame } from "./what-is-a-game";
import { zermeloSpragueGrundy } from "./zermelo-sprague-grundy";
import { zeroSum } from "./zero-sum";

/** Every playable game. Order in the app comes from src/catalog/curriculum.ts, not from this list. */
const MODULES = [
  allaisParadox,
  auctions,
  axelrodTitForTat,
  backwardInduction,
  banzhafIndex,
  battleOfSexes,
  bayesianPersuasion,
  beautyContest,
  behavioralGameTheory,
  bertrand,
  breakingFrames,
  centipede,
  cheapTalk,
  chicken,
  colonelBlotto,
  commitmentCredibility,
  contextAwareRecsys,
  contextualBandits,
  cooperativeGames,
  core,
  correlatedEquilibrium,
  cournot,
  designEthics,
  desirabilityRsrr,
  dictator,
  dollarAuction,
  dominantStrategy,
  dynamicDifficulty,
  dynamicGames,
  ellsbergAmbiguity,
  eloTrueSkill,
  engagementStack,
  evolutionaryGameTheory,
  expectedUtility,
  fictitiousPlay,
  finiteInfiniteGames,
  flowTheory,
  focalPoints,
  gameSelection,
  hotelling,
  hyperbolicDiscounting,
  hypergameLevels,
  hypergameTheory,
  inequityAversion,
  informationTypes,
  iteratedElimination,
  lemkeHowson,
  lemonsAdverseSelection,
  levelK,
  linearProgrammingZeroSum,
  lossAversionStreaks,
  ltvPrediction,
  marlSelfPlay,
  matching,
  matchingPennies,
  mcts,
  mechanismDesign,
  metagameHoward,
  minimaxAlphaBeta,
  minimaxTheorem,
  mixedStrategy,
  multiplicativeWeights,
  multipolarTraps,
  nashBargaining,
  nashEquilibrium,
  nearMissEffect,
  negativeSum,
  normalVsExtensive,
  nucleolus,
  paretoEfficiency,
  perfectBayesian,
  personalizedPricing,
  playersCount,
  positiveSum,
  preferenceManipulation,
  prisonersDilemma,
  prospectTheory,
  publicGoods,
  quantalResponse,
  rationalityCommonKnowledge,
  reciprocityFairness,
  regretMatchingCfr,
  repeatedGames,
  revelationPrinciple,
  rubinsteinBargaining,
  rulesEngines,
  sequentialEquilibrium,
  shapleyValue,
  shortLongGames,
  simultaneousSequential,
  spitefulPreferences,
  stackelberg,
  stagHunt,
  subgamePerfect,
  sunkCostEndowment,
  synthesisBoard,
  synthesisFrames,
  taxonomy,
  tragedyCommons,
  travelersDilemma,
  tremblingHand,
  trustGame,
  ultimatum,
  vcg,
  volunteersDilemma,
  whatIsAGame,
  zermeloSpragueGrundy,
  zeroSum,
];

export function registerGames(): void {
  for (const m of MODULES) GameRegistry.register(m);
}
