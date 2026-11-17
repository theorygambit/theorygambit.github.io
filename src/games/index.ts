import { GameRegistry } from "../core/Registry";
import { dominantStrategy } from "./dominant-strategy";
import { matchingPennies } from "./matching-pennies";
import { prisonersDilemma } from "./prisoners-dilemma";
import { stagHunt } from "./stag-hunt";
import { ultimatum } from "./ultimatum";

/** Add a game here once its module exists. Order in the app comes from src/catalog/curriculum.ts. */
export function registerGames(): void {
  for (const m of [dominantStrategy, prisonersDilemma, matchingPennies, stagHunt, ultimatum]) GameRegistry.register(m);
}
