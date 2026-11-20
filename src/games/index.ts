import { GameRegistry } from "../core/Registry";
import { beautyContest } from "./beauty-contest";
import { bertrand } from "./bertrand";
import { colonelBlotto } from "./colonel-blotto";
import { cournot } from "./cournot";
import { dollarAuction } from "./dollar-auction";
import { dominantStrategy } from "./dominant-strategy";
import { dynamicGames } from "./dynamic-games";
import { hotelling } from "./hotelling";
import { matchingPennies } from "./matching-pennies";
import { prisonersDilemma } from "./prisoners-dilemma";
import { repeatedGames } from "./repeated-games";
import { stackelberg } from "./stackelberg";
import { stagHunt } from "./stag-hunt";
import { ultimatum } from "./ultimatum";
import { volunteersDilemma } from "./volunteers-dilemma";

/** Add a game here once its module exists. Order in the app comes from src/catalog/curriculum.ts. */
export function registerGames(): void {
  for (const m of [
    dominantStrategy,
    prisonersDilemma,
    matchingPennies,
    stagHunt,
    ultimatum,
    beautyContest,
    bertrand,
    colonelBlotto,
    cournot,
    dollarAuction,
    dynamicGames,
    hotelling,
    repeatedGames,
    stackelberg,
    volunteersDilemma,
  ]) GameRegistry.register(m);
}
