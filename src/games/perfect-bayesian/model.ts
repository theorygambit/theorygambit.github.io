import type { Rng } from "../../core/Rng";

/**
 * A signaling market. A share p of senders are strong. Strong ones send the signal (a degree) with chance s,
 * weak ones with chance w. A receiver who sees the signal updates: the share that are strong among those who sent it.
 */
export class Market {
  readonly p: number;
  readonly s: number;
  readonly w: number;

  constructor(p: number, s: number, w: number) {
    this.p = p;
    this.s = s;
    this.w = w;
  }

  /** How many strong and weak senders show this signal, out of n. */
  counts(sent: boolean, n: number): { strong: number; weak: number } {
    return { strong: n * this.p * (sent ? this.s : 1 - this.s), weak: n * (1 - this.p) * (sent ? this.w : 1 - this.w) };
  }

  /** Chance a sender is strong, given the signal (Bayes). */
  posterior(sent: boolean): number {
    const c = this.counts(sent, 1);
    return c.strong / (c.strong + c.weak);
  }
}

/** Hiring a strong sender pays HIRE, a weak one pays 0. Passing pays PASS for sure. */
export const HIRE = 4;
export const PASS = 2;

export const hireValue = (post: number): number => HIRE * post;
export const bestMove = (post: number): "hire" | "pass" | "tie" => (Math.abs(hireValue(post) - PASS) < 1e-9 ? "tie" : hireValue(post) > PASS ? "hire" : "pass");

export const FEEL = new Market(0.5, 0.8, 0.2);
export const FEEL_ROUNDS = 4;

export function feelSignals(rng: Rng): boolean[] {
  return rng.shuffle([true, false, true, false]);
}

export interface Case {
  m: Market;
  sent: boolean;
}

export const PROVE_POOL: readonly Case[] = [
  { m: new Market(0.25, 0.6, 0.2), sent: true },
  { m: new Market(0.5, 0.9, 0.3), sent: true },
  { m: new Market(0.2, 0.8, 0.4), sent: true },
  { m: new Market(0.4, 0.5, 0.25), sent: true },
  { m: new Market(0.5, 0.7, 0.1), sent: false },
];

export function proveSet(rng: Rng): Case[] {
  return rng.shuffle([...PROVE_POOL]).slice(0, 2);
}

export const isRight = (c: Case, share: number, tol = 0.05): boolean => Math.abs(share - c.m.posterior(c.sent)) <= tol + 1e-9;
