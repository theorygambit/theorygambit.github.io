import { GameRegistry } from "../core/Registry";
import { dominantStrategy } from "./dominant-strategy";

/** Add a game here once its module exists. Order in the app comes from src/catalog/curriculum.ts. */
export function registerGames(): void {
  for (const m of [dominantStrategy]) GameRegistry.register(m);
}
