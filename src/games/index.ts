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

/** Add a game here once its module exists. Order in the app comes from src/catalog/curriculum.ts. */
export function registerGames(): void {
  for (const m of [dominantStrategy, prisonersDilemma, matchingPennies, stagHunt, ultimatum, informationTypes, shortLongGames, iteratedElimination, nashEquilibrium, mixedStrategy, minimaxTheorem, backwardInduction, publicGoods, centipede, travelersDilemma]) GameRegistry.register(m);
}
