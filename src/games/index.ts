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
import { centipede } from "./centipede";
import { cheapTalk } from "./cheap-talk";
import { chicken } from "./chicken";
import { colonelBlotto } from "./colonel-blotto";
import { cooperativeGames } from "./cooperative-games";
import { core } from "./core";
import { correlatedEquilibrium } from "./correlated-equilibrium";
import { cournot } from "./cournot";
import { designEthics } from "./design-ethics";
import { dictator } from "./dictator";
import { dollarAuction } from "./dollar-auction";
import { dominantStrategy } from "./dominant-strategy";
import { dynamicDifficulty } from "./dynamic-difficulty";
import { dynamicGames } from "./dynamic-games";
import { eloTrueSkill } from "./elo-trueskill";
import { engagementStack } from "./engagement-stack";
import { evolutionaryGameTheory } from "./evolutionary-game-theory";
import { expectedUtility } from "./expected-utility";
import { flowTheory } from "./flow-theory";
import { focalPoints } from "./focal-points";
import { hotelling } from "./hotelling";
import { informationTypes } from "./information-types";
import { iteratedElimination } from "./iterated-elimination";
import { lemonsAdverseSelection } from "./lemons-adverse-selection";
import { lossAversionStreaks } from "./loss-aversion-streaks";
import { ltvPrediction } from "./ltv-prediction";
import { matching } from "./matching";
import { matchingPennies } from "./matching-pennies";
import { mechanismDesign } from "./mechanism-design";
import { minimaxTheorem } from "./minimax-theorem";
import { mixedStrategy } from "./mixed-strategy";
import { nashBargaining } from "./nash-bargaining";
import { nashEquilibrium } from "./nash-equilibrium";
import { negativeSum } from "./negative-sum";
import { normalVsExtensive } from "./normal-vs-extensive";
import { nucleolus } from "./nucleolus";
import { paretoEfficiency } from "./pareto-efficiency";
import { perfectBayesian } from "./perfect-bayesian";
import { playersCount } from "./players-count";
import { positiveSum } from "./positive-sum";
import { preferenceManipulation } from "./preference-manipulation";
import { prisonersDilemma } from "./prisoners-dilemma";
import { prospectTheory } from "./prospect-theory";
import { publicGoods } from "./public-goods";
import { rationalityCommonKnowledge } from "./rationality-common-knowledge";
import { repeatedGames } from "./repeated-games";
import { revelationPrinciple } from "./revelation-principle";
import { rulesEngines } from "./rules-engines";
import { sequentialEquilibrium } from "./sequential-equilibrium";
import { shapleyValue } from "./shapley-value";
import { shortLongGames } from "./short-long-games";
import { simultaneousSequential } from "./simultaneous-sequential";
import { stackelberg } from "./stackelberg";
import { stagHunt } from "./stag-hunt";
import { subgamePerfect } from "./subgame-perfect";
import { taxonomy } from "./taxonomy";
import { tragedyCommons } from "./tragedy-commons";
import { travelersDilemma } from "./travelers-dilemma";
import { tremblingHand } from "./trembling-hand";
import { trustGame } from "./trust-game";
import { ultimatum } from "./ultimatum";
import { vcg } from "./vcg";
import { volunteersDilemma } from "./volunteers-dilemma";
import { whatIsAGame } from "./what-is-a-game";
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
  centipede,
  cheapTalk,
  chicken,
  colonelBlotto,
  cooperativeGames,
  core,
  correlatedEquilibrium,
  cournot,
  designEthics,
  dictator,
  dollarAuction,
  dominantStrategy,
  dynamicDifficulty,
  dynamicGames,
  eloTrueSkill,
  engagementStack,
  evolutionaryGameTheory,
  expectedUtility,
  flowTheory,
  focalPoints,
  hotelling,
  informationTypes,
  iteratedElimination,
  lemonsAdverseSelection,
  lossAversionStreaks,
  ltvPrediction,
  matching,
  matchingPennies,
  mechanismDesign,
  minimaxTheorem,
  mixedStrategy,
  nashBargaining,
  nashEquilibrium,
  negativeSum,
  normalVsExtensive,
  nucleolus,
  paretoEfficiency,
  perfectBayesian,
  playersCount,
  positiveSum,
  preferenceManipulation,
  prisonersDilemma,
  prospectTheory,
  publicGoods,
  rationalityCommonKnowledge,
  repeatedGames,
  revelationPrinciple,
  rulesEngines,
  sequentialEquilibrium,
  shapleyValue,
  shortLongGames,
  simultaneousSequential,
  stackelberg,
  stagHunt,
  subgamePerfect,
  taxonomy,
  tragedyCommons,
  travelersDilemma,
  tremblingHand,
  trustGame,
  ultimatum,
  vcg,
  volunteersDilemma,
  whatIsAGame,
  zeroSum,
];

export function registerGames(): void {
  for (const m of MODULES) GameRegistry.register(m);
}
