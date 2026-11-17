import type { Game, GameEnv } from "./Game";
import type { TheoryEntry } from "../theory/types";

export interface GameModule {
  slug: string;
  /** One short line for the home list. */
  hook: string;
  create: (env: GameEnv) => Game;
  theory: TheoryEntry;
}

/** Every playable game registers here. Slots without a module render as empty. */
export class GameRegistry {
  private static readonly modules = new Map<string, GameModule>();

  static register(module: GameModule): void {
    GameRegistry.modules.set(module.slug, module);
  }

  static has(slug: string): boolean {
    return GameRegistry.modules.has(slug);
  }

  static get(slug: string): GameModule | undefined {
    return GameRegistry.modules.get(slug);
  }

  static slugs(): string[] {
    return [...GameRegistry.modules.keys()];
  }
}
