import type { Rng } from "../../core/Rng";

export type Move = "hold" | "break";

/** The Prisoner's Dilemma payoffs: hold with hold 3 each, break against hold 5 and 0, break with break 1 each. */
export function pay(you: Move, them: Move): number {
  if (you === "hold") return them === "hold" ? 3 : 0;
  return them === "hold" ? 5 : 1;
}

export interface Strategy {
  readonly id: string;
  readonly name: string;
  /** Next move, given both histories. */
  move(own: readonly Move[], theirs: readonly Move[]): Move;
}

const make = (id: string, name: string, move: Strategy["move"]): Strategy => ({ id, name, move });

export const ALWAYS_HOLD = make("allc", "Always hold", () => "hold");
export const ALWAYS_BREAK = make("alld", "Always break", () => "break");
/** Start nice, then copy the last move. Forgiveness is built in: one hold from them and it holds again. */
export const TIT_FOR_TAT = make("tft", "Tit for tat", (_o, t) => (t.length ? t[t.length - 1]! : "hold"));
export const GRUDGER = make("grim", "Grudger", (_o, t) => (t.includes("break") ? "break" : "hold"));
export const TESTER = make("test", "Tester", (_o, t) => (t.length ? t[t.length - 1]! : "break"));

/** The field in the See tournament. */
export const FIELD: readonly Strategy[] = [ALWAYS_HOLD, ALWAYS_BREAK, GRUDGER, TESTER, TIT_FOR_TAT];

export const ROUNDS = 10;

export interface Match {
  a: number;
  b: number;
  ha: Move[];
  hb: Move[];
}

export function play(a: Strategy, b: Strategy, rounds = ROUNDS): Match {
  const ha: Move[] = [];
  const hb: Move[] = [];
  let sa = 0;
  let sb = 0;
  for (let i = 0; i < rounds; i++) {
    const x = a.move(ha, hb);
    const y = b.move(hb, ha);
    ha.push(x);
    hb.push(y);
    sa += pay(x, y);
    sb += pay(y, x);
  }
  return { a: sa, b: sb, ha, hb };
}

/** Round robin, every strategy against every strategy including itself. Returns total score by strategy. */
export function tournament(field: readonly Strategy[] = FIELD, rounds = ROUNDS): number[] {
  return field.map((s) => field.reduce((sum, o) => sum + play(s, o, rounds).a, 0));
}

/** Matches a strategy won outright against a different strategy. */
export function headToHeadWins(s: Strategy, field: readonly Strategy[] = FIELD, rounds = ROUNDS): number {
  return field.filter((o) => o !== s && play(s, o, rounds).a > play(s, o, rounds).b).length;
}

export interface Reading {
  theirs: Move[];
  /** What Tit for Tat plays against it. */
  answer: Move[];
}

export function tftAnswer(theirs: readonly Move[]): Move[] {
  return theirs.map((_, i) => TIT_FOR_TAT.move([], theirs.slice(0, i)));
}

/** Two new sequences, each with a break followed by a hold, so forgiveness is tested. */
export function proveReadings(rng: Rng): Reading[] {
  const make = (): Reading => {
    for (;;) {
      const theirs: Move[] = Array.from({ length: 5 }, () => (rng.chance(0.5) ? "break" : "hold"));
      const forgives = theirs.some((m, i) => i < 3 && m === "break" && theirs[i + 1] === "hold");
      const breaks = theirs.filter((m) => m === "break").length;
      if (forgives && breaks >= 2 && breaks <= 3) return { theirs, answer: tftAnswer(theirs) };
    }
  };
  const a = make();
  let b = make();
  while (b.theirs.join() === a.theirs.join()) b = make();
  return [a, b];
}

/** What a partner who always holds would have scored you, for the counterfactual. */
export const holdAllScore = (rounds: number): number => pay("hold", "hold") * rounds;
