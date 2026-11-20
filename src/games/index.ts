import { GameRegistry } from "../core/Registry";
import { dominantStrategy } from "./dominant-strategy";
import { matchingPennies } from "./matching-pennies";
import { prisonersDilemma } from "./prisoners-dilemma";
import { stagHunt } from "./stag-hunt";
import { ultimatum } from "./ultimatum";
import { informationTypes } from "./information-types";
import { shortLongGames } from "./short-long-games";
import { iteratedElimination } from "./iterated-elimination";
import { nashEquilibrium } from "./nash-equilibrium";
import { mixedStrategy } from "./mixed-strategy";
import { minimaxTheorem } from "./minimax-theorem";
import { backwardInduction } from "./backward-induction";
import { publicGoods } from "./public-goods";
import { centipede } from "./centipede";
import { travelersDilemma } from "./travelers-dilemma";
import { focalPoints } from "./focal-points";
import { chicken } from "./chicken";
import { battleOfSexes } from "./battle-of-sexes";
import { dictator } from "./dictator";
import { trustGame } from "./trust-game";
import { tragedyCommons } from "./tragedy-commons";
import { axelrodTitForTat } from "./axelrod-tit-for-tat";
import { flowTheory } from "./flow-theory";
import { designEthics } from "./design-ethics";
import { expectedUtility } from "./expected-utility";
import { beautyContest } from "./beauty-contest";
import { bertrand } from "./bertrand";
import { colonelBlotto } from "./colonel-blotto";
import { cournot } from "./cournot";
import { dollarAuction } from "./dollar-auction";
import { dynamicGames } from "./dynamic-games";
import { hotelling } from "./hotelling";
import { repeatedGames } from "./repeated-games";
import { stackelberg } from "./stackelberg";
import { volunteersDilemma } from "./volunteers-dilemma";

/** Add a game here once its module exists. Order in the app comes from src/catalog/curriculum.ts. */
export function registerGames(): void {
  const games = [
    // Slots 1 to 15
    dominantStrategy,
    prisonersDilemma,
    matchingPennies,
    stagHunt,
    ultimatum,
    informationTypes,
    shortLongGames,
    iteratedElimination,
    nashEquilibrium,
    mixedStrategy,
    minimaxTheorem,
    backwardInduction,
    publicGoods,
    centipede,
    travelersDilemma,
    // Slots 16 to 25
    focalPoints,
    chicken,
    battleOfSexes,
    dictator,
    trustGame,
    tragedyCommons,
    axelrodTitForTat,
    flowTheory,
    designEthics,
    expectedUtility,
    // Slots 36 to 45
    volunteersDilemma,
    beautyContest,
    bertrand,
    colonelBlotto,
    cournot,
    dollarAuction,
    dynamicGames,
    hotelling,
    repeatedGames,
    stackelberg,
  ];
  for (const m of games) GameRegistry.register(m);
}
