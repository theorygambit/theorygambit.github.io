import type { Rng } from "../../core/Rng";

export type Move = "safe" | "bold";

/**
 * A race to `goal`. Each round the rival gains 1. You gain 1 with Safe, or with Bold you gain 2 half the time and nothing otherwise.
 * If both reach the goal in the same round the rival wins the tie.
 */
export class Race {
  readonly goal: number;
  readonly boldP: number;
  private readonly memo = new Map<string, number>();

  constructor(goal = 6, boldP = 0.5) {
    this.goal = goal;
    this.boldP = boldP;
  }

  /** Chance to win from (a, b) if you play `move` now and the best moves after. */
  value(a: number, b: number, move: Move): number {
    const rival = b + 1;
    const outcomes: [number, number][] = move === "safe" ? [[a + 1, 1]] : [[a + 2, this.boldP], [a, 1 - this.boldP]];
    let v = 0;
    for (const [na, pr] of outcomes) {
      if (rival >= this.goal) continue;
      if (na >= this.goal) v += pr;
      else v += pr * this.win(na, rival);
    }
    return v;
  }

  /** Best chance to win from (a, b). */
  win(a: number, b: number): number {
    const k = `${a},${b}`;
    const hit = this.memo.get(k);
    if (hit !== undefined) return hit;
    const v = Math.max(this.value(a, b, "safe"), this.value(a, b, "bold"));
    this.memo.set(k, v);
    return v;
  }

  best(a: number, b: number): Move {
    return this.value(a, b, "bold") > this.value(a, b, "safe") ? "bold" : "safe";
  }

  /** Chance to win if you always play the same move. */
  always(move: Move, a = 0, b = 0): number {
    const rival = b + 1;
    const outcomes: [number, number][] = move === "safe" ? [[a + 1, 1]] : [[a + 2, this.boldP], [a, 1 - this.boldP]];
    let v = 0;
    for (const [na, pr] of outcomes) {
      if (rival >= this.goal) continue;
      v += na >= this.goal ? pr : pr * this.always(move, na, rival);
    }
    return v;
  }
}

/** A rally of up to `rounds` turns. Bold earns you 2 points but breaks the rally with chance `breakP`. */
export class Rally {
  readonly rounds: number;
  readonly breakP: number;

  constructor(rounds = 6, breakP = 0.4) {
    this.rounds = rounds;
    this.breakP = breakP;
  }

  /** Expected length if you always play Bold. Safe always lasts every round. */
  get boldLength(): number {
    let e = 0;
    let alive = 1;
    for (let t = 0; t < this.rounds; t++) {
      e += alive;
      alive *= 1 - this.breakP;
    }
    return e;
  }
}

export const FEEL_RACE = new Race(6, 0.5);
export const FEEL_RALLY = new Rally(6, 0.4);

export interface Case {
  kind: "race" | "rally";
  a: number;
  b: number;
  goal: number;
  answer: Move;
}

/** Three cases: a race you are losing, a race you are winning, and a rally. */
export function proveCases(rng: Rng): Case[] {
  const race = new Race(rng.chance(0.5) ? 6 : 7, 0.5);
  const behind: [number, number][] = [];
  const ahead: [number, number][] = [];
  for (let a = 0; a < race.goal; a++) {
    for (let b = 0; b < race.goal; b++) {
      const d = race.value(a, b, "bold") - race.value(a, b, "safe");
      if (d >= 0.12 && a < b) behind.push([a, b]);
      if (d <= -0.12 && a > b) ahead.push([a, b]);
    }
  }
  const [ba, bb] = rng.pick(behind);
  const [aa, ab] = rng.pick(ahead);
  const cases: Case[] = [
    { kind: "race", a: ba, b: bb, goal: race.goal, answer: "bold" },
    { kind: "race", a: aa, b: ab, goal: race.goal, answer: "safe" },
    { kind: "rally", a: 0, b: 0, goal: 0, answer: "safe" },
  ];
  return rng.shuffle(cases);
}
