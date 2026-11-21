import type { Rng } from "../../core/Rng";

export type Trait = "paid" | "idle" | "rookie";
export type Offer = "gift" | "bonus" | "pack" | "none";

export const TRAITS: readonly Trait[] = ["paid", "idle", "rookie"];
export const OFFERS: readonly Offer[] = ["gift", "bonus", "pack", "none"];

export interface Rule {
  when: Trait;
  give: Offer;
}

/** An ordered list of rules. The first rule whose condition holds fires. If none does, the default gives nothing. */
export class RuleList {
  readonly rules: readonly Rule[];

  constructor(rules: readonly Rule[]) {
    this.rules = rules;
  }

  /** Indexes of every rule whose condition holds. */
  matches(traits: readonly Trait[]): number[] {
    const out: number[] = [];
    this.rules.forEach((r, i) => {
      if (traits.includes(r.when)) out.push(i);
    });
    return out;
  }

  /** The rule that fires, or -1 for the default. */
  fired(traits: readonly Trait[]): number {
    const m = this.matches(traits);
    return m.length ? m[0]! : -1;
  }

  offer(traits: readonly Trait[]): Offer {
    const i = this.fired(traits);
    return i < 0 ? "none" : this.rules[i]!.give;
  }

  /** The same list with rule i moved to the top. */
  toTop(i: number): RuleList {
    const r = [this.rules[i]!, ...this.rules.filter((_, j) => j !== i)];
    return new RuleList(r);
  }
}

export const FEEL_LIST = new RuleList([
  { when: "paid", give: "pack" },
  { when: "idle", give: "bonus" },
  { when: "rookie", give: "gift" },
]);

export const FEEL_ROUNDS = 5;

/** Players for the Feel rounds. Some match several rules, one matches none. */
export const FEEL_PLAYERS: readonly (readonly Trait[])[] = [
  ["paid", "idle"],
  ["idle"],
  ["rookie"],
  ["idle", "rookie"],
  ["paid", "rookie"],
  [],
];

export function feelPlayers(rng: Rng): (readonly Trait[])[] {
  return rng.shuffle(FEEL_PLAYERS).slice(0, FEEL_ROUNDS);
}

/** See: one player who matches every rule, so the order alone decides. */
export const SEE_PLAYER: readonly Trait[] = ["paid", "idle", "rookie"];

export interface RulePuzzle {
  list: RuleList;
  traits: readonly Trait[];
}

export const PROVE_POOL: readonly RulePuzzle[] = [
  { list: new RuleList([{ when: "idle", give: "gift" }, { when: "paid", give: "bonus" }, { when: "rookie", give: "pack" }]), traits: ["paid", "idle"] },
  { list: new RuleList([{ when: "rookie", give: "bonus" }, { when: "idle", give: "pack" }, { when: "paid", give: "gift" }]), traits: ["idle", "rookie", "paid"] },
  { list: new RuleList([{ when: "paid", give: "gift" }, { when: "rookie", give: "bonus" }, { when: "idle", give: "pack" }]), traits: ["rookie", "paid"] },
  { list: new RuleList([{ when: "rookie", give: "pack" }, { when: "paid", give: "gift" }, { when: "idle", give: "bonus" }]), traits: ["paid", "idle"] },
];

export function proveSet(rng: Rng): RulePuzzle[] {
  return rng.shuffle(PROVE_POOL).slice(0, 2);
}
