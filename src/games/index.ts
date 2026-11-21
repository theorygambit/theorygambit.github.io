import { GameRegistry } from "../core/Registry";
import { allaisParadox } from "./allais-paradox";
import { auctions } from "./auctions";
import { axelrodTitForTat } from "./axelrod-tit-for-tat";
import { backwardInduction } from "./backward-induction";
import { battleOfSexes } from "./battle-of-sexes";
import { beautyContest } from "./beauty-contest";
import { behavioralGameTheory } from "./behavioral-game-theory";
import { bertrand } from "./bertrand";
import { centipede } from "./centipede";
import { chicken } from "./chicken";
import { colonelBlotto } from "./colonel-blotto";
import { cooperativeGames } from "./cooperative-games";
import { cournot } from "./cournot";
import { designEthics } from "./design-ethics";
import { dictator } from "./dictator";
import { dollarAuction } from "./dollar-auction";
import { dominantStrategy } from "./dominant-strategy";
import { dynamicGames } from "./dynamic-games";
import { evolutionaryGameTheory } from "./evolutionary-game-theory";
import { expectedUtility } from "./expected-utility";
import { flowTheory } from "./flow-theory";
import { focalPoints } from "./focal-points";
import { hotelling } from "./hotelling";
import { informationTypes } from "./information-types";
import { iteratedElimination } from "./iterated-elimination";
import { lemonsAdverseSelection } from "./lemons-adverse-selection";
import { lossAversionStreaks } from "./loss-aversion-streaks";
import { matching } from "./matching";
import { matchingPennies } from "./matching-pennies";
import { minimaxTheorem } from "./minimax-theorem";
import { mixedStrategy } from "./mixed-strategy";
import { nashEquilibrium } from "./nash-equilibrium";
import { preferenceManipulation } from "./preference-manipulation";
import { prisonersDilemma } from "./prisoners-dilemma";
import { prospectTheory } from "./prospect-theory";
import { publicGoods } from "./public-goods";
import { repeatedGames } from "./repeated-games";
import { shortLongGames } from "./short-long-games";
import { stackelberg } from "./stackelberg";
import { stagHunt } from "./stag-hunt";
import { tragedyCommons } from "./tragedy-commons";
import { travelersDilemma } from "./travelers-dilemma";
import { trustGame } from "./trust-game";
import { ultimatum } from "./ultimatum";
import { volunteersDilemma } from "./volunteers-dilemma";

/** Every playable game. Order in the app comes from src/catalog/curriculum.ts, not from this list. */
const MODULES = [
  allaisParadox,
  auctions,
  axelrodTitForTat,
  backwardInduction,
  battleOfSexes,
  beautyContest,
  behavioralGameTheory,
  bertrand,
  centipede,
  chicken,
  colonelBlotto,
  cooperativeGames,
  cournot,
  designEthics,
  dictator,
  dollarAuction,
  dominantStrategy,
  dynamicGames,
  evolutionaryGameTheory,
  expectedUtility,
  flowTheory,
  focalPoints,
  hotelling,
  informationTypes,
  iteratedElimination,
  lemonsAdverseSelection,
  lossAversionStreaks,
  matching,
  matchingPennies,
  minimaxTheorem,
  mixedStrategy,
  nashEquilibrium,
  preferenceManipulation,
  prisonersDilemma,
  prospectTheory,
  publicGoods,
  repeatedGames,
  shortLongGames,
  stackelberg,
  stagHunt,
  tragedyCommons,
  travelersDilemma,
  trustGame,
  ultimatum,
  volunteersDilemma,
];

export function registerGames(): void {
  for (const m of MODULES) GameRegistry.register(m);
}
